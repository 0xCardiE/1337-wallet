import { getAddress, isAddress } from 'viem';

const HIDDEN_KEY = '1337_hidden_tokens_v1' as const;
const TOUCHED_KEY = '1337_touched_tokens_v1' as const;
const WATCHED_KEY = '1337_watched_tokens_v1' as const;

export type HiddenTokenMeta = {
  address: string;
  symbol: string;
  name: string;
  logoURI?: string;
};

export type WatchedTokenMeta = HiddenTokenMeta & {
  decimals: number;
};

function storage(): chrome.storage.LocalStorageArea {
  return chrome.storage.local;
}

function scopeKey(chainId: number, wallet: string): string {
  return `${chainId}:${wallet.toLowerCase()}`;
}

function tokenKey(addr: string): string | null {
  if (!isAddress(addr)) return null;
  return getAddress(addr).toLowerCase();
}

function readMap(raw: unknown): Record<string, HiddenTokenMeta[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, HiddenTokenMeta[]> = {};
  for (const [k, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const rows: HiddenTokenMeta[] = [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const addr = tokenKey(String(o.address ?? ''));
      if (!addr) continue;
      const symbol = typeof o.symbol === 'string' && o.symbol.trim() ? o.symbol.trim() : 'TOKEN';
      const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : symbol;
      const logoURI = typeof o.logoURI === 'string' && o.logoURI.trim() ? o.logoURI.trim() : undefined;
      rows.push({ address: addr, symbol, name, logoURI });
    }
    if (rows.length) out[k] = rows;
  }
  return out;
}

function readWatchedMap(raw: unknown): Record<string, WatchedTokenMeta[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, WatchedTokenMeta[]> = {};
  for (const [k, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const rows: WatchedTokenMeta[] = [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const addr = tokenKey(String(o.address ?? ''));
      if (!addr) continue;
      const symbol = typeof o.symbol === 'string' && o.symbol.trim() ? o.symbol.trim() : 'TOKEN';
      const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : symbol;
      const logoURI = typeof o.logoURI === 'string' && o.logoURI.trim() ? o.logoURI.trim() : undefined;
      const decimalsRaw = Number(o.decimals);
      const decimals =
        Number.isFinite(decimalsRaw) && decimalsRaw >= 0 && decimalsRaw <= 36
          ? Math.floor(decimalsRaw)
          : 18;
      rows.push({ address: addr, symbol, name, logoURI, decimals });
    }
    if (rows.length) out[k] = rows;
  }
  return out;
}

function readTouchedMap(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [k, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const addrs: string[] = [];
    const seen = new Set<string>();
    for (const item of list) {
      const addr = tokenKey(String(item ?? ''));
      if (!addr || seen.has(addr)) continue;
      seen.add(addr);
      addrs.push(addr);
    }
    if (addrs.length) out[k] = addrs;
  }
  return out;
}

function getRaw(key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    storage().get([key], r => {
      const err = chrome.runtime?.lastError;
      if (err) reject(new Error(err.message));
      else resolve(r[key]);
    });
  });
}

function setRaw(key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    storage().set({ [key]: value }, () => {
      const err = chrome.runtime?.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

export async function loadHiddenTokens(
  chainId: number,
  wallet: string,
): Promise<HiddenTokenMeta[]> {
  const all = readMap(await getRaw(HIDDEN_KEY));
  return all[scopeKey(chainId, wallet)] ?? [];
}

export async function hideToken(
  chainId: number,
  wallet: string,
  token: HiddenTokenMeta,
): Promise<HiddenTokenMeta[]> {
  const addr = tokenKey(token.address);
  if (!addr) return loadHiddenTokens(chainId, wallet);
  const all = readMap(await getRaw(HIDDEN_KEY));
  const k = scopeKey(chainId, wallet);
  const prev = all[k] ?? [];
  all[k] = [...prev.filter(t => t.address !== addr), { ...token, address: addr }];
  await setRaw(HIDDEN_KEY, all);
  return all[k]!;
}

export async function unhideToken(
  chainId: number,
  wallet: string,
  tokenAddress: string,
): Promise<HiddenTokenMeta[]> {
  const addr = tokenKey(tokenAddress);
  if (!addr) return loadHiddenTokens(chainId, wallet);
  const all = readMap(await getRaw(HIDDEN_KEY));
  const k = scopeKey(chainId, wallet);
  const next = (all[k] ?? []).filter(t => t.address !== addr);
  if (next.length) all[k] = next;
  else delete all[k];
  await setRaw(HIDDEN_KEY, all);
  return next;
}

export async function loadTouchedTokenAddresses(
  chainId: number,
  wallet: string,
): Promise<Set<string>> {
  const all = readTouchedMap(await getRaw(TOUCHED_KEY));
  return new Set(all[scopeKey(chainId, wallet)] ?? []);
}

export async function markTokensTouched(
  chainId: number,
  wallet: string,
  tokenAddresses: string[],
): Promise<Set<string>> {
  const all = readTouchedMap(await getRaw(TOUCHED_KEY));
  const k = scopeKey(chainId, wallet);
  const next = new Set(all[k] ?? []);
  for (const raw of tokenAddresses) {
    const addr = tokenKey(raw);
    if (addr) next.add(addr);
  }
  all[k] = [...next];
  await setRaw(TOUCHED_KEY, all);
  return next;
}

export async function loadWatchedTokens(
  chainId: number,
  wallet: string,
): Promise<WatchedTokenMeta[]> {
  const all = readWatchedMap(await getRaw(WATCHED_KEY));
  return all[scopeKey(chainId, wallet)] ?? [];
}

export async function isTokenWatched(
  chainId: number,
  wallet: string,
  tokenAddress: string,
): Promise<boolean> {
  const addr = tokenKey(tokenAddress);
  if (!addr) return false;
  const rows = await loadWatchedTokens(chainId, wallet);
  return rows.some(t => t.address === addr);
}

export async function watchToken(
  chainId: number,
  wallet: string,
  token: WatchedTokenMeta,
): Promise<WatchedTokenMeta[]> {
  const addr = tokenKey(token.address);
  if (!addr) return loadWatchedTokens(chainId, wallet);
  const all = readWatchedMap(await getRaw(WATCHED_KEY));
  const k = scopeKey(chainId, wallet);
  const prev = all[k] ?? [];
  all[k] = [
    ...prev.filter(t => t.address !== addr),
    {
      address: addr,
      symbol: token.symbol.trim() || 'TOKEN',
      name: token.name.trim() || token.symbol.trim() || 'Token',
      decimals:
        Number.isFinite(token.decimals) && token.decimals >= 0 && token.decimals <= 36
          ? Math.floor(token.decimals)
          : 18,
      logoURI: token.logoURI,
    },
  ];
  await setRaw(WATCHED_KEY, all);
  return all[k]!;
}

export function subscribeAssetTokenPrefs(onChange: () => void): () => void {
  const keys = new Set<string>([HIDDEN_KEY, TOUCHED_KEY, WATCHED_KEY]);
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: string,
  ) => {
    if (area !== 'local') return;
    if (!Object.keys(changes).some(k => keys.has(k))) return;
    onChange();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
