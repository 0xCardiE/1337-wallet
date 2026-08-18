import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAddress } from 'viem';
import { getUnlockedAccount } from '../lib/accountSession';
import { chainById } from '../lib/chainCatalog';
import { chainLogoUri } from '../lib/chainLogo';
import { revokeErc20Approval, waitForChainReceipt } from '../lib/ethereum';
import { needsExplorerApiKey } from '../lib/explorerTxHistory';
import { effectiveActiveChainId, type AppSettings } from '../lib/storageState';
import {
  APPROVAL_LOG_LOOKBACK_DAYS,
  addressExplorerLink,
  filterRowsForWalletTokens,
  findUnscannedTokens,
  formatAllowance,
  getLatestBlockNumber,
  mergeApprovalRows,
  olderApprovalWindow,
  recentApprovalWindow,
  refreshLiveAllowances,
  scannedLookbackDays,
  scanTokenApprovals,
  txExplorerLink,
  walletTokenKey,
  type ApprovalLogWindow,
  type TokenApprovalRow,
} from '../lib/tokenApprovals';
import {
  loadTokenApprovalsCache,
  saveTokenApprovalsCache,
} from '../lib/tokenApprovalsCache';
import { ApprovalFact, ApprovalsScanOlder, ExternalLinkIcon, olderScanNote } from './ApprovalsScanOlder';
import { loadWalletBalancesForChain, type WalletBalEntry } from '../lib/walletBalances';
import { describeError } from '../lib/utils';
import { LiFiIcon } from './LiFiIcon';
import { NftApprovalsPanel } from './NftApprovalsPanel';
import { Permit2ApprovalsPanel } from './Permit2ApprovalsPanel';

function shortAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function ApprovalRowItem({
  row,
  chainId,
  busy,
  onRevoke,
}: {
  row: TokenApprovalRow;
  chainId: number;
  busy: boolean;
  onRevoke: (row: TokenApprovalRow) => void;
}) {
  const tokenUrl = addressExplorerLink(chainId, row.token);
  const spenderUrl = addressExplorerLink(chainId, row.spender);
  const txUrl = row.lastApprovalTx ? txExplorerLink(chainId, row.lastApprovalTx) : undefined;

  return (
    <li className="w1337-approvals__item">
      <div className="w1337-approvals__token">
        <LiFiIcon logoURI={row.tokenLogo} label={row.tokenSymbol} size={28} rounded />
        <span className="w1337-approvals__token-symbol">{row.tokenSymbol}</span>
      </div>
      <dl className="w1337-approvals__facts">
        <ApprovalFact label="Token">
          {tokenUrl ? (
            <a className="w1337-approvals__link" href={tokenUrl} target="_blank" rel="noopener noreferrer">
              {shortAddress(row.token)} <ExternalLinkIcon />
            </a>
          ) : (
            shortAddress(row.token)
          )}
        </ApprovalFact>
        <ApprovalFact label="Spender">
          {spenderUrl ? (
            <a className="w1337-approvals__link" href={spenderUrl} target="_blank" rel="noopener noreferrer">
              {shortAddress(row.spender)} <ExternalLinkIcon />
            </a>
          ) : (
            shortAddress(row.spender)
          )}
        </ApprovalFact>
        <ApprovalFact label="Allowance">
          <span className={`w1337-approvals__allowance${row.unlimited ? ' w1337-approvals__allowance--warn' : ''}`}>
            {formatAllowance(row.allowance, row.tokenDecimals, row.unlimited)}
          </span>
        </ApprovalFact>
        {txUrl ? (
          <ApprovalFact label="Last tx">
            <a className="w1337-approvals__link" href={txUrl} target="_blank" rel="noopener noreferrer">
              View <ExternalLinkIcon />
            </a>
          </ApprovalFact>
        ) : null}
      </dl>
      <button
        type="button"
        className="w1337-approvals__revoke"
        disabled={busy}
        onClick={() => onRevoke(row)}
      >
        Revoke
      </button>
    </li>
  );
}

export function ApprovalsPanel({ settings }: { settings: AppSettings }) {
  const [kind, setKind] = useState<'tokens' | 'nfts' | 'permit2'>('tokens');
  return (
    <div>
      <nav className="w1337-approvals-kinds" aria-label="Approval type">
        {(
          [
            ['tokens', 'Tokens'],
            ['nfts', 'NFTs'],
            ['permit2', 'Permit2'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`w1337-approvals-kinds__btn${kind === id ? ' w1337-approvals-kinds__btn--on' : ''}`}
            aria-current={kind === id ? 'page' : undefined}
            onClick={() => setKind(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {kind === 'tokens' ? <TokenApprovalsPanel settings={settings} /> : null}
      {kind === 'nfts' ? <NftApprovalsPanel settings={settings} /> : null}
      {kind === 'permit2' ? <Permit2ApprovalsPanel settings={settings} /> : null}
    </div>
  );
}

function TokenApprovalsPanel({ settings }: { settings: AppSettings }) {
  const account = getUnlockedAccount();
  const addr = account ? getAddress(account.address) : null;
  const chainId = effectiveActiveChainId(settings);
  const chain = chainById(chainId);
  const apiKey = settings.explorerApiKey?.trim();
  const chainLogo = chain ? chainLogoUri(chain) : undefined;

  const [walletTokens, setWalletTokens] = useState<WalletBalEntry[]>([]);
  const [rows, setRows] = useState<TokenApprovalRow[]>([]);
  const [scannedTokens, setScannedTokens] = useState<string[]>([]);
  const [scanningTokens, setScanningTokens] = useState<string[]>([]);
  const [fromBlock, setFromBlock] = useState<number | null>(null);
  const [latestBlock, setLatestBlock] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [revokingKey, setRevokingKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [olderNote, setOlderNote] = useState<string | null>(null);
  const scanningRef = useRef(false);

  const visibleRows = useMemo(
    () => filterRowsForWalletTokens(rows, walletTokens),
    [rows, walletTokens],
  );

  const unscanned = useMemo(
    () => findUnscannedTokens(walletTokens, scannedTokens),
    [walletTokens, scannedTokens],
  );

  const persist = useCallback(
    async (next: {
      rows: TokenApprovalRow[];
      scannedTokenAddresses: string[];
      fromBlock: number;
    }) => {
      if (!addr) return;
      await saveTokenApprovalsCache(chainId, addr, {
        rows: next.rows,
        scannedTokenAddresses: next.scannedTokenAddresses,
        fromBlock: next.fromBlock,
        updatedAt: Date.now(),
      });
    },
    [addr, chainId],
  );

  const loadBalances = useCallback(async () => {
    if (!addr) return [];
    const { rows: bals, error } = await loadWalletBalancesForChain(addr, chainId);
    if (error) throw new Error(error);
    setWalletTokens(bals);
    return bals;
  }, [addr, chainId]);

  const scanTokens = useCallback(
    async (tokens: WalletBalEntry[], opts?: { window?: ApprovalLogWindow }) => {
      if (!addr) return;
      if (tokens.length === 0) return;

      const win = opts?.window ?? (await recentApprovalWindow(chainId));

      setScanningTokens(tokens.map(walletTokenKey));
      try {
        const incoming = await scanTokenApprovals({
          chainId,
          owner: addr,
          tokens,
          fromBlock: win.fromBlock,
          toBlock: win.toBlock,
          explorerApiKey: apiKey,
          onTokenScanned: token => {
            setScanningTokens(prev => prev.filter(t => t !== token.toLowerCase()));
            setScannedTokens(prev =>
              prev.includes(token.toLowerCase()) ? prev : [...prev, token.toLowerCase()],
            );
          },
        });

        let nextRows: TokenApprovalRow[] = [];
        setRows(prev => {
          nextRows = mergeApprovalRows(prev, incoming);
          return nextRows;
        });

        let nextScanned: string[] = [];
        setScannedTokens(prev => {
          nextScanned = [...new Set([...prev, ...tokens.map(walletTokenKey)])];
          return nextScanned;
        });

        let nextFrom = win.fromBlock;
        setFromBlock(prev => {
          nextFrom = prev == null ? win.fromBlock : Math.min(prev, win.fromBlock);
          return nextFrom;
        });

        await persist({
          rows: nextRows,
          scannedTokenAddresses: nextScanned,
          fromBlock: nextFrom,
        });
        return incoming;
      } finally {
        setScanningTokens([]);
      }
    },
    [addr, apiKey, chainId, persist],
  );

  const loadInitial = useCallback(async () => {
    if (!addr) return;
    if (needsExplorerApiKey(chainId) && !apiKey) {
      setWalletTokens([]);
      setRows([]);
      setScannedTokens([]);
      setHydrated(true);
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      const [cached, latest] = await Promise.all([
        loadTokenApprovalsCache(chainId, addr),
        getLatestBlockNumber(chainId).catch(() => null),
      ]);
      if (latest != null) setLatestBlock(latest);
      if (cached) {
        setRows(cached.rows);
        setScannedTokens(cached.scannedTokenAddresses);
        setFromBlock(cached.fromBlock);
      }

      const bals = await loadBalances();
      if (cached?.rows.length) {
        const refreshed = await refreshLiveAllowances({
          chainId,
          owner: addr,
          rows: filterRowsForWalletTokens(cached.rows, bals),
        });
        setRows(refreshed);
        await persist({
          rows: refreshed,
          scannedTokenAddresses: cached.scannedTokenAddresses,
          fromBlock: cached.fromBlock,
        });
      }
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
      setHydrated(true);
    }
  }, [addr, apiKey, chainId, loadBalances, persist]);

  useEffect(() => {
    setHydrated(false);
    setRows([]);
    setScannedTokens([]);
    setFromBlock(null);
    setLatestBlock(null);
    setWalletTokens([]);
    setOlderNote(null);
    void loadInitial();
  }, [chainId, addr, apiKey, loadInitial]);

  useEffect(() => {
    if (!addr || !hydrated || unscanned.length === 0 || busy || scanningRef.current) return;
    if (needsExplorerApiKey(chainId) && !apiKey) return;
    scanningRef.current = true;
    void (async () => {
      setErr(null);
      try {
        await scanTokens(unscanned);
      } catch (e) {
        setErr(describeError(e));
      } finally {
        scanningRef.current = false;
      }
    })();
  }, [addr, apiKey, busy, chainId, hydrated, scanTokens, unscanned]);

  async function scanOlder() {
    if (!addr || fromBlock == null || scanningRef.current) return;
    const win = olderApprovalWindow(chainId, fromBlock);
    if (!win) return;
    scanningRef.current = true;
    setBusy(true);
    setErr(null);
    setOlderNote(null);
    try {
      const bals = walletTokens.length > 0 ? walletTokens : await loadBalances();
      const existingKeys = new Set(
        rows.map(r => `${r.token.toLowerCase()}:${r.spender.toLowerCase()}`),
      );
      const incoming = (await scanTokens(bals, { window: win })) ?? [];
      const found = incoming.filter(
        r => !existingKeys.has(`${r.token.toLowerCase()}:${r.spender.toLowerCase()}`),
      ).length;
      setOlderNote(olderScanNote(found));
      const latest = await getLatestBlockNumber(chainId).catch(() => null);
      if (latest != null) setLatestBlock(latest);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      scanningRef.current = false;
      setBusy(false);
    }
  }

  async function onRevoke(row: TokenApprovalRow) {
    const key = `${row.token}:${row.spender}`;
    setRevokingKey(key);
    setErr(null);
    try {
      const hash = await revokeErc20Approval({
        chainId,
        tokenAddress: row.token,
        spender: row.spender,
      });
      if (!hash) return;
      await waitForChainReceipt(hash, chainId);
      setRows(prev => {
        const next = prev.filter(
          r =>
            !(
              r.token.toLowerCase() === row.token.toLowerCase() &&
              r.spender.toLowerCase() === row.spender.toLowerCase()
            ),
        );
        void persist({
          rows: next,
          scannedTokenAddresses: scannedTokens,
          fromBlock: fromBlock ?? 0,
        });
        return next;
      });
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setRevokingKey(null);
    }
  }

  if (!addr) {
    return <p className="w1337-tools-empty muted">Unlock wallet to view token approvals.</p>;
  }

  if (needsExplorerApiKey(chainId) && !apiKey) {
    return (
      <p className="w1337-tools-empty muted">
        Add an <strong>Etherscan API key</strong> in Settings to scan token approvals on{' '}
        {chain?.name ?? chainId}. Optimism, Base, and other Blockscout-backed chains work without a
        key.
      </p>
    );
  }

  const scanningLabel =
    scanningTokens.length > 0
      ? `Scanning ${scanningTokens.length} token${scanningTokens.length === 1 ? '' : 's'}…`
      : null;
  const scannedDays =
    fromBlock != null && latestBlock != null
      ? scannedLookbackDays(chainId, latestBlock, fromBlock)
      : fromBlock != null
        ? APPROVAL_LOG_LOOKBACK_DAYS
        : null;
  const scanBusy = busy || scanningTokens.length > 0;

  return (
    <div className="w1337-approvals">
      <div className="w1337-tx-history__head">
        <div className="w1337-tx-history__head-main">
          {chainLogo ? (
            <LiFiIcon logoURI={chainLogo} label={chain?.name} size={28} rounded />
          ) : null}
          <div>
            <p className="w1337-tx-history__head-title">{chain?.name ?? `Chain ${chainId}`}</p>
            <p className="w1337-tx-history__head-sub muted">
              {visibleRows.length > 0
                ? `${visibleRows.length} active approval${visibleRows.length === 1 ? '' : 's'}`
                : 'Token approvals'}
              {scannedDays != null ? ` · ~${scannedDays} days` : ''}
            </p>
          </div>
        </div>
      </div>

      {err ? <p className="error">{err}</p> : null}
      {scanningLabel ? <p className="w1337-tools-empty muted">{scanningLabel}</p> : null}

      {!hydrated || (busy && visibleRows.length === 0 && scanningTokens.length === 0) ? (
        <p className="w1337-tools-empty muted">Loading wallet tokens…</p>
      ) : null}

      {hydrated && !busy && scanningTokens.length === 0 && visibleRows.length === 0 && !err ? (
        <p className="w1337-tools-empty muted">
          {walletTokens.length === 0
            ? 'No tokens in wallet on this network.'
            : 'No active approvals found for your current wallet tokens.'}
        </p>
      ) : null}

      {visibleRows.length > 0 ? (
        <ul className="w1337-approvals__list">
          {visibleRows.map(row => {
            const key = `${row.token}:${row.spender}`;
            return (
              <ApprovalRowItem
                key={key}
                row={row}
                chainId={chainId}
                busy={revokingKey === key}
                onRevoke={onRevoke}
              />
            );
          })}
        </ul>
      ) : null}

      <ApprovalsScanOlder
        scannedDays={scannedDays}
        scannedFromGenesis={fromBlock === 0}
        busy={scanBusy}
        note={olderNote}
        onScanOlder={() => void scanOlder()}
      />
    </div>
  );
}
