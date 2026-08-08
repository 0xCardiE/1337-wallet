import { useEffect, useState } from 'react';
import { Segment1337 } from './Select1337';
import {
  effectiveTxConfirmMode,
  patchSettings,
  type AppSettings,
  type TxConfirmMode,
} from '../lib/storageState';

const MODE_HINTS: Record<TxConfirmMode, string> = {
  speed: 'Sign dapp requests and in-wallet sends immediately.',
  normal: 'Confirm dapp requests and in-wallet sends before signing.',
};

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

  async function onChange(next: string) {
    const nextMode = next as TxConfirmMode;
    if (nextMode === mode) return;
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
      <Segment1337
        className="w1337-seg--compact"
        value={mode}
        onChange={onChange}
        ariaLabel="Transaction confirmation mode"
        options={[
          { value: 'speed', label: 'Turbo', title: MODE_HINTS.speed },
          { value: 'normal', label: 'Normal', title: MODE_HINTS.normal },
        ]}
      />
      {err ? <span className="w1337-tx-mode-err">{err}</span> : null}
    </>
  );
}
