import { useCallback, useEffect, useState } from 'react';
import { getAddress } from 'viem';
import { getUnlockedAccount } from '../lib/accountSession';
import {
  forgetHeldProbes,
  fmtTokenAmount,
  fmtUsdValue,
  invalidateRpcBalanceCache,
  isNativeWalletToken,
  loadWalletBalancesForChain,
  type WalletBalEntry,
} from '../lib/walletBalances';
import {
  hideToken,
  loadHiddenTokens,
  loadTouchedTokenAddresses,
  markTokensTouched,
  unhideToken,
  type HiddenTokenMeta,
} from '../lib/assetTokenPrefs';
import { isMainAssetRow } from '../lib/tokenListFilter';
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

export function WalletHomeView({
  settings,
}: {
  settings: AppSettings;
  onSaved: () => void;
}) {
  const account = getUnlockedAccount();
  const addr = account ? getAddress(account.address) : null;
  const chainId = effectiveActiveChainId(settings);

  const [mainRows, setMainRows] = useState<WalletBalEntry[]>([]);
  const [otherRows, setOtherRows] = useState<WalletBalEntry[]>([]);
  const [hidden, setHidden] = useState<HiddenTokenMeta[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);
  const [hiddenOpen, setHiddenOpen] = useState(false);

  const refresh = useCallback(
    async (opts?: { dust?: boolean }) => {
      if (!addr) return;
      setBusy(true);
      setErr(null);
      try {
        const [hiddenRows, touchedAddrs] = await Promise.all([
          loadHiddenTokens(chainId, addr),
          loadTouchedTokenAddresses(chainId, addr),
        ]);
        setHidden(hiddenRows);
        const skip = hiddenSetOf(hiddenRows);
        invalidateRpcBalanceCache(chainId);
        const includeDust = opts?.dust === true;
        const { rows: next, error } = await loadWalletBalancesForChain(addr, chainId, {
          refreshRpc: true,
          explorerApiKey: settings.explorerApiKey,
          skipAddresses: skip,
          promoteAddresses: touchedAddrs,
          includeDustProbes: includeDust,
        });
        const ctx = { hidden: skip, touched: touchedAddrs };
        const nextMain = next.filter(r => isMainAssetRow(r, ctx));
        const mainAddrs = new Set(nextMain.map(r => r.address.toLowerCase()));
        setMainRows(nextMain);
        const nextOther = next.filter(
          r => !mainAddrs.has(r.address.toLowerCase()) && !skip.has(r.address.toLowerCase()),
        );
        if (includeDust) setOtherRows(nextOther);
        else {
          setOtherRows(prev =>
            prev.filter(
              r => !skip.has(r.address.toLowerCase()) && !mainAddrs.has(r.address.toLowerCase()),
            ),
          );
        }
        setErr(error);
      } finally {
        setBusy(false);
      }
    },
    [addr, chainId, settings.explorerApiKey],
  );

  useEffect(() => {
    invalidateRpcBalanceCache(chainId);
    setExpandedKey(null);
    setOtherOpen(false);
    setHiddenOpen(false);
    setOtherRows([]);
    void refresh({ dust: true });
  }, [addr, chainId, refresh]);

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
    setMainRows(prev => prev.filter(r => r.address.toLowerCase() !== t.address.toLowerCase()));
    setOtherRows(prev => prev.filter(r => r.address.toLowerCase() !== t.address.toLowerCase()));
    if (expandedKey === tokenRowKey(t)) setExpandedKey(null);
  }

  async function onUnhide(token: HiddenTokenMeta) {
    if (!addr) return;
    const nextHidden = await unhideToken(chainId, addr, token.address);
    setHidden(nextHidden);
    void refresh({ dust: true });
  }

  function toggleSend(t: WalletBalEntry) {
    const key = tokenRowKey(t);
    setExpandedKey(prev => (prev === key ? null : key));
  }

  const empty =
    !busy && mainRows.length === 0 && otherRows.length === 0 && hidden.length === 0 && !err;

  return (
    <div className="w1337-home">
      <div className="w1337-home-refresh-row">
        <RefreshIconButton
          busy={busy}
          ariaLabel="Refresh balances"
          onClick={() => void refresh({ dust: otherOpen })}
        />
      </div>

      {err ? <p className="error w1337-home-error">{err}</p> : null}

      {busy && mainRows.length === 0 && otherRows.length === 0 ? (
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
              void markTokensTouched(chainId, addr, [t.address]).then(() =>
                refresh({ dust: otherOpen }),
              );
            }}
          />
        ))}
      </ul>

      {otherRows.length > 0 ? (
        <div className="w1337-token-fold">
          <button
            type="button"
            className="w1337-token-fold__head"
            aria-expanded={otherOpen}
            onClick={() => {
              const next = !otherOpen;
              setOtherOpen(next);
              if (next) void refresh({ dust: true });
            }}
          >
            Other ({otherRows.length})
            <span className="w1337-token-fold__chev" aria-hidden>
              {otherOpen ? '−' : '+'}
            </span>
          </button>
          {otherOpen ? (
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
                    void markTokensTouched(chainId, addr, [t.address]).then(() =>
                      refresh({ dust: true }),
                    );
                  }}
                />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

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
  return (
    <li className={`w1337-token-item${expanded ? ' w1337-token-item--open' : ''}`}>
      <div className="w1337-token-row w1337-token-row--split">
        <button
          type="button"
          className="w1337-token-row__main"
          aria-expanded={expanded}
          onClick={onToggle}
        >
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
          <span className="w1337-token-row__toggle" aria-hidden>
            {expanded ? '−' : '+'}
          </span>
        </button>
        {hideable !== false ? (
          <button
            type="button"
            className="w1337-token-row__hide"
            title="Hide token"
            aria-label={`Hide ${t.symbol}`}
            onClick={onHide}
          >
            ×
          </button>
        ) : null}
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
