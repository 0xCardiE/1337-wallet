import { useCallback, useMemo, useState } from 'react';
import {
  effectiveActiveChainId,
  patchSettings,
  type AppSettings,
} from '../lib/storageState';
import {
  chainById,
  chainsOrdered,
  getCustomChains,
  isCuratedChain,
  type ChainDefinition,
  type ChainKind,
} from '../lib/chainCatalog';
import { chainLogoUri } from '../lib/chainLogo';
import { notifyConnectedTabsChainChanged } from '../lib/chainSyncBridge';
import { rpcListForManage, rpcOrderFor } from '../lib/chainRpcRegistry';
import { applyOrder, mergeKindOrder, moveToFront } from '../lib/listOrder';
import { describeError } from '../lib/utils';
import { LiFiIcon } from './LiFiIcon';
import { ReorderHandle } from './ReorderHandle';
import { ScreenHeader } from './ScreenHeader';
import { SimpleSelect1337 } from './Select1337';
import { usePointerReorder } from './usePointerReorder';

type Panel = 'list' | 'detail' | 'add';

function shortRpcLabel(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : u.pathname;
    return `${u.host}${path}`;
  } catch {
    return url;
  }
}

function slugify(name: string, chainId: number): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return s || `chain-${chainId}`;
}

export function NetworksManageView({
  settings,
  onSaved,
  onBack,
}: {
  settings: AppSettings;
  onSaved: () => void;
  onBack: () => void;
}) {
  const activeChainId = effectiveActiveChainId(settings);
  const [panel, setPanel] = useState<Panel>('list');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<ChainKind>('mainnet');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [rpcDraft, setRpcDraft] = useState('');

  const [addName, setAddName] = useState('');
  const [addChainId, setAddChainId] = useState('');
  const [addSymbol, setAddSymbol] = useState('ETH');
  const [addRpcUrl, setAddRpcUrl] = useState('');
  const [addExplorer, setAddExplorer] = useState('');
  const [addKind, setAddKind] = useState<ChainKind>('mainnet');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const chains = useMemo(
    () => chainsOrdered(filter, settings.chainOrder),
    [filter, settings.chainOrder, settings.customChains],
  );
  const chainIds = useMemo(() => chains.map(c => c.chainId), [chains]);

  const selected = selectedId != null ? chainById(selectedId) : undefined;
  const rpcOptions = useMemo(
    () => (selectedId != null ? rpcListForManage(selectedId, 20) : []),
    [
      selectedId,
      settings.preferredRpcByChain,
      settings.customRpcByChain,
      settings.rpcOrderByChain,
      settings.customChains,
    ],
  );
  const preferredRpc =
    selectedId != null
      ? settings.preferredRpcByChain?.[String(selectedId)]
      : undefined;
  const userRpcs =
    selectedId != null ? settings.customRpcByChain?.[String(selectedId)] ?? [] : [];

  const commitChainOrder = useCallback(
    (nextIds: number[]) => {
      const otherKind: ChainKind = filter === 'mainnet' ? 'testnet' : 'mainnet';
      const others = chainsOrdered(otherKind, settings.chainOrder).map(c => c.chainId);
      const chainOrder = mergeKindOrder(
        settings.chainOrder,
        nextIds,
        others,
        filter === 'mainnet',
      );
      void (async () => {
        setBusy(true);
        setErr(null);
        try {
          await patchSettings({ chainOrder });
          onSaved();
        } catch (e) {
          setErr(describeError(e));
        } finally {
          setBusy(false);
        }
      })();
    },
    [filter, onSaved, settings.chainOrder],
  );

  const commitRpcOrder = useCallback(
    (next: string[]) => {
      if (selectedId == null || !next.length) return;
      const key = String(selectedId);
      void (async () => {
        setBusy(true);
        setErr(null);
        try {
          await patchSettings({
            rpcOrderByChain: {
              ...(settings.rpcOrderByChain ?? {}),
              [key]: next,
            },
            preferredRpcByChain: {
              ...(settings.preferredRpcByChain ?? {}),
              [key]: next[0]!,
            },
          });
          onSaved();
        } catch (e) {
          setErr(describeError(e));
        } finally {
          setBusy(false);
        }
      })();
    },
    [onSaved, selectedId, settings.preferredRpcByChain, settings.rpcOrderByChain],
  );

  const chainReorder = usePointerReorder(chainIds, commitChainOrder);
  const rpcReorder = usePointerReorder(rpcOptions, commitRpcOrder);
  const shownChains = useMemo(
    () =>
      chainReorder.shown
        .map(id => chainById(id))
        .filter((c): c is ChainDefinition => !!c),
    [chainReorder.shown],
  );

  function openDetail(id: number) {
    setSelectedId(id);
    setRpcDraft('');
    setErr(null);
    setMsg(null);
    setPanel('detail');
  }

  function openAdd() {
    setAddName('');
    setAddChainId('');
    setAddSymbol('ETH');
    setAddRpcUrl('');
    setAddExplorer('');
    setAddKind('mainnet');
    setErr(null);
    setMsg(null);
    setPanel('add');
  }

  async function useNetwork(chainId: number) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await patchSettings({ activeChainId: chainId });
      await notifyConnectedTabsChainChanged(chainId);
      onSaved();
      setMsg(`Active network: ${chainById(chainId)?.name ?? chainId}`);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function setPreferred(chainId: number, url: string) {
    if (busy || !url.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const key = String(chainId);
      const existingOrder = rpcOrderFor(chainId);
      const nextOrder = existingOrder?.length
        ? moveToFront(applyOrder(rpcListForManage(chainId, 20), existingOrder), url.trim())
        : undefined;
      await patchSettings({
        preferredRpcByChain: {
          ...(settings.preferredRpcByChain ?? {}),
          [key]: url.trim(),
        },
        ...(nextOrder
          ? {
              rpcOrderByChain: {
                ...(settings.rpcOrderByChain ?? {}),
                [key]: nextOrder,
              },
            }
          : {}),
      });
      onSaved();
      setMsg('Preferred RPC updated');
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function addCustomRpc(chainId: number) {
    const url = rpcDraft.trim();
    if (!url) return;
    try {
      // basic URL check
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setErr('RPC must be http(s)');
        return;
      }
    } catch {
      setErr('Enter a valid RPC URL');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const key = String(chainId);
      const list = [...(settings.customRpcByChain?.[key] ?? [])];
      if (!list.includes(url)) list.push(url);
      const existingOrder = settings.rpcOrderByChain?.[key];
      const ranked = existingOrder?.length
        ? moveToFront(applyOrder([...rpcListForManage(chainId, 20), url], existingOrder), url)
        : undefined;
      await patchSettings({
        customRpcByChain: {
          ...(settings.customRpcByChain ?? {}),
          [key]: list,
        },
        preferredRpcByChain: {
          ...(settings.preferredRpcByChain ?? {}),
          [key]: url,
        },
        ...(ranked
          ? {
              rpcOrderByChain: {
                ...(settings.rpcOrderByChain ?? {}),
                [key]: ranked,
              },
            }
          : {}),
      });
      setRpcDraft('');
      onSaved();
      setMsg('RPC added');
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeUserRpc(chainId: number, url: string) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const key = String(chainId);
      const list = (settings.customRpcByChain?.[key] ?? []).filter(u => u !== url);
      const preferred = { ...(settings.preferredRpcByChain ?? {}) };
      if (preferred[key] === url) delete preferred[key];
      const customRpcByChain = { ...(settings.customRpcByChain ?? {}) };
      if (list.length) customRpcByChain[key] = list;
      else delete customRpcByChain[key];
      const rpcOrderByChain = { ...(settings.rpcOrderByChain ?? {}) };
      if (rpcOrderByChain[key]?.length) {
        const next = rpcOrderByChain[key]!.filter(u => u !== url);
        if (next.length) rpcOrderByChain[key] = next;
        else delete rpcOrderByChain[key];
      }
      await patchSettings({ customRpcByChain, preferredRpcByChain: preferred, rpcOrderByChain });
      onSaved();
      setMsg('RPC removed');
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeCustomChain(chainId: number) {
    if (busy || isCuratedChain(chainId)) return;
    if (!confirm(`Remove custom chain ${chainById(chainId)?.name ?? chainId}?`)) return;
    setBusy(true);
    setErr(null);
    try {
      const customChains = getCustomChains().filter(c => c.chainId !== chainId);
      const preferred = { ...(settings.preferredRpcByChain ?? {}) };
      const customRpc = { ...(settings.customRpcByChain ?? {}) };
      const rpcOrderByChain = { ...(settings.rpcOrderByChain ?? {}) };
      delete preferred[String(chainId)];
      delete customRpc[String(chainId)];
      delete rpcOrderByChain[String(chainId)];
      const chainOrder = (settings.chainOrder ?? []).filter(id => id !== chainId);
      const patch: AppSettings = {
        customChains,
        preferredRpcByChain: preferred,
        customRpcByChain: customRpc,
        rpcOrderByChain,
        ...(chainOrder.length ? { chainOrder } : { chainOrder: undefined }),
      };
      if (effectiveActiveChainId(settings) === chainId) {
        patch.activeChainId = 1;
      }
      await patchSettings(patch);
      if (patch.activeChainId === 1) {
        await notifyConnectedTabsChainChanged(1);
      }
      onSaved();
      setPanel('list');
      setSelectedId(null);
      setMsg('Custom chain removed');
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitAddChain() {
    const name = addName.trim();
    const cid = Number(addChainId.trim());
    const symbol = addSymbol.trim() || 'ETH';
    const rpc = addRpcUrl.trim();
    const explorer = addExplorer.trim();
    if (!name) {
      setErr('Name is required');
      return;
    }
    if (!Number.isFinite(cid) || cid <= 0 || !Number.isInteger(cid)) {
      setErr('Enter a valid numeric chain ID');
      return;
    }
    if (chainById(cid)) {
      setErr(`Chain ${cid} already exists`);
      return;
    }
    if (!rpc) {
      setErr('At least one RPC URL is required');
      return;
    }
    try {
      const parsed = new URL(rpc);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setErr('RPC must be http(s)');
        return;
      }
    } catch {
      setErr('Enter a valid RPC URL');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const def: ChainDefinition = {
        chainId: cid,
        name,
        shortName: slugify(name, cid),
        kind: addKind,
        nativeCurrency: { name: symbol, symbol, decimals: 18 },
        rpcUrls: [rpc],
        blockExplorerUrls: explorer ? [explorer.replace(/\/$/, '')] : [],
      };
      const existingOrder = settings.chainOrder;
      const ranked = existingOrder?.length ? [...existingOrder, cid] : undefined;
      await patchSettings({
        customChains: [...getCustomChains(), def],
        preferredRpcByChain: {
          ...(settings.preferredRpcByChain ?? {}),
          [String(cid)]: rpc,
        },
        ...(ranked ? { chainOrder: ranked } : {}),
      });
      onSaved();
      setPanel('list');
      setMsg(`Added ${name}`);
      openDetail(cid);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  const headerBack = () => {
    if (panel === 'list') onBack();
    else {
      setPanel('list');
      setSelectedId(null);
      setErr(null);
    }
  };

  const title =
    panel === 'add'
      ? 'Add chain'
      : panel === 'detail' && selected
        ? selected.name
        : 'Networks';

  return (
    <div className="wallet-shell w1337 w1337--networks-manage">
      <ScreenHeader title={title} onClose={headerBack} />
      <div className="screen-body w1337-body w1337-networks">
        {panel === 'list' ? (
          <>
            <p className="muted w1337-networks__lead">
              Manage chains and RPC endpoints. Drag to put the ones you use at the top.
            </p>

            <div className="w1337-networks__toolbar">
              <div className="w1337-networks__filters" role="group" aria-label="Filter chains">
                {(
                  [
                    ['mainnet', 'Mainnets'],
                    ['testnet', 'Testnets'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      filter === value
                        ? 'w1337-networks__chip w1337-networks__chip--on'
                        : 'w1337-networks__chip'
                    }
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" className="ghost w1337-networks__add-btn" onClick={openAdd}>
                Add chain
              </button>
            </div>

            <ul
              className={
                chainReorder.dragging
                  ? 'w1337-networks__list w1337-networks__list--dragging'
                  : 'w1337-networks__list'
              }
              ref={chainReorder.listRef}
            >
              {shownChains.map((c, i) => {
                const active = c.chainId === activeChainId;
                const custom = !isCuratedChain(c.chainId);
                return (
                  <li
                    key={c.chainId}
                    className={
                      active
                        ? 'w1337-networks__item w1337-networks__item--active'
                        : 'w1337-networks__item'
                    }
                    data-reorder-row
                  >
                    <ReorderHandle
                      label={`Reorder ${c.name}`}
                      disabled={busy}
                      onPointerDown={e => chainReorder.start(i, e)}
                      onPointerMove={chainReorder.move}
                      onPointerUp={chainReorder.end}
                      onPointerCancel={chainReorder.end}
                      onNudge={delta => chainReorder.moveByKeyboard(i, delta)}
                    />
                    <button
                      type="button"
                      className={
                        active
                          ? 'w1337-networks__row w1337-networks__row--active'
                          : 'w1337-networks__row'
                      }
                      onClick={() => openDetail(c.chainId)}
                    >
                      <LiFiIcon
                        logoURI={chainLogoUri(c)}
                        label={c.name}
                        size={28}
                        rounded
                      />
                      <span className="w1337-networks__row-text">
                        <span className="w1337-networks__row-name">
                          {c.name}
                          {custom ? (
                            <span className="w1337-networks__badge">Custom</span>
                          ) : null}
                          {active ? (
                            <span className="w1337-networks__badge w1337-networks__badge--on">
                              Active
                            </span>
                          ) : null}
                        </span>
                        <span className="w1337-networks__row-sub muted">
                          Chain ID {c.chainId}
                          {c.kind === 'testnet' ? ' · Testnet' : ''}
                        </span>
                      </span>
                      <span className="w1337-networks__chev" aria-hidden>
                        ›
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        {panel === 'detail' && selected ? (
          <>
            <div className="w1337-networks__detail-head">
              <LiFiIcon
                logoURI={chainLogoUri(selected)}
                label={selected.name}
                size={36}
                rounded
              />
              <div>
                <p className="w1337-networks__detail-name">{selected.name}</p>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                  ID {selected.chainId} · {selected.nativeCurrency.symbol}
                  {!isCuratedChain(selected.chainId) ? ' · Custom' : ''}
                </p>
              </div>
            </div>

            {selected.chainId !== activeChainId ? (
              <button
                type="button"
                className="primary"
                style={{ width: '100%', marginBottom: 14 }}
                disabled={busy}
                onClick={() => void useNetwork(selected.chainId)}
              >
                Use this network
              </button>
            ) : (
              <p className="muted w1337-networks__active-note">Currently active in wallet &amp; dapps</p>
            )}

            <h3 className="w1337-networks__section-title">RPC endpoints</h3>
            <p className="muted w1337-networks__rpc-hint">
              Drag to rank. Top of the list is preferred.
            </p>
            <ul
              className={
                rpcReorder.dragging
                  ? 'w1337-networks__rpc-list w1337-networks__list--dragging'
                  : 'w1337-networks__rpc-list'
              }
              ref={rpcReorder.listRef}
            >
              {rpcReorder.shown.map((url, i) => {
                const rankedPreferred = rpcReorder.dragging
                  ? rpcReorder.shown[0]
                  : (preferredRpc ?? rpcReorder.shown[0]);
                const isPreferred = rankedPreferred === url;
                const isUser = userRpcs.includes(url);
                return (
                  <li
                    key={url}
                    className={
                      isPreferred
                        ? 'w1337-networks__rpc-row w1337-networks__rpc-row--on'
                        : 'w1337-networks__rpc-row'
                    }
                    data-reorder-row
                  >
                    <ReorderHandle
                      label={`Reorder ${shortRpcLabel(url)}`}
                      disabled={busy}
                      onPointerDown={e => rpcReorder.start(i, e)}
                      onPointerMove={rpcReorder.move}
                      onPointerUp={rpcReorder.end}
                      onPointerCancel={rpcReorder.end}
                      onNudge={delta => rpcReorder.moveByKeyboard(i, delta)}
                    />
                    <button
                      type="button"
                      className={
                        isPreferred
                          ? 'w1337-networks__rpc-pick w1337-networks__rpc-pick--on'
                          : 'w1337-networks__rpc-pick'
                      }
                      disabled={busy}
                      onClick={() => void setPreferred(selected.chainId, url)}
                      title={url}
                    >
                      <span className="w1337-networks__rpc-label">{shortRpcLabel(url)}</span>
                      {isPreferred ? (
                        <span className="w1337-networks__badge w1337-networks__badge--on">Preferred</span>
                      ) : null}
                    </button>
                    {isUser ? (
                      <button
                        type="button"
                        className="ghost w1337-networks__rpc-remove"
                        disabled={busy}
                        aria-label="Remove RPC"
                        onClick={() => void removeUserRpc(selected.chainId, url)}
                      >
                        ×
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <label htmlFor="net-add-rpc" className="w1337-networks__section-title" style={{ display: 'block' }}>
              Add RPC
            </label>
            <div className="row" style={{ marginBottom: 8 }}>
              <input
                id="net-add-rpc"
                value={rpcDraft}
                onChange={e => setRpcDraft(e.target.value)}
                placeholder="https://…"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="ghost"
                disabled={busy || !rpcDraft.trim()}
                onClick={() => void addCustomRpc(selected.chainId)}
              >
                Add
              </button>
            </div>

            {!isCuratedChain(selected.chainId) ? (
              <button
                type="button"
                className="danger"
                style={{ width: '100%', marginTop: 18 }}
                disabled={busy}
                onClick={() => void removeCustomChain(selected.chainId)}
              >
                Remove custom chain
              </button>
            ) : null}
          </>
        ) : null}

        {panel === 'add' ? (
          <>
            <p className="muted w1337-networks__lead">
              Add a custom EVM network. It appears in the chain picker alongside curated networks.
            </p>

            <label htmlFor="add-name">Name</label>
            <input
              id="add-name"
              value={addName}
              onChange={e => setAddName(e.target.value)}
              placeholder="My Chain"
            />

            <label htmlFor="add-id" style={{ marginTop: 12 }}>
              Chain ID
            </label>
            <input
              id="add-id"
              value={addChainId}
              onChange={e => setAddChainId(e.target.value)}
              placeholder="100"
              inputMode="numeric"
            />

            <label htmlFor="add-symbol" style={{ marginTop: 12 }}>
              Native symbol
            </label>
            <input
              id="add-symbol"
              value={addSymbol}
              onChange={e => setAddSymbol(e.target.value)}
              placeholder="ETH"
            />

            <SimpleSelect1337
              id="add-kind"
              label="Network type"
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              value={addKind}
              options={[
                { value: 'mainnet', label: 'Mainnet' },
                { value: 'testnet', label: 'Testnet' },
              ]}
              onChange={v => setAddKind(v as ChainKind)}
            />

            <label htmlFor="add-rpc" style={{ marginTop: 12 }}>
              RPC URL
            </label>
            <input
              id="add-rpc"
              value={addRpcUrl}
              onChange={e => setAddRpcUrl(e.target.value)}
              placeholder="https://…"
            />

            <label htmlFor="add-explorer" style={{ marginTop: 12 }}>
              Block explorer (optional)
            </label>
            <input
              id="add-explorer"
              value={addExplorer}
              onChange={e => setAddExplorer(e.target.value)}
              placeholder="https://…"
            />

            <button
              type="button"
              className="primary"
              style={{ width: '100%', marginTop: 16 }}
              disabled={busy}
              onClick={() => void submitAddChain()}
            >
              {busy ? '…' : 'Add chain'}
            </button>
          </>
        ) : null}

        {msg ? (
          <p className="muted" style={{ color: 'var(--ok)', marginTop: 12 }}>
            {msg}
          </p>
        ) : null}
        {err ? <p className="error">{err}</p> : null}
      </div>
    </div>
  );
}
