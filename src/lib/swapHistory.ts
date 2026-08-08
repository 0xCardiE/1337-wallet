const SWAP_HISTORY_KEY = '1337_swap_history_v1' as const;
const MAX_ENTRIES = 40;

export type SwapHistoryEntry = {
  id: string;
  at: number;
  wallet: string;
  txHash: `0x${string}`;
  txChainId: number;
  fromChainId: number;
  toChainId: number;
  fromSymbol: string;
  toSymbol: string;
  crossChain: boolean;
};

function storage(): chrome.storage.LocalStorageArea {
  return chrome.storage.local;
}

function isTxHash(h: unknown): h is `0x${string}` {
  return typeof h === 'string' && /^0x[a-fA-F0-9]{64}$/.test(h);
}

function normalizeEntry(x: unknown): SwapHistoryEntry | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (
    typeof o.id !== 'string' ||
    typeof o.at !== 'number' ||
    typeof o.wallet !== 'string' ||
    !isTxHash(o.txHash) ||
    typeof o.txChainId !== 'number' ||
    typeof o.fromChainId !== 'number' ||
    typeof o.toChainId !== 'number' ||
    typeof o.fromSymbol !== 'string' ||
    typeof o.toSymbol !== 'string' ||
    typeof o.crossChain !== 'boolean'
  ) {
    return null;
  }
  return {
    id: o.id,
    at: o.at,
    wallet: o.wallet,
    txHash: o.txHash,
    txChainId: o.txChainId,
    fromChainId: o.fromChainId,
    toChainId: o.toChainId,
    fromSymbol: o.fromSymbol,
    toSymbol: o.toSymbol,
    crossChain: o.crossChain,
  };
}

export async function loadSwapHistory(): Promise<SwapHistoryEntry[]> {
  return new Promise((resolve, reject) => {
    storage().get([SWAP_HISTORY_KEY], (r) => {
      const err = chrome.runtime?.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      const raw = r[SWAP_HISTORY_KEY];
      if (!Array.isArray(raw)) {
        resolve([]);
        return;
      }
      const out: SwapHistoryEntry[] = [];
      for (const item of raw) {
        const e = normalizeEntry(item);
        if (e) out.push(e);
      }
      resolve(out);
    });
  });
}

export async function appendSwapToHistory(entry: {
  wallet: string;
  txHash: `0x${string}`;
  txChainId: number;
  fromChainId: number;
  toChainId: number;
  fromSymbol: string;
  toSymbol: string;
  crossChain: boolean;
}): Promise<SwapHistoryEntry[]> {
  const cur = await loadSwapHistory();
  const id = `${entry.txChainId}:${entry.txHash}`;
  if (cur.some(e => e.id === id)) return cur;
  const row: SwapHistoryEntry = {
    ...entry,
    id,
    at: Date.now(),
  };
  const next = [row, ...cur].slice(0, MAX_ENTRIES);
  await new Promise<void>((resolve, reject) => {
    storage().set({ [SWAP_HISTORY_KEY]: next }, () => {
      const e = chrome.runtime?.lastError;
      if (e) reject(new Error(e.message));
      else resolve();
    });
  });
  return next;
}
