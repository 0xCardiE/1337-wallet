import { useEffect, useRef, useState } from 'react';
import { getAddress } from 'viem';
import { getSessionPrivateKey, getUnlockedAccount } from '../lib/accountSession';
import { AccountsPanel } from './AccountsPanel';
import { ScreenHeader } from './ScreenHeader';

export function WalletsView({
  onChanged,
  onBack,
}: {
  onChanged: () => void;
  onBack: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [copyFlash, setCopyFlash] = useState<'addr' | 'pk' | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const account = getUnlockedAccount();
  const walletAddress = account ? getAddress(account.address) : null;
  const walletPrivateKey = getSessionPrivateKey();

  async function copyWalletField(kind: 'addr' | 'pk', text: string) {
    try {
      setErr(null);
      await navigator.clipboard.writeText(text);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      setCopyFlash(kind);
      copyTimerRef.current = window.setTimeout(() => setCopyFlash(null), 2000);
    } catch {
      setErr('Could not copy — check extension clipboard permission.');
    }
  }

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  return (
    <div className="wallet-shell w1337">
      <ScreenHeader title="Wallets" onClose={onBack} />
      <div className="screen-body settings-panel">
        <div className="settings-body">
          {walletAddress ? (
            <div className="w1337-wallets-active">
              <strong>Active wallet</strong>
              <div className="w1337-wallets-active__field">
                <p className="mono w1337-wallets-active__addr">{walletAddress}</p>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => void copyWalletField('addr', walletAddress)}
                >
                  {copyFlash === 'addr' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="muted w1337-wallets-active__hint">
                Your address on EVM chains — use this to receive funds.
              </p>

              {walletPrivateKey ? (
                <>
                  <label htmlFor="wallet-privkey">Private key</label>
                  <div className="w1337-wallets-active__field">
                    <p
                      id="wallet-privkey"
                      className="mono w1337-wallets-active__pk"
                      aria-label="Private key hidden"
                    >
                      ••••••••••••••••••••••••••••••••
                    </p>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => void copyWalletField('pk', walletPrivateKey)}
                    >
                      {copyFlash === 'pk' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="muted w1337-wallets-active__hint">
                    Hidden for safety — copy only when you need to back up or import elsewhere.
                  </p>
                </>
              ) : null}
            </div>
          ) : null}

          <AccountsPanel onChanged={onChanged} />

          {err ? <p className="error">{err}</p> : null}
        </div>
      </div>
    </div>
  );
}
