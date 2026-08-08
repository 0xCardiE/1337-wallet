import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  closeNetworkDoctor,
  subscribeNetworkDoctor,
  type NetworkDoctorRequest,
} from '../lib/rpcDoctorBridge';
import { rpcUrlsFor, preferredRpcFor } from '../lib/chainRpcRegistry';
import { chainById } from '../lib/chainCatalog';
import {
  getChainHealthSnapshot,
  probeChainRpcs,
  rpcHostLabel,
  rpcProviderHint,
  setStickyRpc,
  summarizeChainHealth,
  type ChainRpcHealthSnapshot,
  type RpcHealthStatus,
} from '../lib/rpcHealth';
import {
  patchSettings,
  type AppSettings,
} from '../lib/storageState';
import { describeError } from '../lib/utils';

function statusLabel(s: RpcHealthStatus): string {
  switch (s) {
    case 'healthy':
      return 'Healthy';
    case 'slow':
      return 'Slow';
    case 'unhealthy':
      return 'Down';
    default:
      return 'Unknown';
  }
}

function diagnosisItems(args: {
  snap: ChainRpcHealthSnapshot;
  preferred?: string;
  lastError?: string;
  chainName: string;
}): { ok: boolean; text: string }[] {
  const { snap, preferred, lastError, chainName } = args;
  const items: { ok: boolean; text: string }[] = [];

  items.push({
    ok: snap.endpoints.length > 0,
    text:
      snap.endpoints.length > 0
        ? `${snap.endpoints.length} RPC endpoint${snap.endpoints.length === 1 ? '' : 's'} configured for ${chainName}`
        : `No RPC URLs configured for ${chainName}`,
  });

  items.push({
    ok: snap.healthyCount > 0,
    text:
      snap.healthyCount > 0
        ? `${snap.healthyCount} endpoint${snap.healthyCount === 1 ? '' : 's'} passed eth_chainId`
        : 'No endpoint returned the correct chain ID',
  });

  if (preferred) {
    const pref = snap.endpoints.find(e => e.url === preferred);
    const prefOk = pref?.status === 'healthy' || pref?.status === 'slow';
    items.push({
      ok: !!prefOk,
      text: prefOk
        ? `Preferred RPC (${rpcProviderHint(preferred)}) is usable`
        : `Preferred RPC (${rpcHostLabel(preferred)}) is failing — switch or clear it`,
    });
  }

  const mismatch = snap.endpoints.find(e =>
    e.lastError?.toLowerCase().includes('wrong network'),
  );
  items.push({
    ok: !mismatch,
    text: mismatch
      ? `Chain ID mismatch on ${rpcHostLabel(mismatch.url)} — RPC points at a different network`
      : 'No chain ID mismatches detected',
  });

  if (lastError) {
    const rate = /rate|429|too many/i.test(lastError);
    items.push({
      ok: !rate,
      text: rate
        ? 'Rate limiting detected — public RPCs are throttling requests'
        : `Last error: ${lastError.slice(0, 120)}`,
    });
  }

  return items;
}

export function NetworkDoctorSheet({
  settings,
  onSaved,
}: {
  settings: AppSettings;
  onSaved: () => void;
}) {
  const [req, setReq] = useState<NetworkDoctorRequest | null>(null);
  const [snap, setSnap] = useState<ChainRpcHealthSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => subscribeNetworkDoctor(setReq), []);

  const chainId = req?.chainId ?? 0;
  const chain = chainById(chainId);
  const urls = useMemo(() => (chainId ? rpcUrlsFor(chainId) : []), [chainId, settings]);
  const preferred = chainId ? preferredRpcFor(chainId) : undefined;

  const refreshSnap = useCallback(() => {
    if (!chainId) return;
    setSnap(getChainHealthSnapshot(chainId, urls));
  }, [chainId, urls]);

  const runProbe = useCallback(
    async (probeAll = false) => {
      if (!chainId) return;
      setBusy(true);
      setErr(null);
      setActionMsg(null);
      try {
        const next = await probeChainRpcs(chainId, urls, {
          limit: probeAll ? Math.min(urls.length, 10) : 6,
          probeAll,
        });
        setSnap(next);
        if (next.healthyCount === 0) {
          setActionMsg('Still no healthy RPC. Try adding a private RPC in Networks.');
        } else {
          setActionMsg(
            `Found ${next.healthyCount} healthy endpoint${next.healthyCount === 1 ? '' : 's'}. Failover will prefer them.`,
          );
        }
      } catch (e) {
        setErr(describeError(e));
        refreshSnap();
      } finally {
        setBusy(false);
      }
    },
    [chainId, urls, refreshSnap],
  );

  useEffect(() => {
    if (!req) {
      setSnap(null);
      setErr(null);
      setActionMsg(null);
      return;
    }
    refreshSnap();
    void runProbe(req.reason === 'exhausted' || req.reason === 'probe_failed');
    // Only re-run when a new doctor request opens for a chain
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  if (!req) return null;

  const summary = snap ? summarizeChainHealth(snap) : null;
  const checks = snap
    ? diagnosisItems({
        snap,
        preferred,
        lastError: req.lastError,
        chainName: chain?.name ?? `Chain ${chainId}`,
      })
    : [];

  async function useHealthyRpc() {
    if (!snap) return;
    const healthy =
      snap.endpoints.find(e => e.status === 'healthy') ??
      snap.endpoints.find(e => e.status === 'slow');
    if (!healthy) {
      setErr('No healthy RPC to switch to yet. Run Probe all first.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      setStickyRpc(chainId, healthy.url);
      await patchSettings({
        preferredRpcByChain: {
          ...(settings.preferredRpcByChain ?? {}),
          [String(chainId)]: healthy.url,
        },
      });
      onSaved();
      setActionMsg(`Now using ${rpcProviderHint(healthy.url)} (${rpcHostLabel(healthy.url)})`);
      refreshSnap();
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function clearPreferred() {
    setBusy(true);
    setErr(null);
    try {
      const next = { ...(settings.preferredRpcByChain ?? {}) };
      delete next[String(chainId)];
      setStickyRpc(chainId, undefined);
      await patchSettings({ preferredRpcByChain: next });
      onSaved();
      setActionMsg('Cleared preferred RPC. Wallet will auto-pick a healthy endpoint.');
      await runProbe(true);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  const bannerTitle =
    req.reason === 'exhausted'
      ? 'Could not reach this network'
      : req.reason === 'probe_failed'
        ? 'RPC health check failed'
        : req.reason === 'switch'
          ? 'Checking network connection'
          : 'Network doctor';

  return (
    <div className="w1337-sheet-mount w1337-rpc-doctor">
      <button
        type="button"
        className="w1337-sheet-backdrop"
        aria-label="Close"
        onClick={() => closeNetworkDoctor()}
      />
      <div
        className="w1337-sheet-panel w1337-rpc-doctor__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rpc-doctor-title"
      >
        <div className="w1337-sheet-head">
          <button
            type="button"
            className="w1337-sheet-back"
            aria-label="Close"
            onClick={() => closeNetworkDoctor()}
          >
            ←
          </button>
          <h2 id="rpc-doctor-title" className="w1337-sheet-h2">
            Network doctor
          </h2>
        </div>

        <div className="w1337-rpc-doctor__body">
          <div
            className={`w1337-rpc-doctor__banner w1337-rpc-doctor__banner--${summary?.tone ?? 'unknown'}`}
          >
            <strong>{bannerTitle}</strong>
            <p>
              {chain?.name ?? `Chain ${chainId}`}
              {req.method ? ` · while calling ${req.method}` : ''}
            </p>
            {summary ? (
              <p className="w1337-rpc-doctor__banner-sub">
                {summary.label}: {summary.detail}
              </p>
            ) : (
              <p className="w1337-rpc-doctor__banner-sub muted">Probing endpoints…</p>
            )}
            {req.lastError ? (
              <p className="w1337-rpc-doctor__banner-err mono">{req.lastError}</p>
            ) : null}
          </div>

          <section className="w1337-rpc-doctor__section">
            <h3>What we checked</h3>
            <ul className="w1337-rpc-doctor__checks">
              {checks.map(c => (
                <li
                  key={c.text}
                  className={`w1337-rpc-doctor__check w1337-rpc-doctor__check--${c.ok ? 'ok' : 'bad'}`}
                >
                  <span aria-hidden>{c.ok ? '✓' : '!'}</span>
                  <span>{c.text}</span>
                </li>
              ))}
              {checks.length === 0 ? (
                <li className="w1337-rpc-doctor__check muted">Running probes…</li>
              ) : null}
            </ul>
          </section>

          <section className="w1337-rpc-doctor__section">
            <h3>RPC endpoints</h3>
            <ul className="w1337-rpc-doctor__list">
              {(snap?.endpoints ?? []).map(e => (
                <li key={e.url} className={`w1337-rpc-doctor__ep w1337-rpc-doctor__ep--${e.status}`}>
                  <div className="w1337-rpc-doctor__ep-main">
                    <span className="w1337-rpc-doctor__ep-status">{statusLabel(e.status)}</span>
                    <span className="w1337-rpc-doctor__ep-host">{rpcHostLabel(e.url)}</span>
                    <span className="w1337-rpc-doctor__ep-hint muted">
                      {rpcProviderHint(e.url)}
                      {e.lastLatencyMs != null ? ` · ${e.lastLatencyMs}ms` : ''}
                      {preferred === e.url ? ' · preferred' : ''}
                      {snap?.activeUrl === e.url ? ' · active' : ''}
                    </span>
                  </div>
                  {e.lastError ? (
                    <p className="w1337-rpc-doctor__ep-err">{e.lastError}</p>
                  ) : null}
                </li>
              ))}
              {urls.length === 0 ? (
                <li className="muted">No endpoints listed for this chain.</li>
              ) : null}
            </ul>
          </section>

          {err ? <p className="error">{err}</p> : null}
          {actionMsg ? <p className="w1337-rpc-doctor__msg">{actionMsg}</p> : null}

          <div className="w1337-rpc-doctor__actions">
            <button
              type="button"
              className="w1337-rpc-doctor__btn w1337-rpc-doctor__btn--primary"
              disabled={busy}
              onClick={() => void runProbe(true)}
            >
              {busy ? 'Probing…' : 'Probe all RPCs'}
            </button>
            <button
              type="button"
              className="w1337-rpc-doctor__btn"
              disabled={busy || !snap || snap.healthyCount === 0}
              onClick={() => void useHealthyRpc()}
            >
              Use healthy RPC
            </button>
            <button
              type="button"
              className="w1337-rpc-doctor__btn"
              disabled={busy || !preferred}
              onClick={() => void clearPreferred()}
            >
              Clear preferred
            </button>
            <button
              type="button"
              className="w1337-rpc-doctor__btn"
              disabled={busy}
              onClick={() => closeNetworkDoctor()}
            >
              Done
            </button>
          </div>

          <p className="w1337-rpc-doctor__hint muted">
            Tip: if public RPCs keep failing (geo blocks / rate limits), add your own Alchemy or
            Infura URL under Settings → Networks &amp; RPCs.
          </p>
        </div>
      </div>
    </div>
  );
}
