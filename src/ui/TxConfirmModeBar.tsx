import { useEffect, useState } from 'react';
import { isKeyBackedAccount, type WalletAccount } from '../lib/accounts';
import { accountInstantEnabled } from '../lib/txConfirmMode';
import { setAccountInstant } from '../lib/walletManager';
import type { AppSettings } from '../lib/storageState';

const BURNER_HINT =
  'Burner Mode: this wallet auto-signs ordinary dapp requests. Treat it as disposable. Hardware wallets always confirm on the device. Risk gates in Settings still pause Burner Mode for unlimited approvals, SIWE mismatch, and similar.';

function FlameIcon() {
  return (
    <svg
      className="w1337-burner-toggle__icon"
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2c.35 3.1 2.4 5.05 4 7.05 1.55 1.95 2.25 4 1.55 6.2C16.7 17.7 14.5 20 12 20s-4.7-2.3-5.55-4.75c-.7-2.2 0-4.25 1.55-6.2C9.6 7.05 11.65 5.1 12 2zm0 20c3.7 0 6.75-2.35 6.75-5.9 0-1.35-.5-2.6-1.35-3.6 1.55 1.95 1.85 4.15.75 5.7C17.15 19.85 14.75 21.5 12 21.5s-5.15-1.65-6.15-3.3c-1.1-1.55-.8-3.75.75-5.7C5.75 13.5 5.25 14.75 5.25 16.1 5.25 19.65 8.3 22 12 22z" />
    </svg>
  );
}

export function TxConfirmModeToggle({
  settings,
  account,
  onSaved,
  compact,
}: {
  settings: AppSettings;
  account: WalletAccount;
  onSaved?: () => void;
  compact?: boolean;
}) {
  const canBurner = isKeyBackedAccount(account);
  const [on, setOn] = useState(() => accountInstantEnabled(account, settings));
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setOn(accountInstantEnabled(account, settings));
  }, [account, settings]);

  if (!canBurner) return null;

  async function toggleBurner() {
    const next = !on;
    setOn(next);
    setErr(null);
    try {
      await setAccountInstant(account.id, next);
      window.dispatchEvent(new Event('1337-account-changed'));
      onSaved?.();
    } catch (e) {
      setOn(!next);
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <button
        type="button"
        className={`w1337-burner-toggle${on ? ' w1337-burner-toggle--on' : ''}${compact ? ' w1337-burner-toggle--compact' : ''}`}
        aria-pressed={on}
        aria-label={
          on
            ? `Burner Mode on for ${account.label}`
            : `Burner Mode off for ${account.label} — confirm before signing`
        }
        title={BURNER_HINT}
        onClick={e => {
          e.stopPropagation();
          void toggleBurner();
        }}
      >
        <FlameIcon />
        <span className="w1337-burner-toggle__label">{on ? 'Burner On' : 'Burner Off'}</span>
      </button>
      {err ? <span className="w1337-tx-mode-err">{err}</span> : null}
    </>
  );
}
