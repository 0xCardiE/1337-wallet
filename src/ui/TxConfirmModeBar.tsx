import { useEffect, useState } from 'react';
import {
  effectiveTxConfirmMode,
  patchSettings,
  type AppSettings,
  type TxConfirmMode,
} from '../lib/storageState';

const INSTANT_HINT =
  'When on, sign dapp requests and in-wallet sends immediately. Off (default) confirms each request first.';

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
        Instant
      </button>
      {err ? <span className="w1337-tx-mode-err">{err}</span> : null}
    </>
  );
}
