import { useCallback, useEffect, useState } from 'react';
import { getAddress } from 'viem';
import { getUnlockedAccount } from '../lib/accountSession';
import { effectiveActiveChainId, type AppSettings } from '../lib/storageState';
import {
  fmtTokenAmount,
  fmtUsdValue,
  invalidateRpcBalanceCache,
  loadWalletBalancesForChain,
  type WalletBalEntry,
} from '../lib/walletBalances';
import { LiFiIcon } from './LiFiIcon';
import { QuickSendInline } from './QuickSendInline';
import { RefreshIconButton } from './RefreshIconButton';

function tokenRowKey(t: WalletBalEntry): string {
  return `${t.chainId}:${t.address.toLowerCase()}`;
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

  const [rows, setRows] = useState<WalletBalEntry[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!addr) return;
    setBusy(true);
    setErr(null);
    try {
      invalidateRpcBalanceCache(chainId);
      const { rows: next, error } = await loadWalletBalancesForChain(addr, chainId, {
        refreshRpc: true,
        explorerApiKey: settings.explorerApiKey,
      });
      setRows(next);
      setErr(error);
    } finally {
      setBusy(false);
    }
  }, [addr, chainId, settings.explorerApiKey]);

  useEffect(() => {
    invalidateRpcBalanceCache(chainId);
    setExpandedKey(null);
    void refresh();
  }, [refresh, chainId]);

  function toggleSend(t: WalletBalEntry) {
    const key = tokenRowKey(t);
    setExpandedKey(prev => (prev === key ? null : key));
  }

  return (
    <div className="w1337-home">
      <div className="w1337-home-refresh-row">
        <RefreshIconButton
          busy={busy}
          ariaLabel="Refresh balances"
          onClick={() => void refresh()}
        />
      </div>

      {err ? <p className="error w1337-home-error">{err}</p> : null}

      {busy && rows.length === 0 ? (
        <p className="muted w1337-home-loading">Loading balances…</p>
      ) : null}

      {!busy && rows.length === 0 && !err ? (
        <p className="muted w1337-home-empty">No tokens with balance on this network.</p>
      ) : null}

      <ul className="w1337-token-list">
        {rows.map(t => {
          const usd = fmtUsdValue(t);
          const key = tokenRowKey(t);
          const open = expandedKey === key;
          return (
            <li key={key} className={`w1337-token-item${open ? ' w1337-token-item--open' : ''}`}>
              <button
                type="button"
                className="w1337-token-row w1337-token-row--action"
                aria-expanded={open}
                onClick={() => toggleSend(t)}
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
                  {open ? '−' : '+'}
                </span>
              </button>
              {open ? (
                <QuickSendInline
                  key={key}
                  token={t}
                  chainId={chainId}
                  settings={settings}
                  onCollapse={() => setExpandedKey(null)}
                  onSent={() => void refresh()}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
