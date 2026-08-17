import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { getAddress } from 'viem';
import { getUnlockedAccount } from '../lib/accountSession';
import { effectiveActiveChainId, type AppSettings } from '../lib/storageState';
import { chainById } from '../lib/chainCatalog';
import { chainLogoUri } from '../lib/chainLogo';
import {
  fetchAddressTxHistoryPage,
  formatTxValue,
  needsExplorerApiKey,
  txExplorerLink,
  TX_HISTORY_PAGE_SIZE,
  type TxHistoryRow,
} from '../lib/explorerTxHistory';
import {
  clearTxHistoryCache,
  loadTxHistoryCache,
  mergeTxRows,
  saveTxHistoryCache,
} from '../lib/txHistoryCursor';
import {
  failureDetailAsText,
  fetchTxFailureDetail,
  type TxFailureDetail,
} from '../lib/txFailureDetail';
import { humanizeHistoryRow } from '../lib/txHumanize';
import { describeError } from '../lib/utils';
import { LiFiIcon } from './LiFiIcon';
import { RefreshIconButton } from './RefreshIconButton';

type TxKind = 'sent' | 'received' | 'self' | 'contract';

type DateGroup = {
  label: string;
  rows: TxHistoryRow[];
};

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDateGroupLabel(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(d, now)) return 'Today';
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function groupRowsByDate(rows: TxHistoryRow[]): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const row of rows) {
    const label = formatDateGroupLabel(row.timestamp);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  }
  return groups;
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

function txKind(row: TxHistoryRow): TxKind {
  if (row.direction === 'self') return 'self';
  if (row.value === 0n && row.to) return 'contract';
  if (row.direction === 'in') return 'received';
  return 'sent';
}


function formatAmount(row: TxHistoryRow, chainId: number): string | null {
  if (row.value === 0n) return null;
  const formatted = formatTxValue(row.value, chainId);
  if (row.direction === 'in') return `+${formatted}`;
  if (row.direction === 'out' || row.direction === 'self') return `-${formatted}`;
  return formatted;
}

function explorerName(chainId: number): string {
  const url = chainById(chainId)?.blockExplorerUrls[0];
  if (!url) return 'Explorer';
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('etherscan')) return 'Etherscan';
    if (host.includes('basescan')) return 'Basescan';
    if (host.includes('arbiscan')) return 'Arbiscan';
    if (host.includes('polygonscan')) return 'Polygonscan';
    if (host.includes('optimistic')) return 'Optimistic Etherscan';
    if (host.includes('bscscan')) return 'BscScan';
    const base = host.split('.')[0];
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return 'Explorer';
  }
}

function TxDirectionIcon({ kind }: { kind: TxKind }) {
  const cls = `w1337-tx-history__dir-icon w1337-tx-history__dir-icon--${kind}`;
  if (kind === 'received') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'sent') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'self') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M7 10h10M7 14h10M12 7v10" strokeLinecap="round" />
        <path d="M4 4h16v16H4z" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 9h8M8 13h6M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" strokeLinejoin="round" />
    </svg>
  );
}

const ROW_CLICK_DELAY_MS = 250;

function DetailRow({
  label,
  value,
  mono,
  copyable,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  if (value == null || value === '') return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value!);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="w1337-tx-fail__row">
      <span className="w1337-tx-fail__label">{label}</span>
      <div className="w1337-tx-fail__value-wrap">
        <span className={`w1337-tx-fail__value${mono ? ' mono' : ''}`}>{value}</span>
        {copyable ? (
          <button type="button" className="w1337-tx-fail__copy" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FailedTxDetail({
  chainId,
  row,
  explorerLabel,
}: {
  chainId: number;
  row: TxHistoryRow;
  explorerLabel: string;
}) {
  const [detail, setDetail] = useState<TxFailureDetail | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const url = txExplorerLink(chainId, row.hash);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setErr(null);
    void fetchTxFailureDetail(chainId, row)
      .then(d => {
        if (!cancelled) setDetail(d);
      })
      .catch(e => {
        if (!cancelled) setErr(describeError(e));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chainId, row]);

  async function copyAll() {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(failureDetailAsText(detail));
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="w1337-tx-fail">
      <div className="w1337-tx-fail__banner">
        <strong>Transaction failed</strong>
        {busy ? <span className="muted"> Decoding revert…</span> : null}
        {!busy && detail?.revertReason ? (
          <p className="w1337-tx-fail__reason">{detail.revertReason}</p>
        ) : null}
        {!busy && !detail?.revertReason && !err ? (
          <p className="w1337-tx-fail__reason muted">
            No revert string recovered — see RPC / calldata below.
          </p>
        ) : null}
        {err ? <p className="error">{err}</p> : null}
      </div>

      {detail ? (
        <div className="w1337-tx-fail__grid">
          <DetailRow label="Status" value={detail.status} />
          <DetailRow
            label="Hash"
            value={detail.hash}
            mono
            copyable
          />
          <DetailRow label="Block" value={detail.blockNumber != null ? String(detail.blockNumber) : null} />
          <DetailRow label="Nonce" value={detail.nonce != null ? String(detail.nonce) : null} />
          <DetailRow label="From" value={detail.from} mono copyable />
          <DetailRow label="To" value={detail.to} mono copyable />
          <DetailRow label="Value" value={detail.valueEth ?? detail.valueWei} />
          <DetailRow
            label="Function"
            value={detail.explorerHint ?? row.functionName ?? null}
          />
          <DetailRow label="Method ID" value={detail.methodId} mono copyable />
          <DetailRow label="Revert selector" value={detail.revertSelector} mono copyable />
          <DetailRow
            label="Gas used"
            value={
              detail.gasUsed
                ? `${detail.gasUsed}${detail.gasUsedPct ? ` (${detail.gasUsedPct} of limit)` : ''}`
                : row.gasUsed?.toString() ?? null
            }
          />
          <DetailRow label="Gas limit" value={detail.gasLimit ?? row.gasLimit?.toString() ?? null} />
          <DetailRow label="Gas price" value={detail.effectiveGasPriceGwei} />
          <DetailRow
            label="Out of gas?"
            value={detail.likelyOutOfGas ? 'Likely yes (≥98% gas used)' : 'Unlikely'}
          />
          <DetailRow label="Revert data" value={detail.revertData} mono copyable />
          <DetailRow
            label="Calldata"
            value={
              detail.input
                ? `${detail.input.slice(0, 98)}${detail.input.length > 98 ? '…' : ''} (${detail.inputLen ?? 0} B)`
                : null
            }
            mono
            copyable
          />
          {detail.input && detail.input.length > 98 ? (
            <details className="w1337-tx-fail__raw">
              <summary>Full calldata</summary>
              <pre className="mono">{detail.input}</pre>
            </details>
          ) : null}
          {detail.rpcError ? (
            <details className="w1337-tx-fail__raw" open>
              <summary>RPC error</summary>
              <pre>{detail.rpcError}</pre>
            </details>
          ) : null}
        </div>
      ) : null}

      <div className="w1337-tx-fail__actions">
        <button type="button" className="w1337-tx-fail__btn" disabled={!detail} onClick={() => void copyAll()}>
          {copiedAll ? 'Copied debug dump' : 'Copy all for debug'}
        </button>
        {url ? (
          <a className="w1337-tx-fail__btn w1337-tx-fail__btn--link" href={url} target="_blank" rel="noopener noreferrer">
            Open on {explorerLabel}
          </a>
        ) : null}
      </div>
    </div>
  );
}

function TxHistoryRowItem({
  row,
  chainId,
  chainName,
  chainLogo,
  explorerLabel,
  expanded,
  onToggle,
}: {
  row: TxHistoryRow;
  chainId: number;
  chainName: string;
  chainLogo: string;
  explorerLabel: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const kind = txKind(row);
  const { title, subtitle } = humanizeHistoryRow(row, chainId);
  const amount = formatAmount(row, chainId);
  const url = txExplorerLink(chainId, row.hash);
  const failed = !row.success;
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    },
    [],
  );

  function handleClick() {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      onToggle();
    }, ROW_CLICK_DELAY_MS);
  }

  function handleDoubleClick(e: MouseEvent) {
    e.preventDefault();
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <li className={`w1337-tx-history__item${failed ? ' w1337-tx-history__item--failed' : ''}${expanded ? ' w1337-tx-history__item--open' : ''}`}>
      <button
        type="button"
        className="w1337-tx-history__row-btn"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        aria-expanded={expanded}
        title={url ? `Double-click to open on ${explorerLabel}` : undefined}
      >
        <div className="w1337-tx-history__icon-wrap">
          <span className={`w1337-tx-history__icon w1337-tx-history__icon--${kind}`}>
            <TxDirectionIcon kind={kind} />
          </span>
          <span className="w1337-tx-history__chain-badge" title={chainName}>
            <LiFiIcon logoURI={chainLogo} label={chainName} size={14} rounded />
          </span>
        </div>

        <div className="w1337-tx-history__main">
          <span className="w1337-tx-history__title">{title}</span>
          <span className="w1337-tx-history__subtitle">{subtitle}</span>
          {failed ? (
            <span className="w1337-tx-history__failed-tag">
              Failed{row.methodId ? ` · ${row.methodId}` : ''} · tap for details
            </span>
          ) : null}
        </div>

        <div className="w1337-tx-history__right">
          {amount ? (
            <span
              className={`w1337-tx-history__amount${
                row.direction === 'in' ? ' w1337-tx-history__amount--in' : ''
              }`}
            >
              {amount}
            </span>
          ) : (
            <span className="w1337-tx-history__amount w1337-tx-history__amount--empty">—</span>
          )}
          <span className="w1337-tx-history__time">
            {new Date(row.timestamp).toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
        </div>
      </button>

      {expanded ? (
        <div className="w1337-tx-history__detail">
          {failed ? (
            <FailedTxDetail chainId={chainId} row={row} explorerLabel={explorerLabel} />
          ) : (
            <div className="w1337-tx-fail w1337-tx-fail--ok">
              <DetailRow label="Hash" value={row.hash} mono copyable />
              <DetailRow label="Block" value={row.blockNumber != null ? String(row.blockNumber) : null} />
              <DetailRow label="Nonce" value={row.nonce != null ? String(row.nonce) : null} />
              <DetailRow label="From" value={row.from} mono copyable />
              <DetailRow label="To" value={row.to} mono copyable />
              <DetailRow label="Function" value={row.functionName} />
              <DetailRow label="Method ID" value={row.methodId} mono copyable />
              <DetailRow
                label="Gas used"
                value={
                  row.gasUsed != null
                    ? `${row.gasUsed.toString()}${
                        row.gasLimit
                          ? ` (${((Number(row.gasUsed) / Number(row.gasLimit)) * 100).toFixed(1)}%)`
                          : ''
                      }`
                    : null
                }
              />
              <p className="w1337-tx-fail__hint muted">
                {shortHash(row.hash)}
                {url ? (
                  <>
                    {' '}
                    ·{' '}
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {explorerLabel}
                    </a>
                  </>
                ) : null}
              </p>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}

export function HistoryPanel({ settings }: { settings: AppSettings }) {
  const account = getUnlockedAccount();
  const addr = account ? getAddress(account.address) : null;
  const chainId = effectiveActiveChainId(settings);
  const chain = chainById(chainId);
  const apiKey = settings.explorerApiKey?.trim();
  const chainLogo = chain ? chainLogoUri(chain) : undefined;
  const explorerLabel = explorerName(chainId);

  const [rows, setRows] = useState<TxHistoryRow[]>([]);
  const [pagesLoaded, setPagesLoaded] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [expandedHash, setExpandedHash] = useState<string | null>(null);

  const grouped = useMemo(() => groupRowsByDate(rows), [rows]);
  const failedCount = useMemo(() => rows.filter(r => !r.success).length, [rows]);

  const persist = useCallback(
    async (nextRows: TxHistoryRow[], pages: number, more: boolean) => {
      if (!addr) return;
      await saveTxHistoryCache(chainId, addr, {
        rows: nextRows,
        pagesLoaded: pages,
        hasMore: more,
      });
    },
    [addr, chainId],
  );

  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      if (!addr) return;
      const { rows: batch, hasMore: more } = await fetchAddressTxHistoryPage({
        chainId,
        address: addr,
        explorerApiKey: apiKey,
        page,
      });
      let nextRows: TxHistoryRow[] = batch;
      setRows(prev => {
        nextRows = append ? mergeTxRows(prev, batch) : batch;
        return nextRows;
      });
      setPagesLoaded(page);
      setHasMore(more);
      await persist(nextRows, page, more);
    },
    [addr, apiKey, chainId, persist],
  );

  const loadInitial = useCallback(async () => {
    if (!addr) return;
    if (needsExplorerApiKey(chainId) && !apiKey) {
      setRows([]);
      setPagesLoaded(0);
      setHasMore(false);
      setErr(null);
      setHydrated(true);
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      const cached = await loadTxHistoryCache(chainId, addr);
      if (cached && cached.rows.length > 0) {
        setRows(cached.rows);
        setPagesLoaded(cached.pagesLoaded);
        setHasMore(cached.hasMore);
        setHydrated(true);
        return;
      }
      await fetchPage(1, false);
    } catch (e) {
      setErr(describeError(e));
      setRows([]);
      setPagesLoaded(0);
      setHasMore(false);
    } finally {
      setBusy(false);
      setHydrated(true);
    }
  }, [addr, apiKey, chainId, fetchPage]);

  useEffect(() => {
    setHydrated(false);
    setExpandedHash(null);
    void loadInitial();
  }, [chainId, addr, apiKey]);

  async function loadMore() {
    if (!addr || !hasMore || loadingMore) return;
    setLoadingMore(true);
    setErr(null);
    try {
      await fetchPage(pagesLoaded + 1, true);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setLoadingMore(false);
    }
  }

  async function refreshLatest() {
    if (!addr) return;
    setBusy(true);
    setErr(null);
    setExpandedHash(null);
    try {
      await clearTxHistoryCache(chainId, addr);
      setRows([]);
      setPagesLoaded(0);
      setHasMore(false);
      await fetchPage(1, false);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!addr) {
    return <p className="w1337-tools-empty muted">Unlock wallet to view transaction history.</p>;
  }

  if (needsExplorerApiKey(chainId) && !apiKey) {
    return (
      <p className="w1337-tools-empty muted">
        Add a free <strong>Etherscan API key</strong> in Settings to load transaction history on{' '}
        {chain?.name ?? chainId}. One key works across Etherscan-family chains (Ethereum, Base,
        Arbitrum, …).
      </p>
    );
  }

  return (
    <div className="w1337-tx-history">
      <div className="w1337-tx-history__head">
        <div className="w1337-tx-history__head-main">
          {chainLogo ? (
            <LiFiIcon logoURI={chainLogo} label={chain?.name} size={28} rounded />
          ) : null}
          <div>
            <p className="w1337-tx-history__head-title">{chain?.name ?? `Chain ${chainId}`}</p>
            <p className="w1337-tx-history__head-sub muted">
              {rows.length > 0
                ? `${rows.length} tx${rows.length === 1 ? '' : 's'}${
                    failedCount ? ` · ${failedCount} failed` : ''
                  }`
                : 'Activity'}
              {pagesLoaded > 1 ? ` · ${pagesLoaded} pages` : ''}
            </p>
          </div>
        </div>
        <RefreshIconButton
          busy={busy}
          ariaLabel="Refresh transaction history"
          onClick={() => void refreshLatest()}
        />
      </div>

      {err ? <p className="error">{err}</p> : null}

      {!hydrated || (busy && rows.length === 0) ? (
        <p className="w1337-tools-empty muted">Loading transactions…</p>
      ) : null}

      {hydrated && !busy && rows.length === 0 && !err ? (
        <p className="w1337-tools-empty muted">No transactions found for this address on this network.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="w1337-tx-history__groups">
          {grouped.map(group => (
            <section key={group.label} className="w1337-tx-history__group">
              <h3 className="w1337-tx-history__date">{group.label}</h3>
              <ul className="w1337-tx-history__list">
                {group.rows.map(row => (
                  <TxHistoryRowItem
                    key={row.hash}
                    row={row}
                    chainId={chainId}
                    chainName={chain?.name ?? String(chainId)}
                    chainLogo={chainLogo ?? ''}
                    explorerLabel={explorerLabel}
                    expanded={expandedHash === row.hash}
                    onToggle={() =>
                      setExpandedHash(prev => (prev === row.hash ? null : row.hash))
                    }
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      {hasMore ? (
        <button
          type="button"
          className="w1337-tx-history__load-more"
          disabled={loadingMore || busy}
          onClick={() => void loadMore()}
        >
          {loadingMore ? 'Loading…' : `Load ${TX_HISTORY_PAGE_SIZE} more`}
        </button>
      ) : rows.length > 0 ? (
        <p className="w1337-tx-history__end muted">End of loaded history</p>
      ) : null}
    </div>
  );
}
