import type { NftApprovalRow } from './nftApprovals';

const STORAGE_KEY = '1337_nft_approvals_v1';

export type NftApprovalsCache = {
  fromBlock: number;
  rows: NftApprovalRow[];
  updatedAt: number;
};

type PersistedBundle = Record<string, NftApprovalsCache>;

function cacheKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
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

export async function loadNftApprovalsCache(
  chainId: number,
  address: string,
): Promise<NftApprovalsCache | null> {
  const all = await readAll();
  return all[cacheKey(chainId, address)] ?? null;
}

export async function saveNftApprovalsCache(
  chainId: number,
  address: string,
  cache: NftApprovalsCache,
): Promise<void> {
  const all = await readAll();
  all[cacheKey(chainId, address)] = cache;
  return new Promise((resolve, reject) => {
    storage().set({ [STORAGE_KEY]: all }, () => {
      const err = chrome.runtime?.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}
