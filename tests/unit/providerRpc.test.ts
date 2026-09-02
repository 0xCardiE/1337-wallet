import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleProviderRpc } from '../../src/lib/providerRpc';
import { connectAddress } from '../../src/lib/dappConnections';
import { toHexChainId } from '../../src/provider/types';
import { TEST_ADDRESS, TEST_PK } from './fixtures';

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
