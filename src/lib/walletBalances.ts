import { formatUnits } from 'viem';
import { getAddress } from 'viem';
import { getTokens, getWalletBalances } from '@lifi/sdk';
import { ChainType } from '@lifi/types';
import type { Token } from '@lifi/types';
import { chainById } from './chainCatalog';
import { chainLogoUri } from './chainLogo';
import { snapshotHeldTokensOnChain, type OnChainBalanceProbe } from './ethereum';
import { isNativeToken } from './lifiHelpers';
import { summarizeApiError } from './errors';

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
const rpcFresh = new Map<number, { at: number; rows: WalletBalEntry[] }>();

export function fmtTokenAmount(entry: WalletBalEntry): string {
  try {
    return formatTokenAmount(BigInt(entry.amount || '0'), entry.decimals);
  } catch {
    return '—';
  }
}

export function fmtUsdValue(entry: WalletBalEntry): string | null {
  try {
    const n = Number(formatUnits(BigInt(entry.amount || '0'), entry.decimals));
    const usd = n * Number(entry.priceUSD || 0);
    if (!Number.isFinite(usd) || usd <= 0) return null;
    return usd.toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    });
  } catch {
    return null;
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
): Promise<WalletBalEntry[]> {
  if (!rows.some(r => isNativeWalletToken(r) && (!r.logoURI || !r.priceUSD))) {
    return rows;
  }

  let catalog: Token | undefined;
  try {
    const res = await getTokens({
      chains: [chainId],
      chainTypes: [ChainType.EVM],
      extended: true,
    });
    catalog = nativeTokenFromCatalog(res.tokens?.[chainId]);
  } catch {
    /* chain logo fallback still applies */
  }

  const chain = chainById(chainId);
  return rows.map(row => {
    if (!isNativeWalletToken(row)) return row;
    return {
      ...row,
      logoURI: row.logoURI || catalog?.logoURI || (chain ? chainLogoUri(chain) : undefined),
      priceUSD: row.priceUSD || catalog?.priceUSD,
    };
  });
}

function usesLifiPortfolio(chainId: number): boolean {
  return chainById(chainId)?.kind !== 'testnet';
}

/**
 * On-chain native (always) plus Li.FI catalog ERC-20s on mainnets.
 * Testnets skip the catalog — Li.FI does not index them — and probe ETH via RPC.
 */
export async function loadWalletBalancesRpcForChain(
  holder: `0x${string}`,
  chainId: number,
): Promise<WalletBalEntry[]> {
  const probes: OnChainBalanceProbe[] = [nativeProbeForChain(chainId)];
  const seen = new Set<string>([ETH_PLACEHOLDER, '0x0000000000000000000000000000000000000000']);

  if (usesLifiPortfolio(chainId)) {
    try {
      const res = await getTokens({
        chains: [chainId],
        chainTypes: [ChainType.EVM],
        extended: true,
        orderBy: 'volumeUSD24H',
      });
      const catalogTokens = res.tokens?.[chainId] ?? [];
      probes[0] = mergeNativeCatalogMeta(probes[0]!, nativeTokenFromCatalog(catalogTokens), chainId);
      for (const t of catalogTokens) {
        const key = t.address.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        probes.push({
          address: t.address,
          decimals: t.decimals,
          symbol: t.symbol,
          name: t.name,
          logoURI: t.logoURI,
          priceUSD: t.priceUSD,
        });
        if (probes.length >= 80) break;
      }
    } catch {
      /* native-only probe is enough to show gas balance */
    }
  }

  const rows = await snapshotHeldTokensOnChain(chainId, holder, probes);
  return enrichNativeRows(chainId, rows.map(r => ({ ...r, chainId })));
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

/** LiFi balances merged with on-chain native (+ RPC when Li.FI is empty or stale). */
export async function loadWalletBalancesForChain(
  address: string,
  chainId: number,
  options?: { refreshRpc?: boolean },
): Promise<{ rows: WalletBalEntry[]; error: string | null }> {
  const holder = getAddress(address);
  const now = Date.now();
  for (const [cid, pack] of [...rpcFresh.entries()]) {
    if (now - pack.at >= RPC_BALANCE_OVERRIDE_TTL_MS) rpcFresh.delete(cid);
  }

  const cached = rpcFresh.get(chainId);
  if (cached && now - cached.at < RPC_BALANCE_OVERRIDE_TTL_MS) {
    const rows = await enrichNativeRows(chainId, [...cached.rows].sort(compareByUsd));
    return { rows, error: null };
  }

  let chainRows: WalletBalEntry[] = [];
  let lifiError: string | null = null;
  const skipLifi = !usesLifiPortfolio(chainId);

  if (!skipLifi) {
    try {
      const raw = await getWalletBalances(holder);
      const all = Object.values(parseLifiWalletBalances(raw)).flat();
      chainRows = all.filter(r => r.chainId === chainId);
    } catch (e) {
      lifiError = summarizeApiError(e);
    }
  }

  /* Testnets, empty Li.FI (unindexed chain), or an explicit RPC refresh. */
  const needRpc = skipLifi || options?.refreshRpc || chainRows.length === 0 || lifiError != null;
  if (needRpc) {
    try {
      if (chainRows.length === 0) {
        chainRows = await loadWalletBalancesRpcForChain(holder, chainId);
      } else {
        const probes = [nativeProbeForChain(chainId), ...chainRows.map(balEntryToProbe)];
        chainRows = (await snapshotHeldTokensOnChain(chainId, holder, probes)).map(r => ({
          ...r,
          chainId,
        }));
      }
      rpcFresh.set(chainId, { at: now, rows: chainRows });
      lifiError = null;
    } catch (e) {
      if (chainRows.length === 0) {
        return { rows: [], error: lifiError ?? summarizeApiError(e) };
      }
    }
  }

  chainRows.sort(compareByUsd);
  chainRows = await enrichNativeRows(chainId, chainRows);
  return { rows: chainRows, error: null };
}

export function invalidateRpcBalanceCache(chainId?: number): void {
  if (chainId == null) {
    rpcFresh.clear();
    return;
  }
  rpcFresh.delete(chainId);
}
