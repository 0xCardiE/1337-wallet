import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getAddress } from 'viem';
import { getActiveAccountMeta, getUnlockedAccount } from '../lib/accountSession';
import { isHardwareAccount } from '../lib/accounts';
import { chainById } from '../lib/chainCatalog';
import { chainLogoUri } from '../lib/chainLogo';
import {
  revokeErc20Approval,
  revokeNftApprovalForAll,
  revokePermit2Allowance,
  waitForChainReceipt,
} from '../lib/ethereum';
import { needsExplorerApiKey } from '../lib/explorerTxHistory';
import {
  mergeNftApprovalRows,
  refreshLiveNftApprovals,
  scanNftApprovals,
  type NftApprovalRow,
} from '../lib/nftApprovals';
import { loadNftApprovalsCache, saveNftApprovalsCache } from '../lib/nftApprovalsCache';
import {
  formatPermit2Expiration,
  mergePermit2ApprovalRows,
  refreshLivePermit2Approvals,
  scanPermit2Approvals,
  type Permit2ApprovalRow,
} from '../lib/permit2Approvals';
import {
  loadPermit2ApprovalsCache,
  savePermit2ApprovalsCache,
} from '../lib/permit2ApprovalsCache';
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
import { describeError } from '../lib/utils';
import { shouldConfirmInWalletSend } from '../lib/txConfirmMode';
import { loadWalletBalancesForChain, type WalletBalEntry } from '../lib/walletBalances';
import { ApprovalFact, ApprovalsScanOlder, ExternalLinkIcon, olderScanNote } from './ApprovalsScanOlder';
import { LiFiIcon } from './LiFiIcon';

function shortAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

type ApprovalKind = 'token' | 'nft' | 'permit2';

const KIND_LABEL: Record<ApprovalKind, string> = {
  token: 'Token',
  nft: 'NFT',
  permit2: 'Permit2',
};

function ExplorerAddr({ chainId, address }: { chainId: number; address: string }) {
  const url = addressExplorerLink(chainId, address);
  if (!url) return <>{shortAddress(address)}</>;
  return (
    <a className="w1337-approvals__link" href={url} target="_blank" rel="noopener noreferrer">
      {shortAddress(address)} <ExternalLinkIcon />
    </a>
  );
}

function CompactApprovalItem({
  kind,
  symbol,
  logoURI,
  amount,
  unlimited,
  assetLabel,
  assetAddr,
  spenderLabel,
  spenderAddr,
  lastTx,
  extra,
  chainId,
  busy,
  expanded,
  reviewing,
  onToggle,
  onRevoke,
  onCancelReview,
}: {
  kind: ApprovalKind;
  symbol: string;
  logoURI?: string;
  amount: string;
  unlimited: boolean;
  assetLabel: string;
  assetAddr: string;
  spenderLabel: string;
  spenderAddr: string;
  lastTx?: string;
  extra?: { label: string; value: ReactNode };
  chainId: number;
  busy: boolean;
  expanded: boolean;
  reviewing: boolean;
  onToggle: () => void;
  onRevoke: () => void;
  onCancelReview: () => void;
}) {
  const txUrl = lastTx ? txExplorerLink(chainId, lastTx) : undefined;
  return (
    <li className={`w1337-approvals__item${expanded ? ' w1337-approvals__item--open' : ''}`}>
      <div className="w1337-approvals__row">
        <button
          type="button"
          className="w1337-approvals__main"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          {logoURI || kind === 'token' || kind === 'permit2' ? (
            <LiFiIcon logoURI={logoURI} label={symbol} size={32} rounded />
          ) : (
            <span className="w1337-approvals__nft-mark" aria-hidden>
              NFT
            </span>
          )}
          <div className="w1337-approvals__meta">
            <span className="w1337-approvals__token-symbol">{symbol}</span>
            <span className="w1337-approvals__kind">{KIND_LABEL[kind]}</span>
          </div>
          <span
            className={`w1337-approvals__amt${unlimited ? ' w1337-approvals__allowance--warn' : ''}`}
          >
            {amount}
          </span>
        </button>
        <button
          type="button"
          className="w1337-approvals__revoke"
          disabled={busy}
          onClick={onRevoke}
        >
          {busy ? '…' : reviewing ? 'Confirm' : 'Revoke'}
        </button>
        <button
          type="button"
          className="w1337-approvals__toggle"
          aria-expanded={expanded}
          aria-label={expanded ? 'Hide approval details' : 'Show approval details'}
          onClick={onToggle}
        >
          {expanded ? '−' : '+'}
        </button>
      </div>
      {expanded ? (
        <dl className="w1337-approvals__facts">
          <ApprovalFact label="Type">{KIND_LABEL[kind]}</ApprovalFact>
          <ApprovalFact label={assetLabel}>
            <ExplorerAddr chainId={chainId} address={assetAddr} />
          </ApprovalFact>
          <ApprovalFact label={spenderLabel}>
            <ExplorerAddr chainId={chainId} address={spenderAddr} />
          </ApprovalFact>
          {extra ? <ApprovalFact label={extra.label}>{extra.value}</ApprovalFact> : null}
          {txUrl ? (
            <ApprovalFact label="Last tx">
              <a className="w1337-approvals__link" href={txUrl} target="_blank" rel="noopener noreferrer">
                View <ExternalLinkIcon />
              </a>
            </ApprovalFact>
          ) : null}
        </dl>
      ) : null}
      {reviewing ? (
        <div className="w1337-approvals__confirm">
          <p className="muted">Instant is off. Review this revoke, then confirm to sign.</p>
          <button type="button" className="ghost" onClick={onCancelReview}>
            Cancel
          </button>
        </div>
      ) : null}
    </li>
  );
}

export function ApprovalsPanel({ settings }: { settings: AppSettings }) {
  const account = getUnlockedAccount();
  const addr = account ? getAddress(account.address) : null;
  const meta = getActiveAccountMeta();
  const hw = Boolean(meta && isHardwareAccount(meta));
  const needsConfirm = shouldConfirmInWalletSend(settings) && !hw;
  const chainId = effectiveActiveChainId(settings);
  const chain = chainById(chainId);
  const apiKey = settings.explorerApiKey?.trim();
  const chainLogo = chain ? chainLogoUri(chain) : undefined;

  const [walletTokens, setWalletTokens] = useState<WalletBalEntry[]>([]);
  const [tokenRows, setTokenRows] = useState<TokenApprovalRow[]>([]);
  const [nftRows, setNftRows] = useState<NftApprovalRow[]>([]);
  const [permitRows, setPermitRows] = useState<Permit2ApprovalRow[]>([]);
  const [scannedTokens, setScannedTokens] = useState<string[]>([]);
  const [scanningTokens, setScanningTokens] = useState<string[]>([]);
  const [tokenFrom, setTokenFrom] = useState<number | null>(null);
  const [nftFrom, setNftFrom] = useState<number | null>(null);
  const [permitFrom, setPermitFrom] = useState<number | null>(null);
  const [permitAvailable, setPermitAvailable] = useState(true);
  const [latestBlock, setLatestBlock] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [revokingKey, setRevokingKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [olderNote, setOlderNote] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [reviewingKey, setReviewingKey] = useState<string | null>(null);
  const scanningRef = useRef(false);

  useEffect(() => {
    if (!needsConfirm) setReviewingKey(null);
  }, [needsConfirm]);

  function requestRevoke(key: string, run: () => void) {
    if (needsConfirm && reviewingKey !== key) {
      setReviewingKey(key);
      setExpandedKey(key);
      setErr(null);
      return;
    }
    setReviewingKey(null);
    run();
  }

  function toggleRow(key: string) {
    const closing = expandedKey === key;
    setExpandedKey(closing ? null : key);
    if (closing || reviewingKey !== key) setReviewingKey(null);
  }

  const visibleTokens = useMemo(
    () => filterRowsForWalletTokens(tokenRows, walletTokens),
    [tokenRows, walletTokens],
  );
  const unscanned = useMemo(
    () => findUnscannedTokens(walletTokens, scannedTokens),
    [walletTokens, scannedTokens],
  );

  const persistTokens = useCallback(
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

  const persistNfts = useCallback(
    async (next: { rows: NftApprovalRow[]; fromBlock: number }) => {
      if (!addr) return;
      await saveNftApprovalsCache(chainId, addr, {
        rows: next.rows,
        fromBlock: next.fromBlock,
        updatedAt: Date.now(),
      });
    },
    [addr, chainId],
  );

  const persistPermit = useCallback(
    async (next: { rows: Permit2ApprovalRow[]; fromBlock: number; available: boolean }) => {
      if (!addr) return;
      await savePermit2ApprovalsCache(chainId, addr, {
        rows: next.rows,
        fromBlock: next.fromBlock,
        available: next.available,
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
      if (!addr || tokens.length === 0) return [];
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
        setTokenRows(prev => {
          nextRows = mergeApprovalRows(prev, incoming);
          return nextRows;
        });
        let nextScanned: string[] = [];
        setScannedTokens(prev => {
          nextScanned = [...new Set([...prev, ...tokens.map(walletTokenKey)])];
          return nextScanned;
        });
        let nextFrom = win.fromBlock;
        setTokenFrom(prev => {
          nextFrom = prev == null ? win.fromBlock : Math.min(prev, win.fromBlock);
          return nextFrom;
        });
        await persistTokens({
          rows: nextRows,
          scannedTokenAddresses: nextScanned,
          fromBlock: nextFrom,
        });
        return incoming;
      } finally {
        setScanningTokens([]);
      }
    },
    [addr, apiKey, chainId, persistTokens],
  );

  const loadInitial = useCallback(async () => {
    if (!addr) return;
    if (needsExplorerApiKey(chainId) && !apiKey) {
      setWalletTokens([]);
      setTokenRows([]);
      setNftRows([]);
      setPermitRows([]);
      setScannedTokens([]);
      setHydrated(true);
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      const [tokenCached, nftCached, permitCached, latest] = await Promise.all([
        loadTokenApprovalsCache(chainId, addr),
        loadNftApprovalsCache(chainId, addr),
        loadPermit2ApprovalsCache(chainId, addr),
        getLatestBlockNumber(chainId).catch(() => null),
      ]);
      if (latest != null) setLatestBlock(latest);

      if (tokenCached) {
        setTokenRows(tokenCached.rows);
        setScannedTokens(tokenCached.scannedTokenAddresses);
        setTokenFrom(tokenCached.fromBlock);
      }
      if (nftCached) {
        setNftRows(nftCached.rows);
        setNftFrom(nftCached.fromBlock);
      }
      if (permitCached) {
        setPermitFrom(permitCached.fromBlock);
        setPermitAvailable(permitCached.available);
        setPermitRows(permitCached.available ? permitCached.rows : []);
      }

      const bals = await loadBalances();
      const win = tokenCached && nftCached && permitCached ? null : await recentApprovalWindow(chainId);

      const tokenLive = tokenCached?.rows.length
        ? refreshLiveAllowances({
            chainId,
            owner: addr,
            rows: filterRowsForWalletTokens(tokenCached.rows, bals),
          }).then(async refreshed => {
            setTokenRows(refreshed);
            await persistTokens({
              rows: refreshed,
              scannedTokenAddresses: tokenCached.scannedTokenAddresses,
              fromBlock: tokenCached.fromBlock,
            });
          })
        : Promise.resolve();

      const nftLive = (async () => {
        if (nftCached) {
          const live = await refreshLiveNftApprovals({
            chainId,
            owner: addr,
            rows: nftCached.rows,
          });
          setNftRows(live);
          await persistNfts({ rows: live, fromBlock: nftCached.fromBlock });
          return;
        }
        if (!win) return;
        const incoming = await scanNftApprovals({
          chainId,
          owner: addr,
          fromBlock: win.fromBlock,
          toBlock: win.toBlock,
          explorerApiKey: apiKey,
        });
        setNftRows(incoming);
        setNftFrom(win.fromBlock);
        await persistNfts({ rows: incoming, fromBlock: win.fromBlock });
      })();

      const permitLive = (async () => {
        if (permitCached) {
          if (!permitCached.available) {
            setPermitRows([]);
            return;
          }
          const live = await refreshLivePermit2Approvals({
            chainId,
            owner: addr,
            rows: permitCached.rows,
          });
          setPermitRows(live);
          await persistPermit({
            rows: live,
            fromBlock: permitCached.fromBlock,
            available: true,
          });
          return;
        }
        if (!win) return;
        const next = await scanPermit2Approvals({
          chainId,
          owner: addr,
          fromBlock: win.fromBlock,
          toBlock: win.toBlock,
          explorerApiKey: apiKey,
        });
        setPermitRows(next.rows);
        setPermitAvailable(next.available);
        setPermitFrom(win.fromBlock);
        await persistPermit({
          rows: next.rows,
          fromBlock: win.fromBlock,
          available: next.available,
        });
      })();

      await Promise.all([tokenLive, nftLive, permitLive]);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
      setHydrated(true);
    }
  }, [addr, apiKey, chainId, loadBalances, persistNfts, persistPermit, persistTokens]);

  useEffect(() => {
    setHydrated(false);
    setTokenRows([]);
    setNftRows([]);
    setPermitRows([]);
    setScannedTokens([]);
    setTokenFrom(null);
    setNftFrom(null);
    setPermitFrom(null);
    setLatestBlock(null);
    setWalletTokens([]);
    setOlderNote(null);
    setExpandedKey(null);
    setReviewingKey(null);
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
    if (!addr || scanningRef.current) return;
    const tokenWin = tokenFrom != null ? olderApprovalWindow(chainId, tokenFrom) : null;
    const nftWin = nftFrom != null ? olderApprovalWindow(chainId, nftFrom) : null;
    const permitWin = permitFrom != null ? olderApprovalWindow(chainId, permitFrom) : null;
    if (!tokenWin && !nftWin && !permitWin) return;
    scanningRef.current = true;
    setBusy(true);
    setErr(null);
    setOlderNote(null);
    try {
      const existingToken = new Set(
        tokenRows.map(r => `${r.token.toLowerCase()}:${r.spender.toLowerCase()}`),
      );
      const existingNft = new Set(
        nftRows.map(r => `${r.contract.toLowerCase()}:${r.operator.toLowerCase()}`),
      );
      const existingPermit = new Set(
        permitRows.map(r => `${r.token.toLowerCase()}:${r.spender.toLowerCase()}`),
      );
      let found = 0;

      const bals = walletTokens.length > 0 ? walletTokens : await loadBalances();
      const jobs: Promise<void>[] = [];
      if (tokenWin) {
        jobs.push(
          (async () => {
            const incoming = (await scanTokens(bals, { window: tokenWin })) ?? [];
            found += incoming.filter(
              r => !existingToken.has(`${r.token.toLowerCase()}:${r.spender.toLowerCase()}`),
            ).length;
          })(),
        );
      }
      if (nftWin) {
        jobs.push(
          (async () => {
            const incoming = await scanNftApprovals({
              chainId,
              owner: addr,
              fromBlock: nftWin.fromBlock,
              toBlock: nftWin.toBlock,
              explorerApiKey: apiKey,
            });
            const merged = mergeNftApprovalRows(nftRows, incoming);
            const nextFrom = nftFrom == null ? nftWin.fromBlock : Math.min(nftFrom, nftWin.fromBlock);
            setNftRows(merged);
            setNftFrom(nextFrom);
            await persistNfts({ rows: merged, fromBlock: nextFrom });
            found += incoming.filter(
              r => !existingNft.has(`${r.contract.toLowerCase()}:${r.operator.toLowerCase()}`),
            ).length;
          })(),
        );
      }
      if (permitWin && permitAvailable) {
        jobs.push(
          (async () => {
            const next = await scanPermit2Approvals({
              chainId,
              owner: addr,
              fromBlock: permitWin.fromBlock,
              toBlock: permitWin.toBlock,
              explorerApiKey: apiKey,
            });
            setPermitAvailable(next.available);
            if (!next.available) {
              setPermitRows([]);
              await persistPermit({ rows: [], fromBlock: permitWin.fromBlock, available: false });
              return;
            }
            const merged = mergePermit2ApprovalRows(permitRows, next.rows);
            const nextFrom =
              permitFrom == null ? permitWin.fromBlock : Math.min(permitFrom, permitWin.fromBlock);
            setPermitRows(merged);
            setPermitFrom(nextFrom);
            await persistPermit({ rows: merged, fromBlock: nextFrom, available: true });
            found += next.rows.filter(
              r => !existingPermit.has(`${r.token.toLowerCase()}:${r.spender.toLowerCase()}`),
            ).length;
          })(),
        );
      }
      await Promise.all(jobs);
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

  async function onRevokeToken(row: TokenApprovalRow) {
    const key = `token:${row.token}:${row.spender}`;
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
      setTokenRows(prev => {
        const next = prev.filter(
          r =>
            !(
              r.token.toLowerCase() === row.token.toLowerCase() &&
              r.spender.toLowerCase() === row.spender.toLowerCase()
            ),
        );
        void persistTokens({
          rows: next,
          scannedTokenAddresses: scannedTokens,
          fromBlock: tokenFrom ?? 0,
        });
        return next;
      });
      if (expandedKey === key) setExpandedKey(null);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setRevokingKey(null);
    }
  }

  async function onRevokeNft(row: NftApprovalRow) {
    const key = `nft:${row.contract}:${row.operator}`;
    setRevokingKey(key);
    setErr(null);
    try {
      const hash = await revokeNftApprovalForAll({
        chainId,
        contract: row.contract,
        operator: row.operator,
      });
      if (hash) await waitForChainReceipt(hash, chainId);
      setNftRows(prev => {
        const next = prev.filter(
          r =>
            !(
              r.contract.toLowerCase() === row.contract.toLowerCase() &&
              r.operator.toLowerCase() === row.operator.toLowerCase()
            ),
        );
        if (nftFrom != null) void persistNfts({ rows: next, fromBlock: nftFrom });
        return next;
      });
      if (expandedKey === key) setExpandedKey(null);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setRevokingKey(null);
    }
  }

  async function onRevokePermit(row: Permit2ApprovalRow) {
    const key = `permit2:${row.token}:${row.spender}`;
    setRevokingKey(key);
    setErr(null);
    try {
      const hash = await revokePermit2Allowance({
        chainId,
        token: row.token,
        spender: row.spender,
      });
      if (hash) await waitForChainReceipt(hash, chainId);
      setPermitRows(prev => {
        const next = prev.filter(
          r =>
            !(
              r.token.toLowerCase() === row.token.toLowerCase() &&
              r.spender.toLowerCase() === row.spender.toLowerCase()
            ),
        );
        if (permitFrom != null) {
          void persistPermit({ rows: next, fromBlock: permitFrom, available: permitAvailable });
        }
        return next;
      });
      if (expandedKey === key) setExpandedKey(null);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setRevokingKey(null);
    }
  }

  if (!addr) {
    return <p className="w1337-tools-empty muted">Unlock wallet to view approvals.</p>;
  }

  if (needsExplorerApiKey(chainId) && !apiKey) {
    return (
      <p className="w1337-tools-empty muted">
        Add an <strong>Etherscan API key</strong> in Settings to scan approvals on{' '}
        {chain?.name ?? chainId}. Optimism, Base, and other Blockscout-backed chains work without a
        key.
      </p>
    );
  }

  const scanningLabel =
    scanningTokens.length > 0
      ? `Scanning ${scanningTokens.length} token${scanningTokens.length === 1 ? '' : 's'}…`
      : null;
  const fromCandidates = [tokenFrom, nftFrom, permitFrom].filter((n): n is number => n != null);
  const fromBlock = fromCandidates.length ? Math.min(...fromCandidates) : null;
  const scannedDays =
    fromBlock != null && latestBlock != null
      ? scannedLookbackDays(chainId, latestBlock, fromBlock)
      : fromBlock != null
        ? APPROVAL_LOG_LOOKBACK_DAYS
        : null;
  const scanBusy = busy || scanningTokens.length > 0;
  const total =
    visibleTokens.length + nftRows.length + (permitAvailable ? permitRows.length : 0);
  const empty = hydrated && !busy && scanningTokens.length === 0 && total === 0 && !err;

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
              {total > 0
                ? `${total} active approval${total === 1 ? '' : 's'}`
                : 'Approvals'}
              {scannedDays != null ? ` · ~${scannedDays} days` : ''}
            </p>
          </div>
        </div>
      </div>

      {err ? <p className="error">{err}</p> : null}
      {scanningLabel ? <p className="w1337-tools-empty muted">{scanningLabel}</p> : null}

      {!hydrated || (busy && total === 0 && scanningTokens.length === 0) ? (
        <p className="w1337-tools-empty muted">Loading approvals…</p>
      ) : null}

      {empty ? (
        <p className="w1337-tools-empty muted">
          {walletTokens.length === 0
            ? 'No tokens in wallet on this network.'
            : 'No active approvals found.'}
        </p>
      ) : null}

      {total > 0 ? (
        <ul className="w1337-approvals__list">
          {visibleTokens.map(row => {
            const key = `token:${row.token}:${row.spender}`;
            return (
              <CompactApprovalItem
                key={key}
                kind="token"
                symbol={row.tokenSymbol}
                logoURI={row.tokenLogo}
                amount={formatAllowance(row.allowance, row.tokenDecimals, row.unlimited)}
                unlimited={row.unlimited}
                assetLabel="Token"
                assetAddr={row.token}
                spenderLabel="Spender"
                spenderAddr={row.spender}
                lastTx={row.lastApprovalTx}
                chainId={chainId}
                busy={revokingKey === key}
                expanded={expandedKey === key}
                reviewing={reviewingKey === key}
                onToggle={() => toggleRow(key)}
                onRevoke={() => requestRevoke(key, () => void onRevokeToken(row))}
                onCancelReview={() => setReviewingKey(null)}
              />
            );
          })}
          {permitAvailable
            ? permitRows.map(row => {
                const key = `permit2:${row.token}:${row.spender}`;
                return (
                  <CompactApprovalItem
                    key={key}
                    kind="permit2"
                    symbol={row.tokenSymbol}
                    amount={formatAllowance(row.amount, row.tokenDecimals, row.unlimited)}
                    unlimited={row.unlimited}
                    assetLabel="Token"
                    assetAddr={row.token}
                    spenderLabel="Spender"
                    spenderAddr={row.spender}
                    lastTx={row.lastApprovalTx}
                    extra={{
                      label: 'Expires',
                      value: formatPermit2Expiration(row.expiration),
                    }}
                    chainId={chainId}
                    busy={revokingKey === key}
                    expanded={expandedKey === key}
                    reviewing={reviewingKey === key}
                    onToggle={() => toggleRow(key)}
                    onRevoke={() => requestRevoke(key, () => void onRevokePermit(row))}
                    onCancelReview={() => setReviewingKey(null)}
                  />
                );
              })
            : null}
          {nftRows.map(row => {
            const key = `nft:${row.contract}:${row.operator}`;
            const symbol = row.symbol || row.collectionName;
            return (
              <CompactApprovalItem
                key={key}
                kind="nft"
                symbol={symbol}
                amount="All"
                unlimited
                assetLabel="Collection"
                assetAddr={row.contract}
                spenderLabel="Operator"
                spenderAddr={row.operator}
                lastTx={row.lastApprovalTx}
                extra={{ label: 'Scope', value: 'Entire collection' }}
                chainId={chainId}
                busy={revokingKey === key}
                expanded={expandedKey === key}
                reviewing={reviewingKey === key}
                onToggle={() => toggleRow(key)}
                onRevoke={() => requestRevoke(key, () => void onRevokeNft(row))}
                onCancelReview={() => setReviewingKey(null)}
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
