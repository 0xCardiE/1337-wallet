import { useEffect, useState } from 'react';
import { isKeyBackedAccount, type WalletAccount } from '../lib/accounts';
import { accountInstantEnabled } from '../lib/txConfirmMode';
import { setAccountInstant } from '../lib/walletManager';
import type { AppSettings } from '../lib/storageState';

const INSTANT_HINT =
  'When on, this wallet signs ordinary dapp requests immediately. Hardware wallets always confirm on the device. Risk gates in Settings still pause Instant for unlimited approvals, SIWE mismatch, and similar.';

function ThunderIcon() {
  return (
    <svg
      className="w1337-instant-toggle__icon"
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M13 2 4.8 13.6c-.4.6 0 1.4.7 1.4H11l-1 7 8.2-11.6c.4-.6 0-1.4-.7-1.4H13l0-7z" />
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
  const canInstant = isKeyBackedAccount(account);
  const [on, setOn] = useState(() => accountInstantEnabled(account, settings));
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setOn(accountInstantEnabled(account, settings));
  }, [account, settings]);

  if (!canInstant) return null;

  async function toggleInstant() {
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
        className={`w1337-instant-toggle${on ? ' w1337-instant-toggle--on' : ''}${compact ? ' w1337-instant-toggle--compact' : ''}`}
        aria-pressed={on}
        aria-label={
          on
            ? `Instant signing on for ${account.label}`
            : `Instant signing off for ${account.label} — confirm before signing`
        }
        title={INSTANT_HINT}
        onClick={e => {
          e.stopPropagation();
          void toggleInstant();
        }}
      >
        <ThunderIcon />
        <span className="w1337-instant-toggle__label">{on ? 'Instant On' : 'Instant Off'}</span>
      </button>
      {err ? <span className="w1337-tx-mode-err">{err}</span> : null}
    </>
  );
}
