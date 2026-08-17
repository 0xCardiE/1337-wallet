import { useEffect, useMemo, useState } from 'react';
import type { AppSettings } from '../lib/storageState';
import {
  effectiveEnabledTools,
  TOOL_CATALOG,
  type ToolId,
} from '../lib/toolsRegistry';
import { ApprovalsPanel } from './ApprovalsPanel';
import { EnsView } from './EnsView';
import { GasStationView } from './GasStationView';
import { InspectView } from './InspectView';
import { MultiSendView } from './MultiSendView';
import { SwapView } from './SwapView';

export function ToolsView({ settings }: { settings: AppSettings }) {
  const enabled = useMemo(() => effectiveEnabledTools(settings), [settings.enabledTools]);
  const [tab, setTab] = useState<ToolId>(() => enabled[0] ?? 'inspect');

  useEffect(() => {
    if (!enabled.includes(tab)) {
      setTab(enabled[0] ?? 'inspect');
    }
  }, [enabled, tab]);

  if (enabled.length === 0) {
    return (
      <p className="w1337-tools-empty muted">
        All tools are hidden. Enable the ones you use in Settings → Tools.
      </p>
    );
  }

  return (
    <div className="w1337-tools">
      <nav className="w1337-tools-tabs" aria-label="Tools">
        {TOOL_CATALOG.filter(t => enabled.includes(t.id)).map(t => (
          <button
            key={t.id}
            type="button"
            className={`w1337-tools-tabs__btn${tab === t.id ? ' w1337-tools-tabs__btn--on' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="w1337-tools-panel">
        {tab === 'inspect' ? <InspectView settings={settings} /> : null}
        {tab === 'approvals' ? <ApprovalsPanel settings={settings} /> : null}
        {tab === 'swap' ? <SwapView settings={settings} embedded /> : null}
        {tab === 'ens' ? <EnsView settings={settings} /> : null}
        {tab === 'multisend' ? <MultiSendView settings={settings} /> : null}
        {tab === 'gas' ? <GasStationView settings={settings} /> : null}
      </div>
    </div>
  );
}
