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
  mergeApprovalRows,
  recentApprovalFromBlock,
  refreshLiveAllowances,
  scanTokenApprovals,
  txExplorerLink,
  walletTokenKey,
  type TokenApprovalRow,
} from '../lib/tokenApprovals';
import {
  clearTokenApprovalsCache,
  loadTokenApprovalsCache,
  saveTokenApprovalsCache,
} from '../lib/tokenApprovalsCache';
import { loadWalletBalancesForChain, type WalletBalEntry } from '../lib/walletBalances';
import { describeError } from '../lib/utils';
import { LiFiIcon } from './LiFiIcon';
import { RefreshIconButton } from './RefreshIconButton';

function shortAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function ExternalLinkIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" />
      <polyline points="15 3 21 3 21 9" strokeLinecap="round" />
      <line x1="10" y1="14" x2="21" y2="3" strokeLinecap="round" />
    </svg>
  );
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
        <div className="w1337-approvals__token-meta">
          <span className="w1337-approvals__token-symbol">{row.tokenSymbol}</span>
          {tokenUrl ? (
            <a
              className="w1337-approvals__link muted"
              href={tokenUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {shortAddress(row.token)} <ExternalLinkIcon />
            </a>
          ) : (
            <span className="muted">{shortAddress(row.token)}</span>
          )}
        </div>
      </div>

      <div className="w1337-approvals__detail">
        <span className="w1337-approvals__label muted">Spender</span>
        {spenderUrl ? (
          <a
            className="w1337-approvals__link"
            href={spenderUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {shortAddress(row.spender)} <ExternalLinkIcon />
          </a>
        ) : (
          <span>{shortAddress(row.spender)}</span>
        )}
      </div>

      <div className="w1337-approvals__detail">
        <span className="w1337-approvals__label muted">Allowance</span>
        <span className={`w1337-approvals__allowance${row.unlimited ? ' w1337-approvals__allowance--warn' : ''}`}>
          {formatAllowance(row.allowance, row.tokenDecimals, row.unlimited)}
        </span>
      </div>

      {txUrl ? (
        <a
          className="w1337-approvals__tx-link muted"
          href={txUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Last approval tx <ExternalLinkIcon />
        </a>
      ) : null}

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
  const [busy, setBusy] = useState(false);
  const [revokingKey, setRevokingKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
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
    async (tokens: WalletBalEntry[], opts?: { fullRescan?: boolean }) => {
      if (!addr) return;
      if (tokens.length === 0) return;

      const block = fromBlock ?? (await recentApprovalFromBlock(chainId));
      if (fromBlock == null) setFromBlock(block);

      setScanningTokens(tokens.map(walletTokenKey));
      try {
        const incoming = await scanTokenApprovals({
          chainId,
          owner: addr,
          tokens,
          fromBlock: block,
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
          nextRows = opts?.fullRescan
            ? mergeApprovalRows([], incoming)
            : mergeApprovalRows(prev, incoming);
          return nextRows;
        });

        let nextScanned: string[] = [];
        setScannedTokens(prev => {
          nextScanned = opts?.fullRescan
            ? tokens.map(walletTokenKey)
            : [...new Set([...prev, ...tokens.map(walletTokenKey)])];
          return nextScanned;
        });

        await persist({
          rows: nextRows,
          scannedTokenAddresses: nextScanned,
          fromBlock: block,
        });
      } finally {
        setScanningTokens([]);
      }
    },
    [addr, apiKey, chainId, fromBlock, persist],
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
      const cached = await loadTokenApprovalsCache(chainId, addr);
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

  async function refreshAll() {
    if (!addr) return;
    setBusy(true);
    setErr(null);
    try {
      await clearTokenApprovalsCache(chainId, addr);
      setRows([]);
      setScannedTokens([]);
      setFromBlock(null);
      const bals = await loadBalances();
      const block = await recentApprovalFromBlock(chainId);
      setFromBlock(block);
      await scanTokens(bals, { fullRescan: true });
    } catch (e) {
      setErr(describeError(e));
    } finally {
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
        Add a free <strong>Etherscan API key</strong> in Settings to scan token approvals on{' '}
        {chain?.name ?? chainId}. One key works across Etherscan-family chains.
      </p>
    );
  }

  const scanningLabel =
    scanningTokens.length > 0
      ? `Scanning ${scanningTokens.length} token${scanningTokens.length === 1 ? '' : 's'}…`
      : null;

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
              {walletTokens.length > 0
                ? ` · ${walletTokens.filter(t => t.address.toLowerCase() !== '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee').length} wallet tokens`
                : ''}
              {scannedTokens.length > 0 ? ` · ${scannedTokens.length} scanned` : ''}
            </p>
          </div>
        </div>
        <RefreshIconButton
          busy={busy || scanningTokens.length > 0}
          ariaLabel="Refresh token approvals"
          onClick={() => void refreshAll()}
        />
      </div>

      <div className="w1337-approvals__notice" role="note">
        <strong>Limited scan.</strong> We only check ERC-20 tokens currently in your wallet, using
        Etherscan approval logs from the last {APPROVAL_LOG_LOOKBACK_DAYS} days. Approvals on tokens
        you no longer hold, or older than this window, are not shown. New wallet tokens are scanned
        automatically.
        {scannedTokens.length > 0 ? (
          <>
            {' '}
            Scanned: {scannedTokens.length} token{scannedTokens.length === 1 ? '' : 's'}.
          </>
        ) : null}
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
    </div>
  );
}
