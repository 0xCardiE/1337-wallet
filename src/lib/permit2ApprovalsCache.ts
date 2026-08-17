import type { Permit2ApprovalRow } from './permit2Approvals';

const STORAGE_KEY = '1337_permit2_approvals_v1';

type StoredRow = {
  token: string;
  tokenSymbol: string;
  tokenDecimals: number;
  spender: string;
  amount: string;
  expiration: number;
  nonce: number;
  unlimited: boolean;
  lastApprovalTx?: string;
  lastApprovalBlock?: number;
};

export type Permit2ApprovalsCache = {
  fromBlock: number;
  available: boolean;
  rows: Permit2ApprovalRow[];
  updatedAt: number;
};

type PersistedBundle = Record<
  string,
  {
    fromBlock: number;
    available: boolean;
    rows: StoredRow[];
    updatedAt: number;
  }
>;

function cacheKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

function toStored(rows: Permit2ApprovalRow[]): StoredRow[] {
  return rows.map(r => ({
    token: r.token,
    tokenSymbol: r.tokenSymbol,
    tokenDecimals: r.tokenDecimals,
    spender: r.spender,
    amount: r.amount.toString(),
    expiration: r.expiration,
    nonce: r.nonce,
    unlimited: r.unlimited,
    lastApprovalTx: r.lastApprovalTx,
    lastApprovalBlock: r.lastApprovalBlock,
  }));
}

function fromStored(rows: StoredRow[]): Permit2ApprovalRow[] {
  return rows.map(r => ({
    token: r.token as `0x${string}`,
    tokenSymbol: r.tokenSymbol,
    tokenDecimals: r.tokenDecimals,
    spender: r.spender as `0x${string}`,
    amount: BigInt(r.amount),
    expiration: r.expiration,
    nonce: r.nonce,
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

export async function loadPermit2ApprovalsCache(
  chainId: number,
  address: string,
): Promise<Permit2ApprovalsCache | null> {
  const all = await readAll();
  const entry = all[cacheKey(chainId, address)];
  if (!entry) return null;
  return {
    fromBlock: entry.fromBlock,
    available: entry.available,
    rows: fromStored(entry.rows),
    updatedAt: entry.updatedAt,
  };
}

export async function savePermit2ApprovalsCache(
  chainId: number,
  address: string,
  cache: Permit2ApprovalsCache,
): Promise<void> {
  const all = await readAll();
  all[cacheKey(chainId, address)] = {
    fromBlock: cache.fromBlock,
    available: cache.available,
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
