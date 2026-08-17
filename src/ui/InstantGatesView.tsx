import { useEffect, useState } from 'react';
import {
  DEFAULT_HIGH_VALUE_NATIVE,
  INSTANT_GATE_IDS,
  INSTANT_GATE_META,
  effectiveHighValueNative,
  type InstantGateId,
} from '../lib/instantGates';
import { patchSettings, type AppSettings } from '../lib/storageState';
import { describeError } from '../lib/utils';
import { ScreenHeader } from './ScreenHeader';

function gateChecksFromSettings(settings: AppSettings): Record<InstantGateId, boolean> {
  const ungated = new Set(settings.instantUngatedGates ?? []);
  const out = {} as Record<InstantGateId, boolean>;
  for (const id of INSTANT_GATE_IDS) {
    out[id] = !ungated.has(id);
  }
  return out;
}

export function InstantGatesView({
  settings,
  onSaved,
  onBack,
}: {
  settings: AppSettings;
  onSaved: () => void;
  onBack: () => void;
}) {
  const [instantFullyUngated, setInstantFullyUngated] = useState(
    () => settings.instantFullyUngated === true,
  );
  const [instantGated, setInstantGated] = useState<Record<InstantGateId, boolean>>(() =>
    gateChecksFromSettings(settings),
  );
  const [highValueStr, setHighValueStr] = useState(() =>
    String(effectiveHighValueNative(settings)),
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setInstantFullyUngated(settings.instantFullyUngated === true);
    setInstantGated(gateChecksFromSettings(settings));
    setHighValueStr(String(effectiveHighValueNative(settings)));
  }, [settings.instantFullyUngated, settings.instantUngatedGates, settings.instantHighValueNative]);

  async function save() {
    setErr(null);
    const highParsed = Number(highValueStr.trim().replace(',', '.'));
    if (!Number.isFinite(highParsed) || highParsed < 0) {
      setErr('Enter a valid high-value native threshold (0 or greater).');
      return;
    }
    setBusy(true);
    try {
      await patchSettings({
        instantFullyUngated,
        instantUngatedGates: INSTANT_GATE_IDS.filter(id => !instantGated[id]),
        instantHighValueNative: highParsed,
      });
      onSaved();
      onBack();
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wallet-shell w1337">
      <ScreenHeader title="Instant signing gates" onClose={onBack} />
      <div className="screen-body settings-panel">
        <div className="settings-body">
          <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
            Instant auto-signs ordinary dapp requests. Checked items still pause Instant and open
            the approval sheet. Uncheck to ungate that risk. Does not apply in Normal mode.
          </p>

          {INSTANT_GATE_IDS.map(id => (
            <div key={id} className="w1337-settings-gate-row">
              <input
                id={`instant-gate-${id}`}
                className="w1337-settings-gate-row__box"
                type="checkbox"
                checked={instantGated[id]}
                disabled={instantFullyUngated}
                onChange={e => setInstantGated(prev => ({ ...prev, [id]: e.target.checked }))}
              />
              <label htmlFor={`instant-gate-${id}`} className="w1337-settings-gate-row__copy">
                <strong>{INSTANT_GATE_META[id].title}</strong>
                <span className="muted">{INSTANT_GATE_META[id].description}</span>
              </label>
            </div>
          ))}

          <label htmlFor="high-value-native" style={{ marginTop: 14 }}>
            High-value threshold (native token)
          </label>
          <input
            id="high-value-native"
            type="number"
            min={0}
            step={0.01}
            value={highValueStr}
            disabled={instantFullyUngated || !instantGated.highValue}
            onChange={e => setHighValueStr(e.target.value)}
          />
          <p className="muted" style={{ fontSize: 12 }}>
            Pause Instant when a transaction sends at least this much native token (default{' '}
            {DEFAULT_HIGH_VALUE_NATIVE}).
          </p>

          <div className="w1337-settings-gate-row w1337-settings-gate-row--danger">
            <input
              id="instant-fully-ungated"
              className="w1337-settings-gate-row__box"
              type="checkbox"
              checked={instantFullyUngated}
              onChange={e => setInstantFullyUngated(e.target.checked)}
            />
            <label htmlFor="instant-fully-ungated" className="w1337-settings-gate-row__copy">
              <strong>Fully ungate Instant</strong>
              <span className="muted">
                Auto-sign every dapp request while unlocked, including unlimited approvals and
                mismatched SIWE. Hardware accounts still confirm on the device.
              </span>
            </label>
          </div>
          {instantFullyUngated ? (
            <p className="settings-callout settings-callout--warn">
              Fully ungated Instant signs without reviewing risky requests. Only use this on sites
              you already trust.
            </p>
          ) : null}

          {err ? <p className="error">{err}</p> : null}
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              className="primary"
              style={{ width: '100%' }}
              disabled={busy}
              onClick={() => void save()}
            >
              {busy ? '…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
