import { useCallback, useEffect, useState } from 'react';
import { getAddress } from 'viem';
import { getUnlockedAccount } from '../lib/accountSession';
import { chainById } from '../lib/chainCatalog';
import { revokePermit2Allowance, waitForChainReceipt } from '../lib/ethereum';
import { needsExplorerApiKey } from '../lib/explorerTxHistory';
import {
  formatPermit2Expiration,
  scanPermit2Approvals,
  type Permit2ApprovalRow,
} from '../lib/permit2Approvals';
import { APPROVAL_LOG_LOOKBACK_DAYS, addressExplorerLink, formatAllowance, txExplorerLink } from '../lib/tokenApprovals';
import { effectiveActiveChainId, type AppSettings } from '../lib/storageState';
import { describeError } from '../lib/utils';
import { RefreshIconButton } from './RefreshIconButton';

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
  const [available, setAvailable] = useState(true);
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
      const next = await scanPermit2Approvals({ chainId, owner: addr, explorerApiKey: apiKey });
      setRows(next.rows);
      setAvailable(next.available);
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
      setRows(prev =>
        prev.filter(
          r =>
            !(
              r.token.toLowerCase() === row.token.toLowerCase() &&
              r.spender.toLowerCase() === row.spender.toLowerCase()
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

  return (
    <div className="w1337-approvals">
      <div className="w1337-tx-history__head">
        <p className="w1337-tx-history__head-sub muted">
          Uniswap Permit2 allowances from the last {APPROVAL_LOG_LOOKBACK_DAYS} days, verified
          on-chain.
        </p>
        <RefreshIconButton busy={busy} ariaLabel="Refresh Permit2 approvals" onClick={() => void load()} />
      </div>
      {err ? <p className="error">{err}</p> : null}
      {hydrated && !available ? (
        <p className="w1337-tools-empty muted">Permit2 is not deployed on this network.</p>
      ) : null}
      {!hydrated || busy ? <p className="w1337-tools-empty muted">Scanning Permit2…</p> : null}
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
                <div className="w1337-approvals__token-meta" style={{ gridColumn: '1 / -1' }}>
                  <span className="w1337-approvals__token-symbol">{row.tokenSymbol}</span>
                  {tokenUrl ? (
                    <a className="w1337-approvals__link muted" href={tokenUrl} target="_blank" rel="noopener noreferrer">
                      {shortAddress(row.token)}
                    </a>
                  ) : (
                    <span className="muted">{shortAddress(row.token)}</span>
                  )}
                </div>
                <div className="w1337-approvals__detail">
                  <span className="w1337-approvals__label muted">Spender</span>
                  {spenderUrl ? (
                    <a className="w1337-approvals__link" href={spenderUrl} target="_blank" rel="noopener noreferrer">
                      {shortAddress(row.spender)}
                    </a>
                  ) : (
                    <span>{shortAddress(row.spender)}</span>
                  )}
                </div>
                <div className="w1337-approvals__detail">
                  <span className="w1337-approvals__label muted">Allowance</span>
                  <span className={`w1337-approvals__allowance${row.unlimited ? ' w1337-approvals__allowance--warn' : ''}`}>
                    {formatAllowance(row.amount, row.tokenDecimals, row.unlimited)}
                  </span>
                </div>
                <div className="w1337-approvals__detail">
                  <span className="w1337-approvals__label muted">Expires</span>
                  <span>{formatPermit2Expiration(row.expiration)}</span>
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
