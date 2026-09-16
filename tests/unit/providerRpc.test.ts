import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleProviderRpc } from '../../src/lib/providerRpc';
import { connectAddress } from '../../src/lib/dappConnections';
import { preferredRpcFor } from '../../src/lib/chainRpcRegistry';
import { loadPersisted, WALLET_PERSIST_KEY } from '../../src/lib/storageState';
import { toHexChainId } from '../../src/provider/types';
import { TEST_ADDRESS, TEST_PK } from './fixtures';
import {
  listPendingApprovals,
  rejectAllPendingApprovals,
  resolvePendingApproval,
} from '../../src/lib/pendingApprovals';
import { watchToken } from '../../src/lib/assetTokenPrefs';

const ORIGIN = 'https://app.uniswap.org';

describe('handleProviderRpc wallet_getCapabilities', () => {
  let sessionStore: Record<string, unknown>;

  beforeEach(() => {
    sessionStore = {};
    chrome.storage.session.get = vi.fn(async (keys?: string | string[]) => {
      if (keys == null) return { ...sessionStore };
      const list = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const k of list) if (k in sessionStore) out[k] = sessionStore[k];
      return out;
    }) as typeof chrome.storage.session.get;
    chrome.storage.session.set = vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(sessionStore, items);
    }) as typeof chrome.storage.session.set;
    chrome.storage.session.remove = vi.fn(async (keys: string | string[]) => {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) delete sessionStore[k];
    }) as typeof chrome.storage.session.remove;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('answers Uniswap EIP-5792 probes without advertising batch send', async () => {
    await connectAddress(ORIGIN, TEST_ADDRESS);
    const res = await handleProviderRpc(
      TEST_PK,
      {
        id: '1',
        method: 'wallet_getCapabilities',
        params: [TEST_ADDRESS],
      },
      ORIGIN,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const caps = res.result as Record<string, Record<string, unknown>>;
    expect(caps[toHexChainId(1)]).toEqual({});
    expect(caps[toHexChainId(42161)]).toEqual({});
    expect(caps[toHexChainId(1)].atomic).toBeUndefined();
  });

  it('returns empty capabilities for a different account instead of 4100', async () => {
    await connectAddress(ORIGIN, TEST_ADDRESS);
    const res = await handleProviderRpc(
      TEST_PK,
      {
        id: '2',
        method: 'wallet_getCapabilities',
        params: ['0x0000000000000000000000000000000000000001'],
      },
      ORIGIN,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.result).toEqual({});
  });

  it('answers when the origin is not connected', async () => {
    const res = await handleProviderRpc(
      TEST_PK,
      {
        id: '2b',
        method: 'wallet_getCapabilities',
        params: [TEST_ADDRESS],
      },
      ORIGIN,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const caps = res.result as Record<string, Record<string, unknown>>;
    expect(caps[toHexChainId(1)]).toEqual({});
  });

  it('still rejects wallet_sendCalls as unsupported', async () => {
    await connectAddress(ORIGIN, TEST_ADDRESS);
    const res = await handleProviderRpc(
      TEST_PK,
      { id: '3', method: 'wallet_sendCalls', params: [] },
      ORIGIN,
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe(4200);
    expect(res.error.message).toMatch(/wallet_sendCalls/);
  });
});

describe('handleProviderRpc wallet_addEthereumChain', () => {
  let localStore: Record<string, unknown>;

  beforeEach(() => {
    localStore = {};
    chrome.storage.local.get = ((keys: unknown, cb: (r: Record<string, unknown>) => void) => {
      const list =
        keys == null
          ? Object.keys(localStore)
          : Array.isArray(keys)
            ? keys
            : [keys as string];
      const out: Record<string, unknown> = {};
      for (const k of list) if (k in localStore) out[k] = localStore[k];
      cb(out);
    }) as typeof chrome.storage.local.get;
    chrome.storage.local.set = ((items: Record<string, unknown>, cb?: () => void) => {
      Object.assign(localStore, items);
      cb?.();
    }) as typeof chrome.storage.local.set;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('switches a catalog chain and ignores the dapp RPC', async () => {
    const evil = 'https://evil.example/rpc';
    const res = await handleProviderRpc(
      TEST_PK,
      {
        id: 'add-1',
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: '0x2105',
            chainName: 'Fake Base',
            rpcUrls: [evil],
          },
        ],
      },
      ORIGIN,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.switchedChainId).toBe(8453);
    const persisted = await loadPersisted();
    expect(persisted.settings.activeChainId).toBe(8453);
    expect(persisted.settings.preferredRpcByChain?.['8453']).toBeUndefined();
    expect(persisted.settings.customRpcByChain?.['8453']).toBeUndefined();
    expect(preferredRpcFor(8453)).toBeUndefined();
    expect(localStore[WALLET_PERSIST_KEY]).toBeTruthy();
  });

  it('rejects an unknown chain instead of planting its RPC', async () => {
    const res = await handleProviderRpc(
      TEST_PK,
      {
        id: 'add-2',
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: '0x12345',
            chainName: 'Phish',
            rpcUrls: ['https://evil.example/rpc'],
          },
        ],
      },
      ORIGIN,
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe(4902);
    const persisted = await loadPersisted();
    expect(persisted.settings.customChains).toBeUndefined();
    expect(persisted.settings.preferredRpcByChain).toBeUndefined();
  });
});

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const WATCH_ERC20 = {
  type: 'ERC20',
  options: { address: USDC, symbol: 'USDC', decimals: 6 },
};

describe('handleProviderRpc wallet_watchAsset', () => {
  let localStore: Record<string, unknown>;

  beforeEach(() => {
    localStore = {};
    rejectAllPendingApprovals('Test cleanup');
    chrome.storage.local.get = ((keys: unknown, cb: (r: Record<string, unknown>) => void) => {
      const list =
        keys == null
          ? Object.keys(localStore)
          : Array.isArray(keys)
            ? keys
            : [keys as string];
      const out: Record<string, unknown> = {};
      for (const k of list) if (k in localStore) out[k] = localStore[k];
      cb(out);
    }) as typeof chrome.storage.local.get;
    chrome.storage.local.set = ((items: Record<string, unknown>, cb?: () => void) => {
      Object.assign(localStore, items);
      cb?.();
    }) as typeof chrome.storage.local.set;
  });

  afterEach(() => {
    rejectAllPendingApprovals('Test cleanup');
    vi.restoreAllMocks();
  });

  it('rejects NFT types without opening a confirm sheet', async () => {
    const res = await handleProviderRpc(
      TEST_PK,
      {
        id: 'watch-nft',
        method: 'wallet_watchAsset',
        params: [{ type: 'ERC721', options: { address: USDC } }],
      },
      ORIGIN,
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe(4200);
    expect(listPendingApprovals()).toEqual([]);
  });

  it('returns true immediately when the token is already watched', async () => {
    await watchToken(1, TEST_ADDRESS, {
      address: USDC,
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    });
    const res = await handleProviderRpc(
      TEST_PK,
      { id: 'watch-again', method: 'wallet_watchAsset', params: [WATCH_ERC20] },
      ORIGIN,
    );
    expect(res).toMatchObject({ ok: true, result: true });
    expect(listPendingApprovals()).toEqual([]);
  });

  it('queues a confirm sheet for a new ERC-20', async () => {
    const pending = handleProviderRpc(
      TEST_PK,
      { id: 'watch-new', method: 'wallet_watchAsset', params: [WATCH_ERC20] },
      ORIGIN,
    );
    await vi.waitFor(() => expect(listPendingApprovals()).toHaveLength(1));
    const [row] = listPendingApprovals();
    expect(row.summary.kind).toBe('watchAsset');
    expect(row.summary.title).toBe('Add token');
    resolvePendingApproval(row.id, { id: row.id, ok: true, result: true });
    await expect(pending).resolves.toMatchObject({ ok: true, result: true });
  });
});
