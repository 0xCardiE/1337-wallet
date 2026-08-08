import { useEffect, useMemo, useState } from 'react';
import {
  effectiveActiveChainId,
  patchSettings,
  type AppSettings,
} from '../lib/storageState';
import {
  allChains,
  chainById,
  chainsByKind,
  type ChainDefinition,
  type ChainKind,
} from '../lib/chainCatalog';
import { chainLogoUri } from '../lib/chainLogo';
import { notifyConnectedTabsChainChanged } from '../lib/chainSyncBridge';
import { allRpcOptionsFor, rpcUrlsFor } from '../lib/chainRpcRegistry';
import { openNetworkDoctor } from '../lib/rpcDoctorBridge';
import {
  getChainHealthSnapshot,
  probeChainRpcs,
  rpcHostLabel,
  rpcProviderHint,
  setStickyRpc,
  subscribeRpcHealth,
  summarizeChainHealth,
} from '../lib/rpcHealth';
import { describeError } from '../lib/utils';
import { Select1337, Segment1337, type Select1337Group } from './Select1337';

type NetFilter = ChainKind;

function chainGroups(kind: NetFilter): Select1337Group[] {
  const label = kind === 'mainnet' ? 'Mainnets' : 'Testnets';
  return [{ label, options: chainsByKind(kind).map(chainToOption) }];
}

function defaultChainForKind(kind: NetFilter): number {
  return chainsByKind(kind)[0]?.chainId ?? 1;
}

function shortRpcLabel(url: string): string {
  return rpcHostLabel(url);
}

function chainToOption(c: ChainDefinition) {
  return {
    value: String(c.chainId),
    label: c.name,
    sublabel: c.kind === 'testnet' ? `Testnet · ${c.chainId}` : String(c.chainId),
    logoURI: chainLogoUri(c),
  };
}

type Props = {
  settings: AppSettings;
  onSaved: () => void;
  compact?: boolean;
};

export function NetworkSelector({ settings, onSaved }: Props) {
  const activeChainId = effectiveActiveChainId(settings);
  const activeChain = chainById(activeChainId);
  const netFilter: NetFilter = activeChain?.kind ?? 'mainnet';
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [healthTick, setHealthTick] = useState(0);

  const allUrls = useMemo(
    () => rpcUrlsFor(activeChainId),
    [activeChainId, settings.preferredRpcByChain, settings.customRpcByChain, settings.customChains],
  );

  const rpcOptions = useMemo(
    () => allRpcOptionsFor(activeChainId),
    [activeChainId, settings.preferredRpcByChain, settings.customRpcByChain, healthTick],
  );

  const rpcUrl = useMemo(() => {
    const preferred = settings.preferredRpcByChain?.[String(activeChainId)];
    const snap = getChainHealthSnapshot(activeChainId, allUrls);
    const prefHealth = preferred
      ? snap.endpoints.find(e => e.url === preferred)
      : undefined;
    // Don't present a demoted preferred as "active" — sticky healthy wins
    if (
      preferred &&
      rpcOptions.includes(preferred) &&
      prefHealth?.status !== 'unhealthy'
    ) {
      return preferred;
    }
    if (snap.activeUrl && rpcOptions.includes(snap.activeUrl)) return snap.activeUrl;
    return rpcOptions[0] ?? '';
  }, [activeChainId, settings.preferredRpcByChain, rpcOptions, allUrls, healthTick]);

  const healthSummary = useMemo(() => {
    const snap = getChainHealthSnapshot(activeChainId, allUrls);
    return summarizeChainHealth(snap);
  }, [activeChainId, allUrls, healthTick]);

  useEffect(() => subscribeRpcHealth(id => {
    if (id === activeChainId) setHealthTick(t => t + 1);
  }), [activeChainId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (allUrls.length === 0) return;
      await probeChainRpcs(activeChainId, allUrls, { limit: 4 });
      if (!cancelled) setHealthTick(t => t + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeChainId, allUrls.join('|')]);

  const chainGroupsMemo = useMemo(
    () => chainGroups(netFilter),
    [netFilter, settings.customChains],
  );

  const rpcGroups = useMemo<Select1337Group[]>(
    () => [
      {
        label: 'RPC endpoints',
        options: rpcOptions.map(u => {
          const h = getChainHealthSnapshot(activeChainId, allUrls).endpoints.find(
            e => e.url === u,
          );
          const statusBit =
            h?.status === 'healthy'
              ? 'Healthy'
              : h?.status === 'slow'
                ? 'Slow'
                : h?.status === 'unhealthy'
                  ? 'Down'
                  : 'Unchecked';
          return {
            value: u,
            label: shortRpcLabel(u),
            sublabel: `${rpcProviderHint(u)} · ${statusBit}${
              h?.lastLatencyMs != null ? ` · ${h.lastLatencyMs}ms` : ''
            }`,
          };
        }),
      },
    ],
    [rpcOptions, activeChainId, allUrls, healthTick],
  );

  async function onChainChange(nextId: number) {
    if (nextId === activeChainId || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await patchSettings({ activeChainId: nextId });
      await notifyConnectedTabsChainChanged(nextId);
      onSaved();
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onRpcChange(nextUrl: string) {
    if (!nextUrl.trim() || nextUrl === rpcUrl || busy) return;
    setBusy(true);
    setErr(null);
    try {
      setStickyRpc(activeChainId, nextUrl.trim());
      await patchSettings({
        preferredRpcByChain: {
          ...(settings.preferredRpcByChain ?? {}),
          [String(activeChainId)]: nextUrl.trim(),
        },
      });
      onSaved();
      setHealthTick(t => t + 1);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onFilterChange(next: NetFilter) {
    if (next === netFilter || busy) return;
    setOpenMenu(null);
    await onChainChange(defaultChainForKind(next));
  }

  const activeInCatalog = allChains().some(c => c.chainId === activeChainId);

  return (
    <div className="w1337-net-select">
      <Segment1337
        value={netFilter}
        onChange={v => void onFilterChange(v as NetFilter)}
        options={[
          { value: 'mainnet', label: 'Mainnets' },
          { value: 'testnet', label: 'Testnets' },
        ]}
      />

      <div className="w1337-net-select__row">
        <Select1337
          id="w1337-chain"
          label="Chain"
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          value={String(activeChainId)}
          triggerLabel={activeChain?.name ?? `Chain ${activeChainId}`}
          triggerSublabel={
            activeChain
              ? activeChain.kind === 'testnet'
                ? 'Testnet'
                : 'Mainnet'
              : activeInCatalog
                ? undefined
                : 'Custom'
          }
          triggerLogoURI={activeChain ? chainLogoUri(activeChain) : undefined}
          groups={chainGroupsMemo}
          disabled={busy}
          panelMaxHeight={320}
          onPick={v => void onChainChange(Number(v))}
        />

        <Select1337
          id="w1337-rpc"
          label="RPC"
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          value={rpcUrl}
          triggerLabel={rpcUrl ? shortRpcLabel(rpcUrl) : 'No RPC'}
          triggerSublabel={rpcUrl ? rpcProviderHint(rpcUrl) : undefined}
          groups={rpcGroups}
          disabled={busy || rpcOptions.length === 0}
          panelMaxHeight={300}
          onPick={v => void onRpcChange(v)}
        />
      </div>

      <div className="w1337-rpc-status">
        <span
          className={`w1337-rpc-status__dot w1337-rpc-status__dot--${healthSummary.tone}`}
          aria-hidden
        />
        <span className="w1337-rpc-status__text">
          <strong>{healthSummary.label}</strong>
          <span className="muted"> · {healthSummary.detail}</span>
        </span>
        <button
          type="button"
          className="w1337-rpc-status__doctor"
          onClick={() =>
            openNetworkDoctor({
              chainId: activeChainId,
              reason: healthSummary.tone === 'bad' ? 'probe_failed' : 'manual',
              lastError: healthSummary.tone === 'bad' ? healthSummary.detail : undefined,
            })
          }
        >
          Doctor
        </button>
      </div>

      {err ? <p className="error w1337-net-select__err">{err}</p> : null}
    </div>
  );
}
