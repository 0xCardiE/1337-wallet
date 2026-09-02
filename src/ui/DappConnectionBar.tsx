import {
  connectActiveTab,
  disconnectActiveTab,
  fetchDappConnectionStatus,
  type DappConnectionStatus,
} from '../lib/dappConnectionBridge';
import { shortAddress } from '../lib/accounts';
import { chainById } from '../lib/chainCatalog';
import { effectiveActiveChainId, type AppSettings } from '../lib/storageState';
import { isUnlocked } from '../lib/accountSession';
import { useCallback, useEffect, useState } from 'react';

/**
 * Site favicon from the active tab (or Google s2 fallback). Falls back to a
 * letter avatar when missing, local/dev, or the image fails to load — common
 * for localhost icons that render as a black disc on dark UI.
 */
function SiteIcon({
  favIconUrl,
  label,
  connected,
}: {
  favIconUrl?: string;
  label: string;
  connected: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const letter = label.trim().charAt(0).toUpperCase() || '?';

  useEffect(() => {
    setImgFailed(false);
  }, [favIconUrl]);

  const showImg = Boolean(favIconUrl) && !imgFailed;

  return (
    <span className={`w1337-dapp-bar__icon-wrap${connected ? '' : ' w1337-dapp-bar__icon-wrap--idle'}`}>
      {showImg ? (
        <img
          className="w1337-dapp-bar__icon"
          src={favIconUrl}
          alt=""
          draggable={false}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="w1337-dapp-bar__icon w1337-dapp-bar__icon--fallback">{letter}</span>
      )}
      {connected ? <span className="w1337-dapp-bar__dot" aria-hidden /> : null}
    </span>
  );
}

export function DappConnectionBar({
  settings,
  onSaved,
  embedded = false,
}: {
  settings: AppSettings;
  onSaved: () => void;
  /** When true, omit outer footer chrome (used inside w1337-wallet-dock). */
  embedded?: boolean;
}) {
  const [status, setStatus] = useState<DappConnectionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const chainName = chainById(effectiveActiveChainId(settings))?.name;

  const refresh = useCallback(async () => {
    const next = await fetchDappConnectionStatus();
    setStatus(next);
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 2500);
    const onFocus = () => void refresh();
    const onAccountChanged = () => void refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener('1337-account-changed', onAccountChanged);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('1337-account-changed', onAccountChanged);
    };
  }, [refresh]);

  async function onConnect() {
    if (!isUnlocked()) {
      setErr('Unlock the wallet first');
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await connectActiveTab();
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? 'Connect failed');
      return;
    }
    await refresh();
  }

  async function onDisconnect() {
    setBusy(true);
    setErr(null);
    const res = await disconnectActiveTab();
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? 'Disconnect failed');
      return;
    }
    await refresh();
  }

  const tab = status?.tab;
  const connected = status?.connected === true;
  const canConnect = status?.canConnect === true;
  const connectedShort = status?.connectedAddress ? shortAddress(status.connectedAddress) : null;
  const showSite = Boolean(tab && (connected || canConnect));

  return (
    <div className={`w1337-dapp-bar${embedded ? ' w1337-dapp-bar--embedded' : ''}`} aria-label="Website connection">
      <div className="w1337-dapp-bar__site">
        {showSite && tab ? (
          <SiteIcon favIconUrl={tab.favIconUrl} label={tab.hostname} connected={connected} />
        ) : null}
        {connected && tab ? (
          <span className="w1337-dapp-bar__meta">
            <span className="w1337-dapp-bar__host">{tab.hostname}</span>
            <span className="w1337-dapp-bar__sub">
              Connected
              {connectedShort ? ` · ${connectedShort}` : ''}
              {chainName ? ` · ${chainName}` : ''}
            </span>
          </span>
        ) : canConnect && tab ? (
          <span className="w1337-dapp-bar__meta">
            <span className="w1337-dapp-bar__host">{tab.hostname}</span>
            <span className="w1337-dapp-bar__sub">
              Not connected
              {chainName ? ` · ${chainName}` : ''}
            </span>
          </span>
        ) : (
          <span className="w1337-dapp-bar__meta">
            <span className="w1337-dapp-bar__host">Not connected</span>
            <span className="w1337-dapp-bar__sub">
              {status?.reason ?? 'Open a dapp in your browser tab'}
            </span>
          </span>
        )}
      </div>

      <div className="w1337-dapp-bar__actions">
        {connected ? (
          <button
            type="button"
            className="w1337-dapp-bar__btn w1337-dapp-bar__btn--disconnect"
            disabled={busy}
            onClick={() => void onDisconnect()}
            aria-label="Disconnect from site"
            title="Disconnect"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        ) : canConnect && tab ? (
          <button
            type="button"
            className="w1337-dapp-bar__btn w1337-dapp-bar__btn--connect"
            disabled={busy || !isUnlocked()}
            onClick={() => void onConnect()}
          >
            {busy ? '…' : 'Connect'}
          </button>
        ) : null}
      </div>

      {err ? <p className="error w1337-dapp-bar__err">{err}</p> : null}
    </div>
  );
}
