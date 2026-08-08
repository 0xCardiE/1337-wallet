import { useState } from 'react';
import type { AppSettings } from '../lib/storageState';
import { MultiSendView } from './MultiSendView';
import { ApprovalsPanel } from './ApprovalsPanel';
import { GasStationView } from './GasStationView';
import { SwapView } from './SwapView';

export type ToolsSubTab = 'multisend' | 'gas' | 'approvals' | 'swap';

const TOOL_TABS: { id: ToolsSubTab; label: string }[] = [
  { id: 'multisend', label: 'Multisend' },
  { id: 'gas', label: 'Gas' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'swap', label: 'Swap' },
];

export function ToolsView({ settings }: { settings: AppSettings }) {
  const [tab, setTab] = useState<ToolsSubTab>('multisend');

  return (
    <div className="w1337-tools">
      <nav className="w1337-tools-tabs" aria-label="Tools">
        {TOOL_TABS.map(t => (
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
        {tab === 'multisend' ? <MultiSendView settings={settings} /> : null}
        {tab === 'gas' ? <GasStationView settings={settings} /> : null}
        {tab === 'approvals' ? <ApprovalsPanel settings={settings} /> : null}
        {tab === 'swap' ? <SwapView settings={settings} embedded /> : null}
      </div>
    </div>
  );
}
