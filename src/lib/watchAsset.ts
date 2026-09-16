import { getAddress, isAddress } from 'viem';
import {
  isTokenWatched,
  markTokensTouched,
  watchToken,
  type WatchedTokenMeta,
} from './assetTokenPrefs';
import { fetchErc20Meta } from './txRisk';
import type { WalletBalEntry } from './walletBalances';

const NATIVE_ADDRS = new Set([
  '0x0000000000000000000000000000000000000000',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
]);

export type WatchAssetRequest = {
  type: 'ERC20';
  address: `0x${string}`;
  symbol?: string;
  decimals?: number;
  image?: string;
};

export function isWatchAssetMethod(method: string): boolean {
  return method === 'wallet_watchAsset';
}

function payloadFromParams(params: unknown): Record<string, unknown> | null {
  if (Array.isArray(params)) {
    const head = params[0];
    if (head && typeof head === 'object' && !Array.isArray(head)) {
      return head as Record<string, unknown>;
    }
    return null;
  }
  if (params && typeof params === 'object') return params as Record<string, unknown>;
  return null;
}

function invalid(message: string): never {
  throw Object.assign(new Error(message), { code: 4000 });
}

function unsupported(message: string): never {
  throw Object.assign(new Error(message), { code: 4200 });
}

export function isSafeTokenImageUrl(url: string): boolean {
  if (url.length > 2048) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseOptionalDecimals(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 36) invalid('Invalid token decimals');
  return n;
}

function parseOptionalSymbol(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== 'string') invalid('Invalid token symbol');
  const symbol = raw.trim();
  if (!symbol) return undefined;
  if (symbol.length > 11) invalid('Token symbol must be 11 characters or fewer');
  return symbol;
}

function parseOptionalImage(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const url = raw.trim();
  if (!url || !isSafeTokenImageUrl(url)) return undefined;
  return url;
}

/** EIP-747 `wallet_watchAsset`. Accepts object params or `[object]`. ERC-20 only. */
export function parseWatchAssetParams(params: unknown): WatchAssetRequest {
  const payload = payloadFromParams(params);
  if (!payload) invalid('Invalid wallet_watchAsset params');

  const typeRaw = typeof payload.type === 'string' ? payload.type.trim() : '';
  const type = typeRaw.toUpperCase();
  if (type === 'ERC721' || type === 'ERC1155') {
    unsupported('1337 tracks ERC-20 tokens on Assets. NFT collections are not added via wallet_watchAsset.');
  }
  if (type !== 'ERC20') {
    unsupported(`Unsupported wallet_watchAsset type: ${typeRaw || 'missing'}`);
  }

  const options = payload.options;
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    invalid('wallet_watchAsset requires options.address');
  }
  const opts = options as Record<string, unknown>;
  if (typeof opts.address !== 'string' || !isAddress(opts.address)) {
    invalid('Invalid token address');
  }
  const address = getAddress(opts.address);
  if (NATIVE_ADDRS.has(address.toLowerCase())) {
    invalid('Native currency is already on Assets');
  }

  return {
    type: 'ERC20',
    address,
    symbol: parseOptionalSymbol(opts.symbol),
    decimals: parseOptionalDecimals(opts.decimals),
    image: parseOptionalImage(opts.image),
  };
}

export async function applyWatchAsset(opts: {
  chainId: number;
  wallet: string;
  request: WatchAssetRequest;
}): Promise<WatchedTokenMeta> {
  let symbol = opts.request.symbol;
  let name = opts.request.symbol ?? 'Token';
  let decimals = opts.request.decimals ?? 18;
  try {
    const meta = await fetchErc20Meta(opts.chainId, opts.request.address);
    if (meta.symbol) symbol = meta.symbol;
    if (meta.name) name = meta.name;
    if (meta.symbol || meta.name) decimals = meta.decimals;
  } catch {
    /* keep dapp-supplied fields after the user confirmed the address */
  }
  const token: WatchedTokenMeta = {
    address: opts.request.address,
    symbol: symbol || 'TOKEN',
    name: name || symbol || 'Token',
    decimals,
    logoURI: opts.request.image,
  };
  const rows = await watchToken(opts.chainId, opts.wallet, token);
  await markTokensTouched(opts.chainId, opts.wallet, [token.address]);
  return rows.find(t => t.address === token.address.toLowerCase()) ?? {
    ...token,
    address: token.address.toLowerCase(),
  };
}

export async function alreadyWatchingAsset(
  chainId: number,
  wallet: string,
  address: string,
): Promise<boolean> {
  return isTokenWatched(chainId, wallet, address);
}

export function mergeWatchedBalanceRows(
  rows: WalletBalEntry[],
  watched: WatchedTokenMeta[],
  chainId: number,
): WalletBalEntry[] {
  const have = new Set(rows.map(r => r.address.toLowerCase()));
  const extra: WalletBalEntry[] = [];
  for (const token of watched) {
    if (have.has(token.address.toLowerCase())) continue;
    extra.push({
      address: getAddress(token.address),
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      amount: '0',
      chainId,
      logoURI: token.logoURI,
    });
  }
  return extra.length ? [...rows, ...extra] : rows;
}

export function watchedProbeOf(token: WatchedTokenMeta): {
  address: string;
  decimals: number;
  symbol: string;
  name: string;
  logoURI?: string;
} {
  return {
    address: token.address,
    decimals: token.decimals,
    symbol: token.symbol,
    name: token.name,
    logoURI: token.logoURI,
  };
}
