import { useEffect, useState } from 'react';
import {
  lockWallet,
  reopenWalletSurfaceAfterModeChange,
  syncToolbarOpenModeNow,
} from '../lib/sessionBridge';
import {
  patchSettings,
  effectiveSlippagePercent,
  effectiveAutoLockMinutes,
  effectiveToolbarOpenMode,
  parseSlippageInput,
  setVault,
  type AppSettings,
  type ToolbarOpenMode,
} from '../lib/storageState';
import {
  INSTANT_GATE_IDS,
} from '../lib/instantGates';
import { describeError } from '../lib/utils';
import {
  PRODUCT_SETTINGS_PRIVACY_HEADING,
  PRODUCT_SETTINGS_PRIVACY_LEAD,
  PRODUCT_MANIFEST,
} from '../lib/productManifest';
import {
  effectiveEnabledTools,
  TOOL_CATALOG,
} from '../lib/toolsRegistry';
import { ScreenHeader } from './ScreenHeader';
import { SimpleSelect1337 } from './Select1337';

export function SettingsView({
  settings,
  onSaved,
  onBack,
  onOpenNetworks,
  onOpenWallets,
  onOpenInstantGates,
  onOpenTools,
  onOpenConnectedSites,
}: {
  settings: AppSettings;
  onSaved: () => void;
  onBack: () => void;
  onOpenNetworks?: () => void;
  onOpenWallets?: () => void;
  onOpenInstantGates?: () => void;
  onOpenTools?: () => void;
  onOpenConnectedSites?: () => void;
}) {
  const [slippageStr, setSlippageStr] = useState(() =>
    String(effectiveSlippagePercent(settings)),
  );
  const [autoLockM, setAutoLockM] = useState(() =>
    String(effectiveAutoLockMinutes(settings) || 0),
  );
  const sidePanelSupported =
    typeof chrome !== 'undefined' &&
    typeof chrome.sidePanel?.setPanelBehavior === 'function';

  const [openMode, setOpenMode] = useState<ToolbarOpenMode>(() => {
    const m = effectiveToolbarOpenMode(settings);
    return !sidePanelSupported && m === 'side_panel' ? 'popup' : m;
  });
  const [replaceMetaMask, setReplaceMetaMask] = useState(
    () => settings.replaceMetaMask !== false,
  );
  const [explorerApiKey, setExplorerApiKey] = useState(() => settings.explorerApiKey ?? '');
  const [theGraphApiKey, setTheGraphApiKey] = useState(() => settings.theGraphApiKey ?? '');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSlippageStr(String(effectiveSlippagePercent(settings)));
    setAutoLockM(String(effectiveAutoLockMinutes(settings) || 0));
    const m = effectiveToolbarOpenMode(settings);
    setOpenMode(!sidePanelSupported && m === 'side_panel' ? 'popup' : m);
    setReplaceMetaMask(settings.replaceMetaMask !== false);
    setExplorerApiKey(settings.explorerApiKey ?? '');
    setTheGraphApiKey(settings.theGraphApiKey ?? '');
  }, [
    settings.slippagePercent,
    settings.autoLockMinutes,
    settings.toolbarOpenMode,
    settings.replaceMetaMask,
    settings.explorerApiKey,
    settings.theGraphApiKey,
    sidePanelSupported,
  ]);

  async function save() {
    setErr(null);
    const slipParsed = parseSlippageInput(slippageStr);
    if (slipParsed === null) {
      setErr('Enter a valid slippage between 0.01 and 50%.');
      return;
    }
    setBusy(true);
    try {
      const previousMode = effectiveToolbarOpenMode(settings);
      const lockMin = Number(autoLockM);
      const allowedLock = [0, 5, 15, 30, 60];
      const autoLockMinutes =
        allowedLock.includes(lockMin) && lockMin > 0 ? lockMin : undefined;
      await patchSettings({
        slippagePercent: slipParsed,
        autoLockMinutes,
        toolbarOpenMode: openMode,
        replaceMetaMask,
        explorerApiKey: explorerApiKey.trim() || undefined,
        theGraphApiKey: theGraphApiKey.trim() || undefined,
      });
      await syncToolbarOpenModeNow();
      onSaved();
      if (openMode !== previousMode) {
        await reopenWalletSurfaceAfterModeChange(openMode);
        return;
      }
      onBack();
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function lock() {
    await lockWallet();
    onBack();
  }

  async function wipe() {
    if (
      !confirm(
        'Remove encrypted vault from this browser? Funds are on-chain — save your recovery key elsewhere first.',
      )
    ) {
      return;
    }
    await setVault(null);
    await lockWallet();
    window.location.reload();
  }

  return (
    <div className="wallet-shell w1337">
      <ScreenHeader title="Settings" onClose={onBack} />
      <div className="screen-body settings-panel">
        <div className="settings-body">
          {onOpenNetworks ? (
            <div className="w1337-settings-link-card">
              <div>
                <strong>Networks &amp; RPCs</strong>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                  Add custom chains and manage RPC endpoints.
                </p>
              </div>
              <button type="button" className="ghost" onClick={onOpenNetworks}>
                Open
              </button>
            </div>
          ) : null}

          {onOpenWallets ? (
            <div className="w1337-settings-link-card">
              <div>
                <strong>Wallets</strong>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                  Generate, import, connect hardware, and manage accounts.
                </p>
              </div>
              <button type="button" className="ghost" onClick={onOpenWallets}>
                Open
              </button>
            </div>
          ) : null}

          {onOpenInstantGates ? (
            <div className="w1337-settings-link-card">
              <div>
                <strong>Instant signing gates</strong>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                  {settings.instantFullyUngated
                    ? 'Fully ungated — Instant wallets auto-sign every dapp request.'
                    : `${INSTANT_GATE_IDS.length - (settings.instantUngatedGates?.length ?? 0)} of ${INSTANT_GATE_IDS.length} risks still pause Instant wallets.`}
                </p>
              </div>
              <button type="button" className="ghost" onClick={onOpenInstantGates}>
                Open
              </button>
            </div>
          ) : null}

          {onOpenTools ? (
            <div className="w1337-settings-link-card">
              <div>
                <strong>Tools</strong>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                  {`${effectiveEnabledTools(settings).length} of ${TOOL_CATALOG.length} enabled`}
                </p>
              </div>
              <button type="button" className="ghost" onClick={onOpenTools}>
                Open
              </button>
            </div>
          ) : null}

          {onOpenConnectedSites ? (
            <div className="w1337-settings-link-card">
              <div>
                <strong>Connected sites</strong>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                  Revoke origins and set per-site MetaMask-compat.
                </p>
              </div>
              <button type="button" className="ghost" onClick={onOpenConnectedSites}>
                Open
              </button>
            </div>
          ) : null}

          <label htmlFor="slip" style={{ marginTop: 16 }}>
            Slippage (%)
          </label>
          <input
            id="slip"
            type="number"
            min={0.01}
            max={50}
            step={0.05}
            value={slippageStr}
            onChange={(e) => setSlippageStr(e.target.value)}
          />
          <p className="muted" style={{ fontSize: 12 }}>
            Sent to Li.FI as a ratio (example: 5% → 0.05). Used when requesting quotes.
          </p>

          <div style={{ marginTop: 16 }}>
            <SimpleSelect1337
              id="autolock"
              label="Auto-lock after idle"
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            value={autoLockM}
            options={[
              { value: '0', label: 'Off' },
              { value: '5', label: '5 minutes' },
              { value: '15', label: '15 minutes' },
              { value: '30', label: '30 minutes' },
              { value: '60', label: '60 minutes' },
            ]}
            onChange={setAutoLockM}
            />
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Locks while the wallet UI is open but inactive. Uses the extension service worker clock.
          </p>

          <div style={{ marginTop: 16 }}>
            <SimpleSelect1337
              id="openmode"
              label="Open from toolbar"
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              value={openMode}
              options={
                sidePanelSupported
                  ? [
                      { value: 'side_panel', label: 'Side panel', sublabel: 'Recommended' },
                      { value: 'popup', label: 'Popup' },
                    ]
                  : [{ value: 'popup', label: 'Popup' }]
              }
              onChange={v => setOpenMode(v as ToolbarOpenMode)}
            />
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            {sidePanelSupported
              ? 'Side panel keeps 1337 docked in the browser sidebar — strongly recommended for swaps, history, and dapp connections while you browse.'
              : 'Side panel requires a Chromium browser with side panel support (e.g. Chrome 114+).'}
          </p>
          {sidePanelSupported && openMode === 'popup' ? (
            <p className="settings-callout settings-callout--warn">
              The wallet works best in the side panel. Popup closes when you click away and makes
              it easy to lose transaction context.
            </p>
          ) : null}

          <label htmlFor="explorer-key" style={{ marginTop: 16 }}>
            Etherscan API key (transaction history)
          </label>
          <input
            id="explorer-key"
            type="password"
            value={explorerApiKey}
            onChange={e => setExplorerApiKey(e.target.value)}
            placeholder="Optional — free at etherscan.io/apis"
            autoComplete="off"
          />
          <p className="muted" style={{ fontSize: 12 }}>
            One Etherscan v2 key. Free coverage includes Ethereum, Arbitrum, Polygon, and most *scan
            chains. Optimism, Base, Scroll, zkSync, Ink, and Gnosis fall back to Blockscout when
            Etherscan Free does not cover them. BSC and Avalanche still need a paid Etherscan plan.
          </p>

          <label htmlFor="thegraph-key" style={{ marginTop: 16 }}>
            The Graph API key (ENS names)
          </label>
          <input
            id="thegraph-key"
            type="password"
            value={theGraphApiKey}
            onChange={e => setTheGraphApiKey(e.target.value)}
            placeholder="Optional — free at thegraph.com/studio/apikeys"
            autoComplete="off"
          />
          <p className="muted" style={{ fontSize: 12 }}>
            Used to list ENS domains in Tools → ENS. Without a key, the public rate-limited
            subgraph is used.
          </p>

          <div style={{ marginTop: 16 }}>
            <SimpleSelect1337
              id="metamask"
              label="Dapp connection"
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              value={replaceMetaMask ? 'replace' : 'separate'}
              options={[
                { value: 'replace', label: 'Replace MetaMask (window.ethereum)' },
                { value: 'separate', label: 'Separate provider (window.wallet1337 only)' },
              ]}
              onChange={v => setReplaceMetaMask(v === 'replace')}
            />
          </div>
          <p className="muted" style={{ fontSize: 12 }}>
            Default for new sites. Override per origin in Connected sites. Reload open tabs after
            changing this.
          </p>

          <div
            className="muted"
            style={{
              marginTop: 18,
              padding: 10,
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 11,
              lineHeight: 1.45,
            }}
          >
            <strong style={{ color: 'var(--text)' }}>{PRODUCT_SETTINGS_PRIVACY_HEADING}</strong>
            <p className="muted" style={{ margin: '8px 0 0', fontSize: 11, lineHeight: 1.45 }}>
              {PRODUCT_SETTINGS_PRIVACY_LEAD}
            </p>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {PRODUCT_MANIFEST.privacy.storedLocally.map(line => (
                <li key={line}>{line}</li>
              ))}
              <li>{PRODUCT_MANIFEST.privacy.networkWhenYouUseFeatures[0]}</li>
            </ul>
            <p className="muted" style={{ margin: '8px 0 0', fontSize: 10, lineHeight: 1.4 }}>
              No analytics SDK. No 1337 user accounts. See{' '}
              <code className="mono">brand/product.manifest.json</code> for full positioning and
              privacy claims.
            </p>
          </div>

          {err && <p className="error">{err}</p>}
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

          <div className="settings-wallet-footer">
            <hr className="sep" />
            <div className="row" style={{ marginBottom: 0 }}>
              <button type="button" className="ghost" onClick={() => void lock()}>
                Lock
              </button>
              <button type="button" className="danger" onClick={() => void wipe()}>
                Wipe wallet
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
