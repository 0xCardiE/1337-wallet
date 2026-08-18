import { useEffect, useMemo, useState } from 'react';
import { chainById } from '../lib/chainCatalog';
import { effectiveActiveChainId, type AppSettings } from '../lib/storageState';
import {
  TOOL_CATALOG,
  visibleToolsForChain,
  type ToolId,
} from '../lib/toolsRegistry';
import { ApprovalsPanel } from './ApprovalsPanel';
import { EnsView } from './EnsView';
import { GasStationView } from './GasStationView';
import { InspectView } from './InspectView';
import { MultiSendView } from './MultiSendView';
import { SwapView } from './SwapView';

export function ToolsView({ settings }: { settings: AppSettings }) {
  const chainKind = chainById(effectiveActiveChainId(settings))?.kind;
  const enabled = useMemo(
    () => visibleToolsForChain(settings, chainKind),
    [settings.enabledTools, chainKind],
  );
  const [tab, setTab] = useState<ToolId>(() => enabled[0] ?? 'inspect');
  const activeTab = enabled.includes(tab) ? tab : (enabled[0] ?? 'inspect');

  useEffect(() => {
    if (tab !== activeTab) setTab(activeTab);
  }, [tab, activeTab]);

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
            className={`w1337-tools-tabs__btn${activeTab === t.id ? ' w1337-tools-tabs__btn--on' : ''}`}
            aria-current={activeTab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="w1337-tools-panel">
        {activeTab === 'inspect' ? <InspectView settings={settings} /> : null}
        {activeTab === 'approvals' ? <ApprovalsPanel settings={settings} /> : null}
        {activeTab === 'swap' ? <SwapView settings={settings} embedded /> : null}
        {activeTab === 'ens' ? <EnsView settings={settings} /> : null}
        {activeTab === 'multisend' ? <MultiSendView settings={settings} /> : null}
        {activeTab === 'gas' ? <GasStationView settings={settings} /> : null}
      </div>
    </div>
  );
}
