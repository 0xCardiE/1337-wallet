import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  fetchLlamaYieldDataset,
  rankYieldPoolsToVaults,
  sortedCategoriesPresentInPools,
  sortedUniqueChains,
  type LlamaYieldDataset,
} from '../lib/defiLlamaYields';
import type { VaultOpportunity } from '../lib/vaultOpportunity';
import { LiFiIcon } from './LiFiIcon';

function ExternalLinkIcon() {
  return (
    <svg
      className="w1337-defi-external__svg"
      xmlns="http://www.w3.org/2000/svg"
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

const MAX_ROWS = 55;

const TVL_CAP_OPTIONS: { max?: number; label: string }[] = [
  { label: 'Any' },
  { max: 250_000, label: 'Below $250k' },
  { max: 500_000, label: 'Below $500k' },
  { max: 1_000_000, label: 'Below $1M' },
  { max: 5_000_000, label: 'Below $5M' },
  { max: 10_000_000, label: 'Below $10M' },
];

function fmtPct(apy: number): string {
  if (!Number.isFinite(apy)) return '—';
  if (apy >= 1000) return `${apy.toFixed(0)}%`;
  if (apy >= 100) return `${apy.toFixed(1)}%`;
  return `${apy.toFixed(2)}%`;
}

function fmtTvlUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function DefiDdOption({
  selected,
  onPick,
  children,
}: {
  selected: boolean;
  onPick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={`w1337-defi-dd__option${selected ? ' w1337-defi-dd__option--on' : ''}`}
      onClick={onPick}
    >
      {children}
    </button>
  );
}

function DefiFilterDd({
  label,
  id,
  openMenu,
  setOpenMenu,
  triggerText,
  disabled,
  title,
  children,
}: {
  label: string;
  id: string;
  openMenu: string | null;
  setOpenMenu: (v: string | null) => void;
  triggerText: string;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}) {
  const open = openMenu === id;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, setOpenMenu]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpenMenu]);

  return (
    <div
      ref={rootRef}
      className={`w1337-defi-filter w1337-defi-dd${open ? ' w1337-defi-dd--open' : ''}`}
    >
      <span className="w1337-defi-filter__label">{label}</span>
      <button
        type="button"
        className={`w1337-defi-dd__trigger${open ? ' w1337-defi-dd__trigger--open' : ''}`}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={title}
        onClick={() => setOpenMenu(open ? null : id)}
      >
        <span className="w1337-defi-dd__value">{triggerText}</span>
        <span className="w1337-defi-dd__chev" aria-hidden>
          <ChevronDownIcon />
        </span>
      </button>
      {open ? (
        <div className="w1337-defi-dd__panel" role="listbox">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function DefiYieldPanel() {
  const [dataset, setDataset] = useState<LlamaYieldDataset | null>(null);
  const [chainFilter, setChainFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [maxTvlUsd, setMaxTvlUsd] = useState<number | undefined>(undefined);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runFetch = useCallback(async (signal: AbortSignal) => {
    setBusy(true);
    setErr(null);
    try {
      const next = await fetchLlamaYieldDataset(signal);
      setDataset(next);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      setErr(e instanceof Error ? e.message : String(e));
      setDataset(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void runFetch(ac.signal);
    return () => ac.abort();
  }, [runFetch]);

  useEffect(() => {
    if (!dataset) return;
    const chains = sortedUniqueChains(dataset.pools);
    const cats = sortedCategoriesPresentInPools(dataset.pools, dataset.categoryMap);
    setChainFilter(prev => (prev && chains.includes(prev) ? prev : ''));
    setCategoryFilter(prev => (prev && cats.includes(prev) ? prev : ''));
  }, [dataset]);

  const chainOptions = useMemo(
    () => (dataset ? sortedUniqueChains(dataset.pools) : []),
    [dataset],
  );

  const categoryOptions = useMemo(
    () =>
      dataset ? sortedCategoriesPresentInPools(dataset.pools, dataset.categoryMap) : [],
    [dataset],
  );

  const tvlTriggerLabel = useMemo(() => {
    const hit = TVL_CAP_OPTIONS.find(
      o => (o.max === undefined && maxTvlUsd === undefined) || o.max === maxTvlUsd,
    );
    return hit?.label ?? 'Any';
  }, [maxTvlUsd]);

  const rows = useMemo((): VaultOpportunity[] => {
    if (!dataset) return [];
    return rankYieldPoolsToVaults(dataset.pools, dataset.categoryMap, {
      maxRows: MAX_ROWS,
      chain: chainFilter || undefined,
      category: categoryFilter || undefined,
      maxTvlUsd,
    });
  }, [dataset, maxTvlUsd, chainFilter, categoryFilter]);

  const showFilters = dataset !== null;
  const showLoading = busy && dataset === null && !err;
  const showEmpty = dataset !== null && rows.length === 0 && !busy;

  const close = () => setOpenMenu(null);

  return (
    <div className="w1337-defi">
      <p className="w1337-defi__powered">Powered by Li.Fi and Vaults.fyi</p>
      {showFilters ? (
        <div className="w1337-defi__filters" role="search" aria-label="Filter yield pools">
          <DefiFilterDd
            label="Chain"
            id="chain"
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            triggerText={chainFilter || 'All chains'}
          >
            <DefiDdOption selected={chainFilter === ''} onPick={() => { setChainFilter(''); close(); }}>
              All chains
            </DefiDdOption>
            {chainOptions.map(c => (
              <DefiDdOption
                key={c}
                selected={chainFilter === c}
                onPick={() => {
                  setChainFilter(c);
                  close();
                }}
              >
                {c}
              </DefiDdOption>
            ))}
          </DefiFilterDd>

          <DefiFilterDd
            label="Type"
            id="type"
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            triggerText={categoryFilter || 'All types'}
            disabled={categoryOptions.length === 0}
            title={
              categoryOptions.length === 0
                ? 'Protocol categories unavailable'
                : 'Protocol category (DefiLlama)'
            }
          >
            <DefiDdOption
              selected={categoryFilter === ''}
              onPick={() => {
                setCategoryFilter('');
                close();
              }}
            >
              All types
            </DefiDdOption>
            {categoryOptions.map(c => (
              <DefiDdOption
                key={c}
                selected={categoryFilter === c}
                onPick={() => {
                  setCategoryFilter(c);
                  close();
                }}
              >
                {c}
              </DefiDdOption>
            ))}
          </DefiFilterDd>

          <DefiFilterDd
            label="TVL"
            id="tvl"
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            triggerText={tvlTriggerLabel}
            title="Maximum pool TVL (USD)"
          >
            {TVL_CAP_OPTIONS.map(o => {
              const selected =
                (o.max === undefined && maxTvlUsd === undefined) || o.max === maxTvlUsd;
              return (
                <DefiDdOption
                  key={o.label}
                  selected={selected}
                  onPick={() => {
                    setMaxTvlUsd(o.max);
                    close();
                  }}
                >
                  {o.label}
                </DefiDdOption>
              );
            })}
          </DefiFilterDd>
        </div>
      ) : null}
      {err ? <p className="error w1337-defi__err">{err}</p> : null}
      {showLoading ? (
        <p className="muted w1337-defi__loading">Loading yield data…</p>
      ) : null}
      {showEmpty ? (
        <p className="muted w1337-defi__empty">No pools matched the filters.</p>
      ) : null}
      {rows.length > 0 ? (
        <ul className="w1337-defi__list">
          {rows.map(v => {
            const depositLabel = v.asset?.trim();
            const category = v.protocolCategory?.trim();
            return (
              <li key={v.id} className="w1337-defi-card">
                <div className="w1337-defi-card__head">
                  <LiFiIcon logoURI={v.protocolLogo} label={v.protocol} size={40} rounded />
                  <div className="w1337-defi-card__titles">
                    <span className="w1337-defi-card__protocol">{v.protocol}</span>
                    <span className="muted w1337-defi-card__chain">{v.chain}</span>
                  </div>
                  {category || v.depositUrl ? (
                    <div className="w1337-defi-card__head-aside">
                      {category ? (
                        <span className="w1337-defi-card__category-pill">{category}</span>
                      ) : null}
                      {v.depositUrl ? (
                        <a
                          className="w1337-defi-external"
                          href={v.depositUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="View protocol"
                          title="View protocol"
                        >
                          <ExternalLinkIcon />
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div
                  className={`w1337-defi-card__metrics${
                    depositLabel ? ' w1337-defi-card__metrics--3' : ' w1337-defi-card__metrics--2'
                  }`}
                >
                  <div title="APY (DefiLlama)">
                    <span className="w1337-defi-card__k">APY</span>
                    <span className="w1337-defi-card__v">{fmtPct(v.apy)}</span>
                  </div>
                  <div>
                    <span className="w1337-defi-card__k">TVL</span>
                    <span className="w1337-defi-card__v">{fmtTvlUsd(v.tvlUsd)}</span>
                  </div>
                  {depositLabel ? (
                    <div title="Asset to deposit">
                      <span className="w1337-defi-card__k">Deposit</span>
                      <span className="w1337-defi-card__v">{depositLabel}</span>
                    </div>
                  ) : null}
                </div>
                <div className="w1337-defi-card__actions">
                  <button
                    type="button"
                    className="w1337-defi-deposit"
                    title="Coming soon"
                    onClick={() => {}}
                  >
                    Deposit
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
