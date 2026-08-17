import { useCallback, useEffect, useState } from 'react';
import { getAddress } from 'viem';
import { getUnlockedAccount } from '../lib/accountSession';
import { chainById } from '../lib/chainCatalog';
import { revokeNftApprovalForAll, waitForChainReceipt } from '../lib/ethereum';
import { needsExplorerApiKey } from '../lib/explorerTxHistory';
import { scanNftApprovals, type NftApprovalRow } from '../lib/nftApprovals';
import { APPROVAL_LOG_LOOKBACK_DAYS, addressExplorerLink, txExplorerLink } from '../lib/tokenApprovals';
import { effectiveActiveChainId, type AppSettings } from '../lib/storageState';
import { describeError } from '../lib/utils';
import { RefreshIconButton } from './RefreshIconButton';

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
  const [busy, setBusy] = useState(false);
  const [revokingKey, setRevokingKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const load = useCallback(async () => {
    if (!addr) return;
    if (needsExplorerApiKey(chainId) && !apiKey) {
      setRows([]);
      setHydrated(true);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      setRows(await scanNftApprovals({ chainId, owner: addr, explorerApiKey: apiKey }));
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
      setHydrated(true);
    }
  }, [addr, apiKey, chainId]);

  useEffect(() => {
    setHydrated(false);
    setRows([]);
    void load();
  }, [load]);

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
      setRows(prev =>
        prev.filter(
          r =>
            !(
              r.contract.toLowerCase() === row.contract.toLowerCase() &&
              r.operator.toLowerCase() === row.operator.toLowerCase()
            ),
        ),
      );
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
        Add a free <strong>Etherscan API key</strong> in Settings to scan NFT operators on{' '}
        {chain?.name ?? chainId}.
      </p>
    );
  }

  return (
    <div className="w1337-approvals">
      <div className="w1337-tx-history__head">
        <p className="w1337-tx-history__head-sub muted">
          Collection-wide operators (`setApprovalForAll`) from the last {APPROVAL_LOG_LOOKBACK_DAYS}{' '}
          days. Individual token approvals are not listed.
        </p>
        <RefreshIconButton busy={busy} ariaLabel="Refresh NFT approvals" onClick={() => void load()} />
      </div>
      {err ? <p className="error">{err}</p> : null}
      {!hydrated || busy ? <p className="w1337-tools-empty muted">Scanning NFT operators…</p> : null}
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
                <div className="w1337-approvals__token-meta" style={{ gridColumn: '1 / -1' }}>
                  <span className="w1337-approvals__token-symbol">
                    {row.collectionName}
                    {row.symbol ? ` · ${row.symbol}` : ''}
                  </span>
                  {collectionUrl ? (
                    <a className="w1337-approvals__link muted" href={collectionUrl} target="_blank" rel="noopener noreferrer">
                      {shortAddress(row.contract)}
                    </a>
                  ) : (
                    <span className="muted">{shortAddress(row.contract)}</span>
                  )}
                </div>
                <div className="w1337-approvals__detail">
                  <span className="w1337-approvals__label muted">Operator</span>
                  {operatorUrl ? (
                    <a className="w1337-approvals__link" href={operatorUrl} target="_blank" rel="noopener noreferrer">
                      {shortAddress(row.operator)}
                    </a>
                  ) : (
                    <span>{shortAddress(row.operator)}</span>
                  )}
                </div>
                <div className="w1337-approvals__detail">
                  <span className="w1337-approvals__label muted">Scope</span>
                  <span className="w1337-approvals__allowance w1337-approvals__allowance--warn">
                    Entire collection
                  </span>
                </div>
                {txUrl ? (
                  <a className="w1337-approvals__tx-link muted" href={txUrl} target="_blank" rel="noopener noreferrer">
                    Last approval tx
                  </a>
                ) : null}
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
    </div>
  );
}
