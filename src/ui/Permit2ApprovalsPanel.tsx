import { useCallback, useEffect, useState } from 'react';
import { getAddress } from 'viem';
import { getUnlockedAccount } from '../lib/accountSession';
import { chainById } from '../lib/chainCatalog';
import { revokePermit2Allowance, waitForChainReceipt } from '../lib/ethereum';
import { needsExplorerApiKey } from '../lib/explorerTxHistory';
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
import {
  APPROVAL_LOG_LOOKBACK_DAYS,
  addressExplorerLink,
  formatAllowance,
  getLatestBlockNumber,
  olderApprovalWindow,
  recentApprovalWindow,
  scannedLookbackDays,
  txExplorerLink,
} from '../lib/tokenApprovals';
import { effectiveActiveChainId, type AppSettings } from '../lib/storageState';
import { describeError } from '../lib/utils';
import { ApprovalFact, ApprovalsScanOlder, ExternalLinkIcon, olderScanNote } from './ApprovalsScanOlder';

function shortAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function Permit2ApprovalsPanel({ settings }: { settings: AppSettings }) {
  const account = getUnlockedAccount();
  const addr = account ? getAddress(account.address) : null;
  const chainId = effectiveActiveChainId(settings);
  const chain = chainById(chainId);
  const apiKey = settings.explorerApiKey?.trim();

  const [rows, setRows] = useState<Permit2ApprovalRow[]>([]);
  const [fromBlock, setFromBlock] = useState<number | null>(null);
  const [latestBlock, setLatestBlock] = useState<number | null>(null);
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revokingKey, setRevokingKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [olderNote, setOlderNote] = useState<string | null>(null);

  const persist = useCallback(
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

  const scanWindow = useCallback(
    async (
      windowFrom: number,
      windowTo: number | 'latest',
      existing: Permit2ApprovalRow[],
      currentlyAvailable: boolean,
    ) => {
      if (!addr) return existing;
      const next = await scanPermit2Approvals({
        chainId,
        owner: addr,
        fromBlock: windowFrom,
        toBlock: windowTo,
        explorerApiKey: apiKey,
      });
      setAvailable(next.available);
      if (!next.available) {
        setRows([]);
        await persist({ rows: [], fromBlock: windowFrom, available: false });
        return [];
      }
      const merged = mergePermit2ApprovalRows(existing, next.rows);
      const nextFrom = fromBlock == null ? windowFrom : Math.min(fromBlock, windowFrom);
      setRows(merged);
      setFromBlock(nextFrom);
      await persist({ rows: merged, fromBlock: nextFrom, available: currentlyAvailable || next.available });
      return next.rows;
    },
    [addr, apiKey, chainId, fromBlock, persist],
  );

  const loadInitial = useCallback(async () => {
    if (!addr) return;
    if (needsExplorerApiKey(chainId) && !apiKey) {
      setRows([]);
      setHydrated(true);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const [cached, latest] = await Promise.all([
        loadPermit2ApprovalsCache(chainId, addr),
        getLatestBlockNumber(chainId).catch(() => null),
      ]);
      if (latest != null) setLatestBlock(latest);
      if (cached) {
        setFromBlock(cached.fromBlock);
        setAvailable(cached.available);
        if (!cached.available) {
          setRows([]);
        } else {
          const live = await refreshLivePermit2Approvals({
            chainId,
            owner: addr,
            rows: cached.rows,
          });
          setRows(live);
          await persist({ rows: live, fromBlock: cached.fromBlock, available: true });
        }
      } else {
        const win = await recentApprovalWindow(chainId);
        const next = await scanPermit2Approvals({
          chainId,
          owner: addr,
          fromBlock: win.fromBlock,
          toBlock: win.toBlock,
          explorerApiKey: apiKey,
        });
        setRows(next.rows);
        setAvailable(next.available);
        setFromBlock(win.fromBlock);
        await persist({
          rows: next.rows,
          fromBlock: win.fromBlock,
          available: next.available,
        });
      }
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
      setHydrated(true);
    }
  }, [addr, apiKey, chainId, persist]);

  useEffect(() => {
    setHydrated(false);
    setRows([]);
    setFromBlock(null);
    setLatestBlock(null);
    setOlderNote(null);
    void loadInitial();
  }, [loadInitial]);

  async function scanOlder() {
    if (!addr || fromBlock == null) return;
    const win = olderApprovalWindow(chainId, fromBlock);
    if (!win) return;
    setBusy(true);
    setErr(null);
    setOlderNote(null);
    try {
      const existingKeys = new Set(
        rows.map(r => `${r.token.toLowerCase()}:${r.spender.toLowerCase()}`),
      );
      const incoming = await scanWindow(win.fromBlock, win.toBlock, rows, available);
      const found = incoming.filter(
        r => !existingKeys.has(`${r.token.toLowerCase()}:${r.spender.toLowerCase()}`),
      ).length;
      setOlderNote(olderScanNote(found));
      const latest = await getLatestBlockNumber(chainId).catch(() => null);
      if (latest != null) setLatestBlock(latest);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(row: Permit2ApprovalRow) {
    const key = `${row.token}:${row.spender}`;
    setRevokingKey(key);
    setErr(null);
    try {
      const hash = await revokePermit2Allowance({
        chainId,
        token: row.token,
        spender: row.spender,
      });
      if (hash) await waitForChainReceipt(hash, chainId);
      setRows(prev => {
        const next = prev.filter(
          r =>
            !(
              r.token.toLowerCase() === row.token.toLowerCase() &&
              r.spender.toLowerCase() === row.spender.toLowerCase()
            ),
        );
        if (fromBlock != null) void persist({ rows: next, fromBlock, available });
        return next;
      });
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setRevokingKey(null);
    }
  }

  if (!addr) {
    return <p className="w1337-tools-empty muted">Unlock wallet to view Permit2 allowances.</p>;
  }
  if (needsExplorerApiKey(chainId) && !apiKey) {
    return (
      <p className="w1337-tools-empty muted">
        Add a free <strong>Etherscan API key</strong> in Settings to scan Permit2 on{' '}
        {chain?.name ?? chainId}.
      </p>
    );
  }

  const scannedDays =
    fromBlock != null && latestBlock != null
      ? scannedLookbackDays(chainId, latestBlock, fromBlock)
      : fromBlock != null
        ? APPROVAL_LOG_LOOKBACK_DAYS
        : null;

  return (
    <div className="w1337-approvals">
      <div className="w1337-tx-history__head">
        <p className="w1337-tx-history__head-sub muted">
          {rows.length > 0
            ? `${rows.length} Permit2 allowance${rows.length === 1 ? '' : 's'}`
            : 'Permit2'}
          {scannedDays != null ? ` · ~${scannedDays} days` : ''}
        </p>
      </div>
      {err ? <p className="error">{err}</p> : null}
      {hydrated && !available ? (
        <p className="w1337-tools-empty muted">Permit2 is not deployed on this network.</p>
      ) : null}
      {!hydrated || (busy && rows.length === 0 && available) ? (
        <p className="w1337-tools-empty muted">Scanning Permit2…</p>
      ) : null}
      {hydrated && !busy && available && rows.length === 0 && !err ? (
        <p className="w1337-tools-empty muted">No active Permit2 allowances found.</p>
      ) : null}
      {rows.length > 0 ? (
        <ul className="w1337-approvals__list">
          {rows.map(row => {
            const key = `${row.token}:${row.spender}`;
            const tokenUrl = addressExplorerLink(chainId, row.token);
            const spenderUrl = addressExplorerLink(chainId, row.spender);
            const txUrl = row.lastApprovalTx ? txExplorerLink(chainId, row.lastApprovalTx) : undefined;
            return (
              <li key={key} className="w1337-approvals__item">
                <div className="w1337-approvals__token">
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
                      {formatAllowance(row.amount, row.tokenDecimals, row.unlimited)}
                    </span>
                  </ApprovalFact>
                  <ApprovalFact label="Expires">{formatPermit2Expiration(row.expiration)}</ApprovalFact>
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
                  disabled={revokingKey === key}
                  onClick={() => void onRevoke(row)}
                >
                  {revokingKey === key ? '…' : 'Revoke'}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {available ? (
        <ApprovalsScanOlder
          scannedDays={scannedDays}
          scannedFromGenesis={fromBlock === 0}
          busy={busy}
          note={olderNote}
          onScanOlder={() => void scanOlder()}
        />
      ) : null}
    </div>
  );
}
