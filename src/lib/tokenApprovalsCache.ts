import type { TokenApprovalRow } from './tokenApprovals';

const STORAGE_KEY = '1337_token_approvals_v1';

type StoredRow = {
  token: string;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenLogo?: string;
  spender: string;
  allowance: string;
  unlimited: boolean;
  lastApprovalTx?: string;
  lastApprovalBlock?: number;
};

export type TokenApprovalsCache = {
  scannedTokenAddresses: string[];
  fromBlock: number;
  rows: TokenApprovalRow[];
  updatedAt: number;
};

type PersistedBundle = Record<
  string,
  {
    scannedTokenAddresses: string[];
    fromBlock: number;
    rows: StoredRow[];
    updatedAt: number;
  }
>;

function cacheKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

function toStored(rows: TokenApprovalRow[]): StoredRow[] {
  return rows.map(r => ({
    token: r.token,
    tokenSymbol: r.tokenSymbol,
    tokenDecimals: r.tokenDecimals,
    tokenLogo: r.tokenLogo,
    spender: r.spender,
    allowance: r.allowance.toString(),
    unlimited: r.unlimited,
    lastApprovalTx: r.lastApprovalTx,
    lastApprovalBlock: r.lastApprovalBlock,
  }));
}

function fromStored(rows: StoredRow[]): TokenApprovalRow[] {
  return rows.map(r => ({
    token: r.token as `0x${string}`,
    tokenSymbol: r.tokenSymbol,
    tokenDecimals: r.tokenDecimals,
    tokenLogo: r.tokenLogo,
    spender: r.spender as `0x${string}`,
    allowance: BigInt(r.allowance),
    unlimited: r.unlimited,
    lastApprovalTx: r.lastApprovalTx as `0x${string}` | undefined,
    lastApprovalBlock: r.lastApprovalBlock,
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

export async function loadTokenApprovalsCache(
  chainId: number,
  address: string,
): Promise<TokenApprovalsCache | null> {
  const all = await readAll();
  const entry = all[cacheKey(chainId, address)];
  if (!entry) return null;
  return {
    scannedTokenAddresses: entry.scannedTokenAddresses.map(a => a.toLowerCase()),
    fromBlock: entry.fromBlock,
    rows: fromStored(entry.rows),
    updatedAt: entry.updatedAt,
  };
}

export async function saveTokenApprovalsCache(
  chainId: number,
  address: string,
  cache: TokenApprovalsCache,
): Promise<void> {
  const all = await readAll();
  all[cacheKey(chainId, address)] = {
    scannedTokenAddresses: cache.scannedTokenAddresses.map(a => a.toLowerCase()),
    fromBlock: cache.fromBlock,
    rows: toStored(cache.rows),
    updatedAt: cache.updatedAt,
  };
  return new Promise((resolve, reject) => {
    storage().set({ [STORAGE_KEY]: all }, () => {
      const err = chrome.runtime?.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

export async function clearTokenApprovalsCache(chainId: number, address: string): Promise<void> {
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
