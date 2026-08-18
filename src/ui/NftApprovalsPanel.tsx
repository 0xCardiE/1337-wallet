import { useCallback, useEffect, useState } from 'react';
import { getAddress } from 'viem';
import { getUnlockedAccount } from '../lib/accountSession';
import { chainById } from '../lib/chainCatalog';
import { revokeNftApprovalForAll, waitForChainReceipt } from '../lib/ethereum';
import { needsExplorerApiKey } from '../lib/explorerTxHistory';
import {
  mergeNftApprovalRows,
  refreshLiveNftApprovals,
  scanNftApprovals,
  type NftApprovalRow,
} from '../lib/nftApprovals';
import { loadNftApprovalsCache, saveNftApprovalsCache } from '../lib/nftApprovalsCache';
import {
  APPROVAL_LOG_LOOKBACK_DAYS,
  addressExplorerLink,
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

export function NftApprovalsPanel({ settings }: { settings: AppSettings }) {
  const account = getUnlockedAccount();
  const addr = account ? getAddress(account.address) : null;
  const chainId = effectiveActiveChainId(settings);
  const chain = chainById(chainId);
  const apiKey = settings.explorerApiKey?.trim();

  const [rows, setRows] = useState<NftApprovalRow[]>([]);
  const [fromBlock, setFromBlock] = useState<number | null>(null);
  const [latestBlock, setLatestBlock] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [revokingKey, setRevokingKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [olderNote, setOlderNote] = useState<string | null>(null);

  const persist = useCallback(
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

  const scanWindow = useCallback(
    async (windowFrom: number, windowTo: number | 'latest', existing: NftApprovalRow[]) => {
      if (!addr) return existing;
      const incoming = await scanNftApprovals({
        chainId,
        owner: addr,
        fromBlock: windowFrom,
        toBlock: windowTo,
        explorerApiKey: apiKey,
      });
      const merged = mergeNftApprovalRows(existing, incoming);
      const nextFrom = fromBlock == null ? windowFrom : Math.min(fromBlock, windowFrom);
      setRows(merged);
      setFromBlock(nextFrom);
      await persist({ rows: merged, fromBlock: nextFrom });
      return incoming;
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
        loadNftApprovalsCache(chainId, addr),
        getLatestBlockNumber(chainId).catch(() => null),
      ]);
      if (latest != null) setLatestBlock(latest);
      if (cached) {
        setFromBlock(cached.fromBlock);
        const live = await refreshLiveNftApprovals({
          chainId,
          owner: addr,
          rows: cached.rows,
        });
        setRows(live);
        await persist({ rows: live, fromBlock: cached.fromBlock });
      } else {
        const win = await recentApprovalWindow(chainId);
        const incoming = await scanNftApprovals({
          chainId,
          owner: addr,
          fromBlock: win.fromBlock,
          toBlock: win.toBlock,
          explorerApiKey: apiKey,
        });
        setRows(incoming);
        setFromBlock(win.fromBlock);
        await persist({ rows: incoming, fromBlock: win.fromBlock });
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
        rows.map(r => `${r.contract.toLowerCase()}:${r.operator.toLowerCase()}`),
      );
      const incoming = await scanWindow(win.fromBlock, win.toBlock, rows);
      const found = incoming.filter(
        r => !existingKeys.has(`${r.contract.toLowerCase()}:${r.operator.toLowerCase()}`),
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

  async function onRevoke(row: NftApprovalRow) {
    const key = `${row.contract}:${row.operator}`;
    setRevokingKey(key);
    setErr(null);
    try {
      const hash = await revokeNftApprovalForAll({
        chainId,
        contract: row.contract,
        operator: row.operator,
      });
      if (hash) await waitForChainReceipt(hash, chainId);
      setRows(prev => {
        const next = prev.filter(
          r =>
            !(
              r.contract.toLowerCase() === row.contract.toLowerCase() &&
              r.operator.toLowerCase() === row.operator.toLowerCase()
            ),
        );
        if (fromBlock != null) void persist({ rows: next, fromBlock });
        return next;
      });
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setRevokingKey(null);
    }
  }

  if (!addr) {
    return <p className="w1337-tools-empty muted">Unlock wallet to view NFT approvals.</p>;
  }
  if (needsExplorerApiKey(chainId) && !apiKey) {
    return (
      <p className="w1337-tools-empty muted">
        Add an <strong>Etherscan API key</strong> in Settings to scan NFT operators on{' '}
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
            ? `${rows.length} collection operator${rows.length === 1 ? '' : 's'}`
            : 'NFT operators'}
          {scannedDays != null ? ` · ~${scannedDays} days` : ''}
        </p>
      </div>
      {err ? <p className="error">{err}</p> : null}
      {!hydrated || (busy && rows.length === 0) ? (
        <p className="w1337-tools-empty muted">Scanning NFT operators…</p>
      ) : null}
      {hydrated && !busy && rows.length === 0 && !err ? (
        <p className="w1337-tools-empty muted">No active collection-wide NFT operators found.</p>
      ) : null}
      {rows.length > 0 ? (
        <ul className="w1337-approvals__list">
          {rows.map(row => {
            const key = `${row.contract}:${row.operator}`;
            const collectionUrl = addressExplorerLink(chainId, row.contract);
            const operatorUrl = addressExplorerLink(chainId, row.operator);
            const txUrl = row.lastApprovalTx ? txExplorerLink(chainId, row.lastApprovalTx) : undefined;
            return (
              <li key={key} className="w1337-approvals__item">
                <div className="w1337-approvals__token">
                  <span className="w1337-approvals__token-symbol">
                    {row.collectionName}
                    {row.symbol ? ` · ${row.symbol}` : ''}
                  </span>
                </div>
                <dl className="w1337-approvals__facts">
                  <ApprovalFact label="Contract">
                    {collectionUrl ? (
                      <a className="w1337-approvals__link" href={collectionUrl} target="_blank" rel="noopener noreferrer">
                        {shortAddress(row.contract)} <ExternalLinkIcon />
                      </a>
                    ) : (
                      shortAddress(row.contract)
                    )}
                  </ApprovalFact>
                  <ApprovalFact label="Operator">
                    {operatorUrl ? (
                      <a className="w1337-approvals__link" href={operatorUrl} target="_blank" rel="noopener noreferrer">
                        {shortAddress(row.operator)} <ExternalLinkIcon />
                      </a>
                    ) : (
                      shortAddress(row.operator)
                    )}
                  </ApprovalFact>
                  <ApprovalFact label="Scope">
                    <span className="w1337-approvals__allowance w1337-approvals__allowance--warn">
                      Entire collection
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
      <ApprovalsScanOlder
        scannedDays={scannedDays}
        scannedFromGenesis={fromBlock === 0}
        busy={busy}
        note={olderNote}
        onScanOlder={() => void scanOlder()}
      />
    </div>
  );
}
