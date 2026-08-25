import { useEffect, useState, type ReactNode } from 'react';
import { getActiveAccountMeta, getUnlockedAccount } from '../lib/accountSession';
import type { AppSettings } from '../lib/storageState';
import { accountInstantEnabled } from '../lib/txConfirmMode';
import { AccountSwitcher } from './AccountSwitcher';
import { Mark1337 } from './Mark1337';
import { NetworkSelector } from './NetworkSelector';
import { DappConnectionBar } from './DappConnectionBar';
import { TxApprovalSheet } from './TxApprovalSheet';
import { NetworkDoctorSheet } from './NetworkDoctorSheet';
import { DevErrorPanel } from './DevErrorPanel';

export type WalletMainTab = 'assets' | 'history' | 'tools';

const TAB_LABELS: Record<WalletMainTab, string> = {
  assets: 'Assets',
  history: 'History',
  tools: 'Tools',
};

export function WalletLayout({
  activeTab,
  onTabChange,
  onOpenSettings,
  settings,
  onSaved,
  children,
}: {
  activeTab: WalletMainTab;
  onTabChange: (tab: WalletMainTab) => void;
  onOpenSettings: () => void;
  settings: AppSettings;
  onSaved: () => void;
  children: ReactNode;
}) {
  const [, setTick] = useState(0);
  const account = getUnlockedAccount();
  const burnerOn = accountInstantEnabled(getActiveAccountMeta(), settings);

  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    window.addEventListener('1337-account-changed', bump);
    return () => window.removeEventListener('1337-account-changed', bump);
  }, []);

  const settingsBtn = (
    <button
      type="button"
      className="w1337-icon-head"
      onClick={onOpenSettings}
      aria-label="Settings"
    >
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  );

  return (
    <div className="wallet-shell w1337 w1337--main">
      <header className="screen-header w1337-main-header">
        <div className="w1337-main-header__brand">
          <Mark1337 size={22} animated={false} />
          <span className="w1337-main-header__title">1337</span>
        </div>
        <div className="screen-header-right">{settingsBtn}</div>
      </header>

      <nav className="w1337-mm-tabs" aria-label="Wallet sections">
        {(Object.keys(TAB_LABELS) as WalletMainTab[]).map(tab => (
          <button
            key={tab}
            type="button"
            className={`w1337-mm-tabs__btn${activeTab === tab ? ' w1337-mm-tabs__btn--on' : ''}`}
            aria-current={activeTab === tab ? 'page' : undefined}
            onClick={() => onTabChange(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </nav>

      <div className="w1337-layout-network">
        <NetworkSelector settings={settings} onSaved={onSaved} compact />
      </div>

      <div className="screen-body w1337-body w1337-body--main">{children}</div>

      <DevErrorPanel />
      <footer
        className={`w1337-wallet-dock${burnerOn ? ' w1337-wallet-dock--burner' : ''}`}
        aria-label={burnerOn ? 'Wallet status — Burner Mode on' : 'Wallet status'}
      >
        {account ? <AccountSwitcher settings={settings} onChanged={onSaved} /> : null}
        <DappConnectionBar settings={settings} onSaved={onSaved} embedded />
      </footer>
      <TxApprovalSheet settings={settings} />
      <NetworkDoctorSheet settings={settings} onSaved={onSaved} />
    </div>
  );
}
