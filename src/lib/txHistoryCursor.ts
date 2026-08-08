import type { TxHistoryRow } from './explorerTxHistory';

const STORAGE_KEY = '1337_tx_history_v2';

type StoredRow = {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  timestamp: number;
  success: boolean;
  direction: 'in' | 'out' | 'self';
  blockNumber?: number;
  nonce?: number;
  gasUsed?: string;
  gasLimit?: string;
  gasPrice?: string;
  methodId?: string;
  functionName?: string;
  input?: string;
};

export type TxHistoryCache = {
  pagesLoaded: number;
  hasMore: boolean;
  rows: TxHistoryRow[];
};

type PersistedBundle = Record<string, { pagesLoaded: number; hasMore: boolean; rows: StoredRow[] }>;

function cacheKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

function toStored(rows: TxHistoryRow[]): StoredRow[] {
  return rows.map(r => ({
    hash: r.hash,
    from: r.from,
    to: r.to,
    value: r.value.toString(),
    timestamp: r.timestamp,
    success: r.success,
    direction: r.direction,
    blockNumber: r.blockNumber,
    nonce: r.nonce,
    gasUsed: r.gasUsed?.toString(),
    gasLimit: r.gasLimit?.toString(),
    gasPrice: r.gasPrice?.toString(),
    methodId: r.methodId,
    functionName: r.functionName,
    input: r.input,
  }));
}

function fromStored(rows: StoredRow[]): TxHistoryRow[] {
  return rows.map(r => ({
    hash: r.hash as `0x${string}`,
    from: r.from as `0x${string}`,
    to: r.to as `0x${string}` | null,
    value: BigInt(r.value),
    timestamp: r.timestamp,
    success: r.success,
    direction: r.direction,
    blockNumber: r.blockNumber,
    nonce: r.nonce,
    gasUsed: r.gasUsed != null ? BigInt(r.gasUsed) : undefined,
    gasLimit: r.gasLimit != null ? BigInt(r.gasLimit) : undefined,
    gasPrice: r.gasPrice != null ? BigInt(r.gasPrice) : undefined,
    methodId: r.methodId,
    functionName: r.functionName,
    input: r.input,
  }));
}

function storage(): chrome.storage.LocalStorageArea {
  return chrome.storage.local;
}

async function readAll(): Promise<PersistedBundle> {
  return new Promise((resolve, reject) => {
    storage().get([STORAGE_KEY], r => {
      const err = chrome.runtime?.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      const raw = r[STORAGE_KEY];
      const bundle = raw && typeof raw === 'object' ? (raw as PersistedBundle) : {};
      resolve(bundle);
    });
  });
}

export async function loadTxHistoryCache(
  chainId: number,
  address: string,
): Promise<TxHistoryCache | null> {
  const all = await readAll();
  const entry = all[cacheKey(chainId, address)];
  if (!entry) return null;
  return {
    pagesLoaded: entry.pagesLoaded,
    hasMore: entry.hasMore,
    rows: fromStored(entry.rows),
  };
}

export async function saveTxHistoryCache(
  chainId: number,
  address: string,
  cache: TxHistoryCache,
): Promise<void> {
  const all = await readAll();
  all[cacheKey(chainId, address)] = {
    pagesLoaded: cache.pagesLoaded,
    hasMore: cache.hasMore,
    rows: toStored(cache.rows),
  };
  return new Promise((resolve, reject) => {
    storage().set({ [STORAGE_KEY]: all }, () => {
      const err = chrome.runtime?.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

export async function clearTxHistoryCache(chainId: number, address: string): Promise<void> {
  const all = await readAll();
  delete all[cacheKey(chainId, address)];
  return new Promise((resolve, reject) => {
    storage().set({ [STORAGE_KEY]: all }, () => {
      const err = chrome.runtime?.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

export function mergeTxRows(existing: TxHistoryRow[], next: TxHistoryRow[]): TxHistoryRow[] {
  const seen = new Set(existing.map(r => r.hash));
  const merged = [...existing];
  for (const row of next) {
    if (seen.has(row.hash)) continue;
    seen.add(row.hash);
    merged.push(row);
  }
  merged.sort((a, b) => b.timestamp - a.timestamp);
  return merged;
}
