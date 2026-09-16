import { useCallback, useEffect, useRef, useState } from 'react';
import { getAddress } from 'viem';
import { getUnlockedAccount } from '../lib/accountSession';
import {
  forgetHeldProbes,
  fmtTokenAmount,
  fmtUsdValue,
  enrichMissingUsdPrices,
  hydrateAssetBalanceCache,
  isNativeWalletToken,
  loadNativeBalanceForChain,
  loadWalletBalancesForChain,
  MAIN_STALE_MS,
  mergeMainAssetRows,
  OTHER_STALE_MS,
  peekMainBalances,
  peekMainSnap,
  peekOtherBalances,
  rememberMainBalances,
  rememberOtherBalances,
  type WalletBalEntry,
} from '../lib/walletBalances';
import {
  hideToken,
  loadHiddenTokens,
  loadTouchedTokenAddresses,
  loadWatchedTokens,
  markTokensTouched,
  subscribeAssetTokenPrefs,
  unhideToken,
  type HiddenTokenMeta,
  type WatchedTokenMeta,
} from '../lib/assetTokenPrefs';
import { isMainAssetRow } from '../lib/tokenListFilter';
import {
  mergeWatchedBalanceRows,
  watchedProbeOf,
} from '../lib/watchAsset';
import { effectiveActiveChainId, type AppSettings } from '../lib/storageState';
import { LiFiIcon } from './LiFiIcon';
import { QuickSendInline } from './QuickSendInline';
import { RefreshIconButton } from './RefreshIconButton';

function tokenRowKey(t: { chainId: number; address: string }): string {
  return `${t.chainId}:${t.address.toLowerCase()}`;
}

function hiddenSetOf(hidden: HiddenTokenMeta[]): Set<string> {
  return new Set(hidden.map(h => h.address.toLowerCase()));
}

function splitRows(
  rows: WalletBalEntry[],
  hidden: HiddenTokenMeta[],
  touched: Set<string>,
  watched: Set<string>,
): { main: WalletBalEntry[]; other: WalletBalEntry[] } {
  const skip = hiddenSetOf(hidden);
  const ctx = { hidden: skip, touched, watched };
  const main = rows.filter(r => isMainAssetRow(r, ctx));
  const mainAddrs = new Set(main.map(r => r.address.toLowerCase()));
  const other = rows.filter(
    r => !mainAddrs.has(r.address.toLowerCase()) && !skip.has(r.address.toLowerCase()),
  );
  return { main, other };
}

function watchedSetOf(watched: WatchedTokenMeta[]): Set<string> {
  return new Set(watched.map(t => t.address.toLowerCase()));
}

export function WalletHomeView({
  settings,
}: {
  settings: AppSettings;
  onSaved: () => void;
}) {
  const account = getUnlockedAccount();
  const addr = account ? getAddress(account.address) : null;
  const chainId = effectiveActiveChainId(settings);
  const loadGen = useRef(0);

  const [mainRows, setMainRows] = useState<WalletBalEntry[]>([]);
  const [otherRows, setOtherRows] = useState<WalletBalEntry[]>([]);
  const [hidden, setHidden] = useState<HiddenTokenMeta[]>([]);
  const [mainBusy, setMainBusy] = useState(true);
  const [otherBusy, setOtherBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);
  const [hiddenOpen, setHiddenOpen] = useState(false);

  const applyMain = useCallback(
    (
      rows: WalletBalEntry[],
      hiddenRows: HiddenTokenMeta[],
      touched: Set<string>,
      watched: Set<string>,
      opts?: { allowEmpty?: boolean },
    ) => {
      if (!addr) return;
      const { main } = splitRows(rows, hiddenRows, touched, watched);
      if (main.length === 0 && opts?.allowEmpty === false) return;
      setMainRows(main);
      rememberMainBalances(chainId, addr, main);
    },
    [addr, chainId],
  );

  const promotePricedRows = useCallback(
    (
      rows: WalletBalEntry[],
      hiddenRows: HiddenTokenMeta[],
      touched: Set<string>,
      watched: Set<string>,
    ) => {
      if (!addr) return;
      const { main, other } = splitRows(rows, hiddenRows, touched, watched);
      setOtherRows(other);
      rememberOtherBalances(chainId, addr, other);
      if (main.length === 0) return;
      setMainRows(prev => {
        const merged = mergeMainAssetRows(prev, main);
        rememberMainBalances(chainId, addr, merged);
        return merged;
      });
    },
    [addr, chainId],
  );

  const refreshMain = useCallback(async (force = false) => {
    if (!addr) return;
    const gen = loadGen.current;
    const snap = peekMainSnap(chainId, addr);
    if (snap?.rows.length) setMainRows(snap.rows);
    const nativeNeedsUsd = snap?.rows.some(r => isNativeWalletToken(r) && !r.priceUSD);
    if (!force && snap?.rows.length && Date.now() - snap.at < MAIN_STALE_MS && !nativeNeedsUsd) {
      setMainBusy(false);
      return;
    }

    setMainBusy(true);
    setErr(null);
    // Native first so Assets is never blank while Li.FI + token RPCs catch up.
    if (peekMainBalances(chainId, addr).length === 0) {
      void loadNativeBalanceForChain(addr, chainId)
        .then(native => {
          if (gen !== loadGen.current || !native) return;
          if (peekMainBalances(chainId, addr).length > 0) return;
          setMainRows(prev => (prev.length > 0 ? prev : [native]));
        })
        .catch(() => {});
    }
    try {
      const [hiddenRows, touchedAddrs, watchedRows] = await Promise.all([
        loadHiddenTokens(chainId, addr),
        loadTouchedTokenAddresses(chainId, addr),
        loadWatchedTokens(chainId, addr),
      ]);
      if (gen !== loadGen.current) return;
      setHidden(hiddenRows);
      const watchedAddrs = watchedSetOf(watchedRows);

      const { rows: next, error } = await loadWalletBalancesForChain(addr, chainId, {
        refreshRpc: true,
        explorerApiKey: settings.explorerApiKey,
        skipAddresses: hiddenSetOf(hiddenRows),
        promoteAddresses: new Set([...touchedAddrs, ...watchedAddrs]),
        extraProbes: watchedRows.map(watchedProbeOf),
        includeDustProbes: false,
      });
      if (gen !== loadGen.current) return;
      applyMain(
        mergeWatchedBalanceRows(next, watchedRows, chainId),
        hiddenRows,
        touchedAddrs,
        watchedAddrs,
        { allowEmpty: !error },
      );
      setErr(error);
    } catch (e) {
      if (gen !== loadGen.current) return;
      if (peekMainBalances(chainId, addr).length === 0) {
        setErr(e instanceof Error ? e.message : 'Could not load balances');
      }
    } finally {
      if (gen === loadGen.current) setMainBusy(false);
    }
  }, [addr, chainId, settings.explorerApiKey, applyMain]);

  const refreshOther = useCallback(
    async (force: boolean) => {
      if (!addr) return;
      const gen = loadGen.current;
      const cached = peekOtherBalances(chainId, addr);
      if (cached) setOtherRows(cached.rows);
      const [hiddenRows, touchedAddrs, watchedRows] = await Promise.all([
        loadHiddenTokens(chainId, addr),
        loadTouchedTokenAddresses(chainId, addr),
        loadWatchedTokens(chainId, addr),
      ]);
      if (gen !== loadGen.current) return;
      setHidden(hiddenRows);
      const watchedAddrs = watchedSetOf(watchedRows);
      if (!force && cached && Date.now() - cached.at < OTHER_STALE_MS) {
        const priced = await enrichMissingUsdPrices(cached.rows);
        if (gen !== loadGen.current) return;
        promotePricedRows(
          mergeWatchedBalanceRows([...peekMainBalances(chainId, addr), ...priced], watchedRows, chainId),
          hiddenRows,
          touchedAddrs,
          watchedAddrs,
        );
        return;
      }
      setOtherBusy(true);
      try {
        const { rows: next, error } = await loadWalletBalancesForChain(addr, chainId, {
          refreshRpc: true,
          explorerApiKey: settings.explorerApiKey,
          skipAddresses: hiddenSetOf(hiddenRows),
          promoteAddresses: new Set([...touchedAddrs, ...watchedAddrs]),
          extraProbes: watchedRows.map(watchedProbeOf),
          includeDustProbes: true,
        });
        if (gen !== loadGen.current) return;
        const merged = mergeWatchedBalanceRows(next, watchedRows, chainId);
        const split = splitRows(merged, hiddenRows, touchedAddrs, watchedAddrs);
        // Other must never replace Main wholesale — a partial dust snapshot used to blank Assets.
        if (!error || split.other.length > 0 || !peekOtherBalances(chainId, addr)) {
          promotePricedRows(merged, hiddenRows, touchedAddrs, watchedAddrs);
        }
      } finally {
        if (gen === loadGen.current) setOtherBusy(false);
      }
    },
    [addr, chainId, settings.explorerApiKey, promotePricedRows],
  );

  useEffect(() => {
    loadGen.current += 1;
    const gen = loadGen.current;
    setExpandedKey(null);
    setHiddenOpen(false);
    setErr(null);
    if (!addr) {
      setMainRows([]);
      setOtherRows([]);
      setMainBusy(false);
      return;
    }
    const memoryMain = peekMainBalances(chainId, addr);
    const memoryOther = peekOtherBalances(chainId, addr);
    setMainRows(memoryMain);
    setOtherRows(memoryOther?.rows ?? []);
    setMainBusy(memoryMain.length === 0);
    void loadHiddenTokens(chainId, addr).then(rows => {
      if (gen === loadGen.current) setHidden(rows);
    });
    void (async () => {
      await hydrateAssetBalanceCache();
      if (gen !== loadGen.current) return;
      const cachedMain = peekMainBalances(chainId, addr);
      const cachedOther = peekOtherBalances(chainId, addr);
      if (cachedMain.length) setMainRows(cachedMain);
      if (cachedOther) setOtherRows(cachedOther.rows);
      void refreshMain(false);
    })();
    // Hydrate + fetch for this account/chain only — do not reset when refreshMain identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr, chainId]);

  useEffect(() => {
    if (!addr) return;
    return subscribeAssetTokenPrefs(() => {
      void refreshMain(true);
    });
  }, [addr, chainId, refreshMain]);

  async function onHide(t: WalletBalEntry) {
    if (!addr) return;
    const nextHidden = await hideToken(chainId, addr, {
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      logoURI: t.logoURI,
    });
    forgetHeldProbes(chainId, addr, [t.address]);
    setHidden(nextHidden);
    const nextMain = mainRows.filter(r => r.address.toLowerCase() !== t.address.toLowerCase());
    const nextOther = otherRows.filter(r => r.address.toLowerCase() !== t.address.toLowerCase());
    setMainRows(nextMain);
    setOtherRows(nextOther);
    rememberMainBalances(chainId, addr, nextMain);
    rememberOtherBalances(chainId, addr, nextOther);
    if (expandedKey === tokenRowKey(t)) setExpandedKey(null);
  }

  async function onUnhide(token: HiddenTokenMeta) {
    if (!addr) return;
    const nextHidden = await unhideToken(chainId, addr, token.address);
    setHidden(nextHidden);
    void refreshMain(true);
    const cached = peekOtherBalances(chainId, addr);
    if (cached) void refreshOther(true);
  }

  function toggleSend(t: WalletBalEntry) {
    const key = tokenRowKey(t);
    setExpandedKey(prev => (prev === key ? null : key));
  }

  function toggleOther() {
    const next = !otherOpen;
    setOtherOpen(next);
    if (next) void refreshOther(false);
  }

  const empty =
    !mainBusy && mainRows.length === 0 && otherRows.length === 0 && hidden.length === 0 && !err;

  return (
    <div className="w1337-home">
      <div className="w1337-home-refresh-row">
        <RefreshIconButton
          busy={mainBusy}
          ariaLabel="Refresh balances"
          onClick={() => void refreshMain(true)}
        />
      </div>

      {err ? <p className="error w1337-home-error">{err}</p> : null}

      {mainBusy && mainRows.length === 0 ? (
        <p className="muted w1337-home-loading">Loading balances…</p>
      ) : null}

      {empty ? (
        <p className="muted w1337-home-empty">No tokens with balance on this network.</p>
      ) : null}

      <ul className="w1337-token-list">
        {mainRows.map(t => (
          <AssetTokenItem
            key={tokenRowKey(t)}
            token={t}
            chainId={chainId}
            settings={settings}
            expanded={expandedKey === tokenRowKey(t)}
            onToggle={() => toggleSend(t)}
            onHide={() => void onHide(t)}
            hideable={!isNativeWalletToken(t)}
            onCollapse={() => setExpandedKey(null)}
            onSent={() => {
              if (!addr) return;
              void markTokensTouched(chainId, addr, [t.address]).then(() => refreshMain(true));
            }}
          />
        ))}
      </ul>

      <div className="w1337-token-fold">
        <div className="w1337-token-fold__bar">
          <button
            type="button"
            className="w1337-token-fold__head"
            aria-expanded={otherOpen}
            onClick={toggleOther}
          >
            Other{otherRows.length ? ` (${otherRows.length})` : ''}
            <span className="w1337-token-fold__chev" aria-hidden>
              {otherOpen ? '−' : '+'}
            </span>
          </button>
          <RefreshIconButton
            busy={otherBusy}
            ariaLabel="Refresh other tokens"
            onClick={() => void refreshOther(true)}
          />
        </div>
        {otherOpen ? (
          otherBusy && otherRows.length === 0 ? (
            <p className="muted w1337-home-loading">Loading other tokens…</p>
          ) : otherRows.length === 0 && !otherBusy ? (
            <p className="muted w1337-home-empty">No extra tokens on this network.</p>
          ) : (
            <ul className="w1337-token-list">
              {otherRows.map(t => (
                <AssetTokenItem
                  key={tokenRowKey(t)}
                  token={t}
                  chainId={chainId}
                  settings={settings}
                  expanded={expandedKey === tokenRowKey(t)}
                  onToggle={() => toggleSend(t)}
                  onHide={() => void onHide(t)}
                  hideable={!isNativeWalletToken(t)}
                  onCollapse={() => setExpandedKey(null)}
                  onSent={() => {
                    if (!addr) return;
                    void markTokensTouched(chainId, addr, [t.address]).then(() => refreshMain(true));
                  }}
                />
              ))}
            </ul>
          )
        ) : null}
      </div>

      {hidden.length > 0 ? (
        <div className="w1337-token-fold">
          <button
            type="button"
            className="w1337-token-fold__head"
            aria-expanded={hiddenOpen}
            onClick={() => setHiddenOpen(v => !v)}
          >
            Hidden ({hidden.length})
            <span className="w1337-token-fold__chev" aria-hidden>
              {hiddenOpen ? '−' : '+'}
            </span>
          </button>
          {hiddenOpen ? (
            <ul className="w1337-token-list">
              {hidden.map(t => (
                <li key={`${chainId}:${t.address}`} className="w1337-token-item">
                  <div className="w1337-token-row">
                    <LiFiIcon logoURI={t.logoURI} label={t.symbol} size={40} rounded />
                    <div className="w1337-token-row__meta">
                      <span className="w1337-token-row__name">{t.name || t.symbol}</span>
                      <span className="w1337-token-row__sym">{t.symbol}</span>
                    </div>
                    <button
                      type="button"
                      className="ghost w1337-token-row__unhide"
                      onClick={() => void onUnhide(t)}
                    >
                      Unhide
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AssetTokenItem({
  token: t,
  chainId,
  settings,
  expanded,
  onToggle,
  onHide,
  hideable,
  onCollapse,
  onSent,
}: {
  token: WalletBalEntry;
  chainId: number;
  settings: AppSettings;
  expanded: boolean;
  onToggle: () => void;
  onHide: () => void;
  hideable?: boolean;
  onCollapse: () => void;
  onSent: () => void;
}) {
  const usd = fmtUsdValue(t);
  const key = tokenRowKey(t);
  const identity = (
    <>
      <LiFiIcon logoURI={t.logoURI} label={t.symbol} size={40} rounded />
      <div className="w1337-token-row__meta">
        <span className="w1337-token-row__name">{t.name || t.symbol}</span>
        <span className="w1337-token-row__sym">{t.symbol}</span>
      </div>
      <div className="w1337-token-row__vals">
        <span className="w1337-token-row__usd">{usd ?? '—'}</span>
        <span className="w1337-token-row__amt">
          {fmtTokenAmount(t)} {t.symbol}
        </span>
      </div>
    </>
  );
  return (
    <li className={`w1337-token-item${expanded ? ' w1337-token-item--open' : ''}`} aria-expanded={expanded}>
      <div className="w1337-token-row w1337-token-row--split">
        {expanded ? (
          <div className="w1337-token-row__main">
            {identity}
          </div>
        ) : (
          <button
            type="button"
            className="w1337-token-row__main"
            aria-expanded={false}
            onClick={onToggle}
          >
            {identity}
            <span className="w1337-token-row__toggle" aria-hidden>
              +
            </span>
          </button>
        )}
        {expanded ? (
          <button
            type="button"
            className="w1337-token-row__close"
            title="Close send"
            aria-label="Close send"
            onClick={onCollapse}
          >
            ×
          </button>
        ) : hideable !== false ? (
          <button
            type="button"
            className="w1337-token-row__hide"
            title="Hide token"
            aria-label={`Hide ${t.symbol}`}
            onClick={onHide}
          >
            ×
          </button>
        ) : (
          <span className="w1337-token-row__hide w1337-token-row__hide--slot" aria-hidden />
        )}
      </div>
      {expanded ? (
        <QuickSendInline
          key={key}
          token={t}
          chainId={chainId}
          settings={settings}
          onCollapse={onCollapse}
          onSent={onSent}
        />
      ) : null}
    </li>
  );
}
