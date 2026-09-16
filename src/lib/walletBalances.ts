import { formatUnits, getAddress, isAddress } from 'viem';
import { getTokens, getWalletBalances } from '@lifi/sdk';
import { ChainType } from '@lifi/types';
import type { Token } from '@lifi/types';
import { chainById } from './chainCatalog';
import { chainLogoUri } from './chainLogo';
import { snapshotHeldTokensOnChain, getNativeBalance, type OnChainBalanceProbe } from './ethereum';
import { isNativeToken } from './lifiHelpers';
import { summarizeApiError } from './errors';
import { etherscanV2Get } from './etherscanV2';
import {
  blockscoutApiOrigin,
  blockscoutGet,
  catalogExplorerOrigin,
  etherscanCommunityAccess,
  isBlockscoutOrigin,
} from './explorerApis';
import { applyFetchedUsdPrices, fetchLlamaUsdPrices } from './tokenPrices';

export type WalletBalEntry = {
  address: string;
  symbol: string;
  decimals: number;
  amount: string;
  chainId: number;
  name: string;
  priceUSD?: string;
  logoURI?: string;
};

const NATIVE_ADDRS = new Set([
  '0x0000000000000000000000000000000000000000',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
]);

const ETH_PLACEHOLDER = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export function isNativeWalletToken(entry: WalletBalEntry): boolean {
  return NATIVE_ADDRS.has(entry.address.toLowerCase());
}

/** Human-readable token amount; uses scientific notation for huge/tiny values. */
export function formatTokenAmount(amount: bigint, decimals: number): string {
  if (amount === 0n) return '0';
  try {
    const raw = formatUnits(amount, decimals);
    const n = Number(raw);
    if (Number.isFinite(n) && n !== 0) {
      const abs = Math.abs(n);
      if (abs >= 1e12 || (abs > 0 && abs < 1e-7)) {
        return n.toLocaleString(undefined, {
          notation: 'scientific',
          maximumSignificantDigits: 6,
        });
      }
      if (abs >= 1) {
        return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
      }
      return n.toLocaleString(undefined, { maximumSignificantDigits: 6 });
    }
    return formatUnitsStringCompact(raw);
  } catch {
    return amount.toString();
  }
}

function formatUnitsStringCompact(raw: string): string {
  const negative = raw.startsWith('-');
  const body = negative ? raw.slice(1) : raw;
  const [intPart, frac = ''] = body.split('.');
  const intDigits = intPart.replace(/^0+/, '') || '0';
  if (intDigits.length > 8) {
    const mantissa = `${intDigits[0]}.${intDigits.slice(1, 5)}`.replace(/\.$/, '');
    const exp = intDigits.length - 1;
    return `${negative ? '-' : ''}${mantissa}e+${exp}`;
  }
  const fracTrim = frac.replace(/0+$/, '');
  const plain = fracTrim ? `${intPart}.${fracTrim}` : intPart;
  if (plain.length <= 14) return `${negative ? '-' : ''}${plain}`;
  const approx = Number(plain);
  if (Number.isFinite(approx) && approx !== 0) {
    return approx.toLocaleString(undefined, {
      notation: 'scientific',
      maximumSignificantDigits: 6,
    });
  }
  return `${negative ? '-' : ''}${plain.slice(0, 12)}…`;
}

const RPC_BALANCE_OVERRIDE_TTL_MS = 120_000;
const RPC_SNAPSHOT_MAX = 150;
const EXPLORER_PROBE_MAX = 80;
const CATALOG_TTL_MS = 10 * 60_000;

const rpcFresh = new Map<number, { at: number; rows: WalletBalEntry[] }>();

type BalanceSnap = { at: number; rows: WalletBalEntry[] };
type SnapBundle = Record<string, { main?: BalanceSnap; other?: BalanceSnap }>;

const SNAP_STORAGE_KEY = '1337_asset_snap_v1';
/** Last successful snapshots — survive failed refreshes and popup remounts. */
const lastGoodMain = new Map<string, BalanceSnap>();
const lastGoodOther = new Map<string, BalanceSnap>();
/** Token contracts we have seen with a balance — kept after amount-cache invalidation. */
const knownProbes = new Map<string, OnChainBalanceProbe[]>();
const catalogCache = new Map<number, { at: number; tokens: Token[] }>();

/** Main list: reuse cache unless older than this; spinner still runs on a background refresh. */
export const MAIN_STALE_MS = 2 * 60 * 1000;
/** Other/dust: do not hit explorer on every expand. */
export const OTHER_STALE_MS = 15 * 60 * 1000;

function holderCacheKey(chainId: number, holder: string): string {
  return `${chainId}:${holder.toLowerCase()}`;
}

function isBalanceSnap(value: unknown): value is BalanceSnap {
  if (!value || typeof value !== 'object') return false;
  const o = value as { at?: unknown; rows?: unknown };
  return typeof o.at === 'number' && Array.isArray(o.rows);
}

let snapHydrate: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function readSnapBundle(): Promise<SnapBundle> {
  return new Promise(resolve => {
    try {
      chrome.storage.local.get([SNAP_STORAGE_KEY], (r: Record<string, unknown>) => {
        if (chrome.runtime?.lastError) {
          resolve({});
          return;
        }
        const raw = r[SNAP_STORAGE_KEY];
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          resolve({});
          return;
        }
        const out: SnapBundle = {};
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
          if (!v || typeof v !== 'object') continue;
          const rec = v as { main?: unknown; other?: unknown };
          const main = isBalanceSnap(rec.main) ? rec.main : undefined;
          const other = isBalanceSnap(rec.other) ? rec.other : undefined;
          if (main || other) out[k] = { main, other };
        }
        resolve(out);
      });
    } catch {
      resolve({});
    }
  });
}

function persistSnaps(): void {
  const bundle: SnapBundle = {};
  for (const [k, v] of lastGoodMain) {
    bundle[k] = { ...(bundle[k] ?? {}), main: v };
  }
  for (const [k, v] of lastGoodOther) {
    bundle[k] = { ...(bundle[k] ?? {}), other: v };
  }
  try {
    chrome.storage.local.set({ [SNAP_STORAGE_KEY]: bundle }, () => {
      void chrome.runtime?.lastError;
    });
  } catch {
    /* popup / tests without chrome.storage */
  }
}

function schedulePersistSnaps(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(persistSnaps, 250);
}

/** Load last painted balances from disk so Assets is not empty after the popup remounts. */
export async function hydrateAssetBalanceCache(): Promise<void> {
  if (!snapHydrate) {
    snapHydrate = readSnapBundle()
      .then(bundle => {
        for (const [k, v] of Object.entries(bundle)) {
          if (v.main && !lastGoodMain.has(k)) lastGoodMain.set(k, v.main);
          if (v.other && !lastGoodOther.has(k)) lastGoodOther.set(k, v.other);
        }
        for (const [k, snap] of lastGoodMain) {
          const sep = k.indexOf(':');
          const chainId = Number(k.slice(0, sep));
          const holder = k.slice(sep + 1);
          if (!Number.isFinite(chainId) || !isAddress(holder)) continue;
          rememberHeldProbes(chainId, holder, snap.rows);
        }
      })
      .catch(() => {});
  }
  await snapHydrate;
}

export function peekMainBalances(chainId: number, address: string): WalletBalEntry[] {
  return lastGoodMain.get(holderCacheKey(chainId, address))?.rows ?? [];
}

export function peekMainSnap(
  chainId: number,
  address: string,
): BalanceSnap | null {
  return lastGoodMain.get(holderCacheKey(chainId, address)) ?? null;
}

export function peekOtherBalances(
  chainId: number,
  address: string,
): BalanceSnap | null {
  return lastGoodOther.get(holderCacheKey(chainId, address)) ?? null;
}

export function rememberMainBalances(
  chainId: number,
  address: string,
  rows: WalletBalEntry[],
): void {
  lastGoodMain.set(holderCacheKey(chainId, address), { at: Date.now(), rows });
  schedulePersistSnaps();
}

export function rememberOtherBalances(
  chainId: number,
  address: string,
  rows: WalletBalEntry[],
): void {
  lastGoodOther.set(holderCacheKey(chainId, address), { at: Date.now(), rows });
  schedulePersistSnaps();
}

export async function loadNativeBalanceForChain(
  address: string,
  chainId: number,
): Promise<WalletBalEntry | null> {
  const holder = getAddress(address);
  const probe = nativeProbeForChain(chainId);
  const native = await getNativeBalance(holder, chainId);
  if (native <= 0n) return null;
  return { ...probe, amount: native.toString(), chainId };
}

export function fmtTokenAmount(entry: WalletBalEntry): string {
  try {
    return formatTokenAmount(BigInt(entry.amount || '0'), entry.decimals);
  } catch {
    return '—';
  }
}

/** Below this USD value a token is dust unless the user has used it. */
export const DUST_USD = 0.01;

export function fmtUsdValue(entry: WalletBalEntry): string | null {
  const usd = tokenUsdNumber(entry);
  if (usd <= 0) return null;
  return usd.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}

/** Fiat value of a balance using Li.FI `priceUSD` when present. */
export function tokenUsdNumber(entry: WalletBalEntry): number {
  try {
    const n = Number(formatUnits(BigInt(entry.amount || '0'), entry.decimals));
    const usd = n * Number(entry.priceUSD || 0);
    return Number.isFinite(usd) && usd > 0 ? usd : 0;
  } catch {
    return 0;
  }
}

function balEntryToProbe(b: WalletBalEntry): OnChainBalanceProbe {
  return {
    address: b.address,
    decimals: b.decimals,
    symbol: b.symbol,
    name: b.name,
    logoURI: b.logoURI,
    priceUSD: b.priceUSD,
  };
}

export async function enrichMissingUsdPrices(rows: WalletBalEntry[]): Promise<WalletBalEntry[]> {
  const need = rows.filter(r => !r.priceUSD && !isNativeWalletToken(r));
  if (need.length === 0) return rows;
  try {
    const prices = await fetchLlamaUsdPrices(need);
    return applyFetchedUsdPrices(rows, prices);
  } catch {
    return rows;
  }
}

/** Add or refresh main-list rows without dropping tokens a partial scan missed. */
export function mergeMainAssetRows(
  current: WalletBalEntry[],
  incoming: WalletBalEntry[],
): WalletBalEntry[] {
  const byKey = new Map(current.map(r => [r.address.toLowerCase(), r]));
  for (const row of incoming) {
    const key = row.address.toLowerCase();
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, row);
      continue;
    }
    byKey.set(key, {
      ...prev,
      ...row,
      logoURI: row.logoURI || prev.logoURI,
      priceUSD: row.priceUSD || prev.priceUSD,
    });
  }
  return [...byKey.values()].sort(compareByUsd);
}

function compareByUsd(a: WalletBalEntry, b: WalletBalEntry): number {
  const ua =
    Number(formatUnits(BigInt(a.amount || '0'), a.decimals)) * Number(a.priceUSD || 0);
  const ub =
    Number(formatUnits(BigInt(b.amount || '0'), b.decimals)) * Number(b.priceUSD || 0);
  if (Number.isFinite(ua) && Number.isFinite(ub) && ua !== ub) {
    return ub - ua;
  }
  const ba = BigInt(a.amount || '0');
  const bb = BigInt(b.amount || '0');
  if (ba !== bb) return ba > bb ? -1 : 1;
  return a.symbol.localeCompare(b.symbol);
}

function parseLifiWalletBalances(raw: unknown): Record<number, WalletBalEntry[]> {
  const out: Record<number, WalletBalEntry[]> = {};
  for (const [k, list] of Object.entries((raw as Record<string, unknown>) ?? {})) {
    const id = Number(k);
    if (!Number.isFinite(id)) continue;
    const rows: WalletBalEntry[] = [];
    for (const t of list as WalletBalEntry[]) {
      try {
        if (BigInt(t.amount || '0') <= 0n) continue;
      } catch {
        continue;
      }
      rows.push({ ...t, chainId: id });
    }
    if (rows.length) out[id] = rows;
  }
  return out;
}

function nativeProbeForChain(chainId: number): OnChainBalanceProbe {
  const chain = chainById(chainId);
  return {
    address: ETH_PLACEHOLDER,
    decimals: chain?.nativeCurrency.decimals ?? 18,
    symbol: chain?.nativeCurrency.symbol ?? 'ETH',
    name: chain?.nativeCurrency.name ?? 'Ether',
    logoURI: chain ? chainLogoUri(chain) : undefined,
  };
}

function nativeTokenFromCatalog(tokens: Token[] | undefined): Token | undefined {
  return tokens?.find(t => isNativeToken(t.address));
}

function mergeNativeCatalogMeta(
  probe: OnChainBalanceProbe,
  catalog: Token | undefined,
  chainId: number,
): OnChainBalanceProbe {
  if (!catalog) return probe;
  const chain = chainById(chainId);
  return {
    ...probe,
    name: catalog.name || probe.name,
    symbol: catalog.symbol || probe.symbol,
    decimals: catalog.decimals ?? probe.decimals,
    logoURI: catalog.logoURI || probe.logoURI || (chain ? chainLogoUri(chain) : undefined),
    priceUSD: catalog.priceUSD ?? probe.priceUSD,
  };
}

async function enrichNativeRows(
  chainId: number,
  rows: WalletBalEntry[],
  lifiRows?: WalletBalEntry[],
): Promise<WalletBalEntry[]> {
  const lifiNative = (lifiRows ?? []).find(r => isNativeWalletToken(r));
  if (!rows.some(r => isNativeWalletToken(r) && (!r.logoURI || !r.priceUSD))) {
    return rows;
  }

  let catalog = nativeTokenFromCatalog(catalogCache.get(chainId)?.tokens);
  if (!lifiNative?.priceUSD && !catalog?.priceUSD) {
    catalog = nativeTokenFromCatalog(await loadCatalogTokens(chainId));
  }
  const chain = chainById(chainId);
  return rows.map(row => {
    if (!isNativeWalletToken(row)) return row;
    return {
      ...row,
      logoURI:
        row.logoURI ||
        lifiNative?.logoURI ||
        catalog?.logoURI ||
        (chain ? chainLogoUri(chain) : undefined),
      priceUSD: row.priceUSD || lifiNative?.priceUSD || catalog?.priceUSD,
    };
  });
}

function usesLifiPortfolio(chainId: number): boolean {
  return chainById(chainId)?.kind !== 'testnet';
}

function knownProbeKey(chainId: number, holder: string): string {
  return `${chainId}:${holder.toLowerCase()}`;
}

function rememberHeldProbes(
  chainId: number,
  holder: string,
  rows: WalletBalEntry[],
  opts?: { skip?: Set<string>; promote?: Set<string> },
): void {
  const skip = opts?.skip ?? new Set<string>();
  const promote = opts?.promote ?? new Set<string>();
  knownProbes.set(
    knownProbeKey(chainId, holder),
    rows
      .filter(r => {
        if (isNativeWalletToken(r)) return false;
        const addr = r.address.toLowerCase();
        if (skip.has(addr)) return false;
        if (promote.has(addr)) return true;
        return tokenUsdNumber(r) >= DUST_USD;
      })
      .map(balEntryToProbe),
  );
}

export function forgetHeldProbes(chainId: number, holder: string, addresses: string[]): void {
  const key = knownProbeKey(chainId, holder);
  const cur = knownProbes.get(key);
  if (!cur?.length) return;
  const skip = new Set(addresses.map(a => a.toLowerCase()));
  knownProbes.set(
    key,
    cur.filter(p => !skip.has(p.address.toLowerCase())),
  );
}

function tokenToProbe(t: Token): OnChainBalanceProbe {
  return {
    address: t.address,
    decimals: t.decimals,
    symbol: t.symbol,
    name: t.name,
    logoURI: t.logoURI,
    priceUSD: t.priceUSD,
  };
}

function mergeErc20Probe(map: Map<string, OnChainBalanceProbe>, probe: OnChainBalanceProbe): void {
  const key = probe.address.toLowerCase();
  if (NATIVE_ADDRS.has(key)) return;
  const prev = map.get(key);
  if (!prev) {
    map.set(key, probe);
    return;
  }
  map.set(key, {
    address: prev.address,
    decimals: prev.decimals || probe.decimals,
    symbol: prev.symbol || probe.symbol,
    name: prev.name || probe.name,
    logoURI: prev.logoURI || probe.logoURI,
    priceUSD: prev.priceUSD || probe.priceUSD,
  });
}

function probeFromUnknownToken(raw: {
  address?: string;
  decimals?: unknown;
  symbol?: unknown;
  name?: unknown;
  logoURI?: unknown;
}): OnChainBalanceProbe | null {
  const addr = raw.address?.trim();
  if (!addr || !isAddress(addr)) return null;
  const decimalsRaw = Number(raw.decimals);
  const decimals = Number.isFinite(decimalsRaw) && decimalsRaw >= 0 && decimalsRaw <= 36 ? decimalsRaw : 18;
  const symbol = typeof raw.symbol === 'string' && raw.symbol.trim() ? raw.symbol.trim() : 'TOKEN';
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : symbol;
  const logoURI = typeof raw.logoURI === 'string' && raw.logoURI.trim() ? raw.logoURI.trim() : undefined;
  return { address: getAddress(addr), decimals, symbol, name, logoURI };
}

function isErc20ScoutType(type: string | undefined): boolean {
  if (!type) return true;
  const t = type.toUpperCase().replace(/-/g, '');
  return !(t.includes('721') || t.includes('1155') || t.includes('NFT'));
}

function parseScoutTokenItems(raw: unknown): OnChainBalanceProbe[] {
  const items = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items)
      ? ((raw as { items: unknown[] }).items)
      : [];
  const out: OnChainBalanceProbe[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as {
      token?: Record<string, unknown>;
      token_type?: string;
      value?: string;
      token_id?: unknown;
    };
    if (rec.token_id != null && rec.token_id !== '') continue;
    const token = rec.token && typeof rec.token === 'object' ? rec.token : rec;
    const type = String(token.type ?? rec.token_type ?? '');
    if (type && !isErc20ScoutType(type)) continue;
    const probe = probeFromUnknownToken({
      address: String(token.address ?? token.address_hash ?? ''),
      decimals: token.decimals,
      symbol: token.symbol,
      name: token.name,
      logoURI: token.icon_url,
    });
    if (probe) out.push(probe);
    if (out.length >= EXPLORER_PROBE_MAX) break;
  }
  return out;
}

async function discoverHeldTokenProbes(
  chainId: number,
  holder: `0x${string}`,
  explorerApiKey?: string,
): Promise<OnChainBalanceProbe[]> {
  const catalog = catalogExplorerOrigin(chainId);
  const scout = blockscoutApiOrigin(chainId);
  const catalogIsScout = !!catalog && isBlockscoutOrigin(catalog);
  const origins = [...new Set([catalogIsScout ? catalog : undefined, scout].filter(Boolean))] as string[];

  for (const origin of origins) {
    try {
      const v2 = await fetch(`${origin}/api/v2/addresses/${holder}/token-balances`);
      if (v2.ok) {
        const parsed = parseScoutTokenItems(await v2.json());
        if (parsed.length) return parsed;
      }
    } catch {
      /* try next */
    }
    try {
      const v2tokens = await fetch(`${origin}/api/v2/addresses/${holder}/tokens?type=ERC-20`);
      if (v2tokens.ok) {
        const parsed = parseScoutTokenItems(await v2tokens.json());
        if (parsed.length) return parsed;
      }
    } catch {
      /* try classic */
    }
    try {
      const json = await blockscoutGet(
        origin,
        new URLSearchParams({ module: 'account', action: 'tokenlist', address: holder }),
      );
      if (Array.isArray(json.result)) {
        const parsed: OnChainBalanceProbe[] = [];
        for (const row of json.result as Record<string, unknown>[]) {
          const probe = probeFromUnknownToken({
            address: String(row.contractAddress ?? row.contractaddress ?? ''),
            decimals: row.decimals ?? row.tokenDecimal,
            symbol: row.symbol,
            name: row.tokenName ?? row.name,
          });
          if (probe) parsed.push(probe);
          if (parsed.length >= EXPLORER_PROBE_MAX) break;
        }
        if (parsed.length) return parsed;
      }
    } catch {
      /* try etherscan */
    }
  }

  const access = etherscanCommunityAccess(chainId);
  const key = explorerApiKey?.trim();
  if (access === 'none' || (!key && access === 'paid')) return [];

  try {
    const params = new URLSearchParams({
      chainid: String(chainId),
      module: 'account',
      action: 'tokentx',
      address: holder,
      page: '1',
      offset: '100',
      sort: 'desc',
    });
    if (key) params.set('apikey', key);
    const json = await etherscanV2Get(params);
    if (!Array.isArray(json.result)) return [];
    const parsed: OnChainBalanceProbe[] = [];
    const seen = new Set<string>();
    for (const row of json.result as Record<string, unknown>[]) {
      const probe = probeFromUnknownToken({
        address: String(row.contractAddress ?? ''),
        decimals: row.tokenDecimal,
        symbol: row.tokenSymbol,
        name: row.tokenName,
      });
      if (!probe) continue;
      const k = probe.address.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      parsed.push(probe);
      if (parsed.length >= EXPLORER_PROBE_MAX) break;
    }
    return parsed;
  } catch {
    return [];
  }
}

async function loadCatalogTokens(chainId: number): Promise<Token[]> {
  if (!usesLifiPortfolio(chainId)) return [];
  const cached = catalogCache.get(chainId);
  if (cached && Date.now() - cached.at < CATALOG_TTL_MS) return cached.tokens;
  try {
    const res = await getTokens({
      chains: [chainId],
      chainTypes: [ChainType.EVM],
      extended: true,
      orderBy: 'volumeUSD24H',
    });
    const tokens = res.tokens?.[chainId] ?? [];
    catalogCache.set(chainId, { at: Date.now(), tokens });
    return tokens;
  } catch {
    return cached?.tokens ?? [];
  }
}

async function collectBalanceProbes(opts: {
  chainId: number;
  holder: `0x${string}`;
  lifiRows?: WalletBalEntry[];
  extra?: OnChainBalanceProbe[];
  skipAddresses?: Set<string>;
  promoteAddresses?: Set<string>;
  includeDustProbes?: boolean;
}): Promise<OnChainBalanceProbe[]> {
  const includeDust = opts.includeDustProbes === true;
  const skip = opts.skipAddresses ?? new Set<string>();
  const promote = opts.promoteAddresses ?? new Set<string>();
  const catalog = includeDust ? await loadCatalogTokens(opts.chainId) : [];
  const catalogKeys = new Set(catalog.map(t => t.address.toLowerCase()));
  const lifiNative = (opts.lifiRows ?? []).find(r => isNativeWalletToken(r));
  const nativeBase = nativeProbeForChain(opts.chainId);
  const native = mergeNativeCatalogMeta(
    {
      ...nativeBase,
      name: lifiNative?.name || nativeBase.name,
      symbol: lifiNative?.symbol || nativeBase.symbol,
      decimals: lifiNative?.decimals ?? nativeBase.decimals,
      logoURI: lifiNative?.logoURI || nativeBase.logoURI,
      priceUSD: lifiNative?.priceUSD,
    },
    nativeTokenFromCatalog(catalog),
    opts.chainId,
  );
  const must = new Map<string, OnChainBalanceProbe>();
  for (const p of knownProbes.get(knownProbeKey(opts.chainId, opts.holder)) ?? []) {
    if (skip.has(p.address.toLowerCase())) continue;
    mergeErc20Probe(must, p);
  }
  for (const row of opts.lifiRows ?? []) {
    const key = row.address.toLowerCase();
    if (skip.has(key)) continue;
    if (
      !includeDust &&
      tokenUsdNumber(row) < DUST_USD &&
      !promote.has(key) &&
      !must.has(key)
    ) {
      continue;
    }
    mergeErc20Probe(must, balEntryToProbe(row));
  }
  for (const p of opts.extra ?? []) {
    const key = p.address.toLowerCase();
    if (skip.has(key)) continue;
    if (!includeDust && !catalogKeys.has(key) && !must.has(key) && !promote.has(key)) continue;
    mergeErc20Probe(must, p);
  }

  for (const t of catalog) {
    const key = t.address.toLowerCase();
    if (NATIVE_ADDRS.has(key) || skip.has(key) || !must.has(key)) continue;
    const prev = must.get(key)!;
    const catalogProbe = tokenToProbe(t);
    must.set(key, {
      address: prev.address,
      decimals: catalogProbe.decimals || prev.decimals,
      symbol: catalogProbe.symbol || prev.symbol,
      name: catalogProbe.name || prev.name,
      logoURI: catalogProbe.logoURI || prev.logoURI,
      priceUSD: catalogProbe.priceUSD || prev.priceUSD,
    });
  }

  return [native, ...must.values()].slice(0, RPC_SNAPSHOT_MAX);
}

/**
 * On-chain native plus tokens we already know you hold.
 * Testnets skip Li.FI catalog — it does not index them — and probe ETH via RPC.
 */
export async function loadWalletBalancesRpcForChain(
  holder: `0x${string}`,
  chainId: number,
): Promise<WalletBalEntry[]> {
  const probes = await collectBalanceProbes({ chainId, holder });
  const rows = await enrichMissingUsdPrices(
    (await snapshotHeldTokensOnChain(chainId, holder, probes, RPC_SNAPSHOT_MAX)).map(r => ({
      ...r,
      chainId,
    })),
  );
  rememberHeldProbes(chainId, holder, rows);
  return enrichNativeRows(chainId, rows);
}

/** Multi-chain Li.FI balances with optional per-chain RPC fallback. */
export async function loadWalletBalancesMap(
  address: string,
  opts?: { rpcFallbackChainIds?: number[] },
): Promise<{ byChain: Record<number, WalletBalEntry[]>; error: string | null }> {
  const holder = getAddress(address);
  try {
    const raw = await getWalletBalances(holder);
    return { byChain: parseLifiWalletBalances(raw), error: null };
  } catch (e) {
    const lifiError = summarizeApiError(e);
    const chainIds = [...new Set((opts?.rpcFallbackChainIds ?? []).filter(Number.isFinite))];
    if (chainIds.length === 0) {
      return { byChain: {}, error: lifiError };
    }

    const byChain: Record<number, WalletBalEntry[]> = {};
    let rpcFailed = false;
    for (const chainId of chainIds) {
      try {
        const rows = await loadWalletBalancesRpcForChain(holder, chainId);
        if (rows.length) byChain[chainId] = rows;
      } catch {
        rpcFailed = true;
      }
    }

    if (Object.keys(byChain).length > 0) {
      return { byChain, error: null };
    }
    return { byChain: {}, error: rpcFailed ? lifiError : null };
  }
}

/** LiFi addresses/metadata merged with on-chain balances. RPC is the amount source of truth. */
export async function loadWalletBalancesForChain(
  address: string,
  chainId: number,
  options?: {
    refreshRpc?: boolean;
    explorerApiKey?: string;
    skipAddresses?: Iterable<string>;
    promoteAddresses?: Iterable<string>;
    extraProbes?: OnChainBalanceProbe[];
    includeDustProbes?: boolean;
  },
): Promise<{ rows: WalletBalEntry[]; error: string | null }> {
  const holder = getAddress(address);
  const skip = new Set(
    [...(options?.skipAddresses ?? [])].map(a => a.toLowerCase()),
  );
  const promote = new Set(
    [...(options?.promoteAddresses ?? [])].map(a => a.toLowerCase()),
  );
  const includeDustProbes = options?.includeDustProbes === true;
  const now = Date.now();
  for (const [cid, pack] of [...rpcFresh.entries()]) {
    if (now - pack.at >= RPC_BALANCE_OVERRIDE_TTL_MS) rpcFresh.delete(cid);
  }

  const cached = rpcFresh.get(chainId);
  if (!options?.refreshRpc && cached && now - cached.at < RPC_BALANCE_OVERRIDE_TTL_MS) {
    const rows = await enrichNativeRows(
      chainId,
      [...cached.rows].filter(r => !skip.has(r.address.toLowerCase())).sort(compareByUsd),
    );
    return { rows, error: null };
  }

  let lifiRows: WalletBalEntry[] = [];
  let lifiError: string | null = null;
  const skipLifi = !usesLifiPortfolio(chainId);

  if (!skipLifi) {
    try {
      const raw = await getWalletBalances(holder);
      const all = Object.values(parseLifiWalletBalances(raw)).flat();
      lifiRows = all.filter(r => r.chainId === chainId && !skip.has(r.address.toLowerCase()));
    } catch (e) {
      lifiError = summarizeApiError(e);
    }
  }

  try {
    const extra = [
      ...(options?.extraProbes ?? []),
      ...(options?.refreshRpc && includeDustProbes
        ? await discoverHeldTokenProbes(chainId, holder, options.explorerApiKey)
        : []),
    ];
    const probes = await collectBalanceProbes({
      chainId,
      holder,
      lifiRows,
      extra,
      skipAddresses: skip,
      promoteAddresses: promote,
      includeDustProbes,
    });
    const chainRows = await enrichMissingUsdPrices(
      (await snapshotHeldTokensOnChain(chainId, holder, probes, RPC_SNAPSHOT_MAX))
        .map(r => ({ ...r, chainId }))
        .filter(r => !skip.has(r.address.toLowerCase())),
    );
    rememberHeldProbes(chainId, holder, chainRows, { skip, promote });
    const rows = await enrichNativeRows(chainId, [...chainRows].sort(compareByUsd), lifiRows);
    rpcFresh.set(chainId, { at: Date.now(), rows });
    return { rows, error: null };
  } catch (e) {
    const cached = lastGoodMain.get(holderCacheKey(chainId, holder));
    if (lifiRows.length > 0) {
      lifiRows.sort(compareByUsd);
      return { rows: await enrichNativeRows(chainId, lifiRows, lifiRows), error: null };
    }
    if (cached?.rows.length) {
      return { rows: cached.rows, error: lifiError ?? summarizeApiError(e) };
    }
    return { rows: [], error: lifiError ?? summarizeApiError(e) };
  }
}

export function invalidateRpcBalanceCache(chainId?: number): void {
  if (chainId == null) {
    rpcFresh.clear();
    return;
  }
  rpcFresh.delete(chainId);
}
