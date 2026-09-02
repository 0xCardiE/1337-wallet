import { useEffect, useState } from 'react';
import { patchSettings, type AppSettings } from '../lib/storageState';
import {
  effectiveEnabledTools,
  TOOL_CATALOG,
  type ToolId,
} from '../lib/toolsRegistry';
import { describeError } from '../lib/utils';
import { ScreenHeader } from './ScreenHeader';

function toolSetFromSettings(settings: AppSettings): Record<ToolId, boolean> {
  const on = new Set(effectiveEnabledTools(settings));
  const out = {} as Record<ToolId, boolean>;
  for (const t of TOOL_CATALOG) out[t.id] = on.has(t.id);
  return out;
}

export function ToolsSettingsView({
  settings,
  onSaved,
  onBack,
}: {
  settings: AppSettings;
  onSaved: () => void;
  onBack: () => void;
}) {
  const [enabledToolSet, setEnabledToolSet] = useState<Record<ToolId, boolean>>(() =>
    toolSetFromSettings(settings),
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEnabledToolSet(toolSetFromSettings(settings));
  }, [settings.enabledTools]);

  async function save() {
    setErr(null);
    setBusy(true);
    try {
      await patchSettings({
        enabledTools: TOOL_CATALOG.map(t => t.id).filter(id => enabledToolSet[id]),
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
      <ScreenHeader title="Tools" onClose={onBack} />
      <div className="screen-body settings-panel">
        <div className="settings-body">
          <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
            1337 is a signer. Hide anything you do not use. Inspect is off until you enable it.
            Confirm-time decode and simulation are always on. Swap, ENS, and Gas hide automatically
            on testnets.
          </p>
          {TOOL_CATALOG.map(tool => (
            <div key={tool.id} className="w1337-settings-gate-row">
              <input
                id={`tool-${tool.id}`}
                className="w1337-settings-gate-row__box"
                type="checkbox"
                checked={enabledToolSet[tool.id]}
                onChange={e =>
                  setEnabledToolSet(prev => ({ ...prev, [tool.id]: e.target.checked }))
                }
              />
              <label htmlFor={`tool-${tool.id}`} className="w1337-settings-gate-row__copy">
                <strong>{tool.label}</strong>
                <span className="muted">{tool.description}</span>
              </label>
            </div>
          ))}

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
