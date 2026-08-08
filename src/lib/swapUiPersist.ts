const STORAGE_KEY = '1337_swap_ui_by_wallet_v1' as const;

export type PersistedSwapUi = {
  fromChainId: number;
  toChainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  amountStr: string;
};

type Vault = Record<string, PersistedSwapUi>;

function area(): chrome.storage.LocalStorageArea {
  return chrome.storage.local;
}

function validChainId(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function normalizeRow(x: unknown): PersistedSwapUi | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (
    !validChainId(o.fromChainId) ||
    !validChainId(o.toChainId) ||
    typeof o.fromTokenAddress !== 'string' ||
    typeof o.toTokenAddress !== 'string' ||
    typeof o.amountStr !== 'string'
  ) {
    return null;
  }
  const fromA = o.fromTokenAddress.trim();
  const toA = o.toTokenAddress.trim();
  if (!fromA || !toA) return null;
  return {
    fromChainId: o.fromChainId,
    toChainId: o.toChainId,
    fromTokenAddress: fromA,
    toTokenAddress: toA,
    amountStr: o.amountStr.trim(),
  };
}

async function readVault(): Promise<Vault> {
  return new Promise((resolve, reject) => {
    area().get([STORAGE_KEY], r => {
      const err = chrome.runtime?.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      const raw = r[STORAGE_KEY] as unknown;
      if (!raw || typeof raw !== 'object') {
        resolve({});
        return;
      }
      resolve(raw as Vault);
    });
  });
}

async function writeVault(v: Vault): Promise<void> {
  return new Promise((resolve, reject) => {
    area().set({ [STORAGE_KEY]: v }, () => {
      const e = chrome.runtime?.lastError;
      if (e) reject(new Error(e.message));
      else resolve();
    });
  });
}

export async function loadSwapUi(walletLower: string): Promise<PersistedSwapUi | null> {
  const v = await readVault();
  return normalizeRow(v[walletLower]) ?? null;
}

export async function saveSwapUi(
  walletLower: string,
  row: PersistedSwapUi | null,
): Promise<void> {
  const v = await readVault();
  if (row === null) {
    delete v[walletLower];
  } else {
    v[walletLower] = row;
  }
  await writeVault(v);
}
