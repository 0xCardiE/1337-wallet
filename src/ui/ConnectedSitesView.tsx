import { useCallback, useEffect, useState } from 'react';
import {
  disconnectConnectedOrigin,
  fetchConnectedSites,
} from '../lib/dappConnectionBridge';
import type { ConnectedSite } from '../lib/dappConnections';
import {
  DAPP_COMPAT_LABELS,
  dappCompatForOrigin,
  type DappCompatMode,
} from '../lib/dappCompat';
import { patchSettings, type AppSettings } from '../lib/storageState';
import { shortAddress } from '../lib/accounts';
import { describeError } from '../lib/utils';
import { ScreenHeader } from './ScreenHeader';

export function ConnectedSitesView({
  settings,
  onSaved,
  onBack,
}: {
  settings: AppSettings;
  onSaved: () => void;
  onBack: () => void;
}) {
  const [sites, setSites] = useState<ConnectedSite[]>([]);
  const [busyOrigin, setBusyOrigin] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setSites(await fetchConnectedSites());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function revoke(origin: string) {
    setErr(null);
    setBusyOrigin(origin);
    try {
      const res = await disconnectConnectedOrigin(origin);
      if (!res.ok) throw new Error(res.error ?? 'Could not disconnect');
      await reload();
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusyOrigin(null);
    }
  }

  async function setCompat(origin: string, mode: DappCompatMode) {
    setErr(null);
    const next = { ...(settings.dappCompatByOrigin ?? {}) };
    if (mode === 'default') delete next[origin];
    else next[origin] = mode;
    try {
      await patchSettings({ dappCompatByOrigin: next });
      onSaved();
    } catch (e) {
      setErr(describeError(e));
    }
  }

  return (
    <div className="wallet-shell w1337">
      <ScreenHeader title="Connected sites" onClose={onBack} />
      <div className="screen-body settings-panel">
        <div className="settings-body">
          <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
            Origins authorized this session. Locking or restarting the browser clears the list.
            Per-site MetaMask-compat needs a tab reload.
          </p>
          {sites.length === 0 ? (
            <p className="muted" style={{ marginTop: 16, fontSize: 12 }}>
              No connected sites yet. A dapp that calls eth_requestAccounts, or Connect on the
              home bar, will show up here.
            </p>
          ) : (
            <ul className="w1337-connected-sites">
              {sites.map(site => {
                const mode = dappCompatForOrigin(settings, site.origin);
                return (
                  <li key={site.origin} className="w1337-connected-sites__row">
                    <div className="w1337-connected-sites__copy">
                      <strong>{site.hostname}</strong>
                      <span className="muted">{site.origin}</span>
                      <span className="muted">
                        {site.addresses.map(a => shortAddress(a)).join(', ')}
                      </span>
                    </div>
                    <label className="w1337-connected-sites__compat">
                      <span className="muted">Provider</span>
                      <select
                        value={mode}
                        onChange={e => void setCompat(site.origin, e.target.value as DappCompatMode)}
                      >
                        {(Object.keys(DAPP_COMPAT_LABELS) as DappCompatMode[]).map(id => (
                          <option key={id} value={id}>
                            {DAPP_COMPAT_LABELS[id]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="ghost"
                      disabled={busyOrigin === site.origin}
                      onClick={() => void revoke(site.origin)}
                    >
                      {busyOrigin === site.origin ? '…' : 'Revoke'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {err ? <p className="error">{err}</p> : null}
        </div>
      </div>
    </div>
  );
}
