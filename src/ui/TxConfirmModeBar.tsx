import { useEffect, useState } from 'react';
import {
  effectiveTxConfirmMode,
  patchSettings,
  type AppSettings,
  type TxConfirmMode,
} from '../lib/storageState';

const INSTANT_HINT =
  'When on, sign ordinary dapp requests immediately. Risk gates in Settings still pause Instant for unlimited approvals, SIWE mismatch, and similar.';

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
  onSaved,
}: {
  settings: AppSettings;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<TxConfirmMode>(() => effectiveTxConfirmMode(settings));
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setMode(effectiveTxConfirmMode(settings));
  }, [settings.txConfirmMode]);

  const instantOn = mode === 'speed';

  async function toggleInstant() {
    const nextMode: TxConfirmMode = instantOn ? 'normal' : 'speed';
    const prev = mode;
    setMode(nextMode);
    setErr(null);
    try {
      await patchSettings({ txConfirmMode: nextMode });
      onSaved();
    } catch (e) {
      setMode(prev);
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <button
        type="button"
        className={`w1337-instant-toggle${instantOn ? ' w1337-instant-toggle--on' : ''}`}
        aria-pressed={instantOn}
        aria-label={instantOn ? 'Instant signing on' : 'Instant signing off — confirm before signing'}
        title={INSTANT_HINT}
        onClick={() => void toggleInstant()}
      >
        <ThunderIcon />
        {instantOn ? 'Instant On' : 'Instant Off'}
      </button>
      {err ? <span className="w1337-tx-mode-err">{err}</span> : null}
    </>
  );
}
