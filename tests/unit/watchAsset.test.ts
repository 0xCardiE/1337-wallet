import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress } from 'viem';
import {
  alreadyWatchingAsset,
  applyWatchAsset,
  isSafeTokenImageUrl,
  mergeWatchedBalanceRows,
  parseWatchAssetParams,
} from '../../src/lib/watchAsset';
import { loadWatchedTokens } from '../../src/lib/assetTokenPrefs';
import { TEST_ADDRESS } from './fixtures';

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

const ERC20 = {
  type: 'ERC20',
  options: {
    address: USDC,
    symbol: 'USDC',
    decimals: 6,
    image: 'https://example.com/usdc.png',
  },
};

describe('parseWatchAssetParams', () => {
  it('accepts EIP-747 object params and the array wrapper', () => {
    expect(parseWatchAssetParams(ERC20)).toEqual({
      type: 'ERC20',
      address: getAddress(USDC),
      symbol: 'USDC',
      decimals: 6,
      image: 'https://example.com/usdc.png',
    });
    expect(parseWatchAssetParams([ERC20])).toEqual(parseWatchAssetParams(ERC20));
  });

  it('accepts lowercase type and string decimals', () => {
    expect(
      parseWatchAssetParams({
        type: 'erc20',
        options: { address: USDC.toLowerCase(), decimals: '6' },
      }),
    ).toMatchObject({ type: 'ERC20', address: getAddress(USDC), decimals: 6 });
  });

  it('rejects NFT types with 4200', () => {
    try {
      parseWatchAssetParams({
        type: 'ERC721',
        options: { address: USDC },
      });
      expect.unreachable();
    } catch (e) {
      expect(e).toMatchObject({ code: 4200, message: expect.stringMatching(/NFT/i) });
    }
  });

  it('rejects missing address and native placeholders', () => {
    try {
      parseWatchAssetParams({ type: 'ERC20', options: {} });
      expect.unreachable();
    } catch (e) {
      expect(e).toMatchObject({ code: 4000 });
    }
    try {
      parseWatchAssetParams({
        type: 'ERC20',
        options: { address: '0x0000000000000000000000000000000000000000' },
      });
      expect.unreachable();
    } catch (e) {
      expect(e).toMatchObject({ code: 4000 });
    }
  });

  it('rejects overlong symbols and drops unsafe images', () => {
    try {
      parseWatchAssetParams({
        type: 'ERC20',
        options: { address: USDC, symbol: 'THISISTOOLONG' },
      });
      expect.unreachable();
    } catch (e) {
      expect(e).toMatchObject({ code: 4000 });
    }
    expect(
      parseWatchAssetParams({
        type: 'ERC20',
        options: { address: USDC, image: 'http://insecure.example/x.png' },
      }).image,
    ).toBeUndefined();
  });
});

describe('isSafeTokenImageUrl', () => {
  it('allows https and rejects everything else', () => {
    expect(isSafeTokenImageUrl('https://static.example/token.png')).toBe(true);
    expect(isSafeTokenImageUrl('http://static.example/token.png')).toBe(false);
    expect(isSafeTokenImageUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeTokenImageUrl('data:image/png;base64,abc')).toBe(false);
  });
});

describe('watched token persistence', () => {
  let localStore: Record<string, unknown>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStore = {};
    chrome.storage.local.get = ((keys: unknown, cb: (r: Record<string, unknown>) => void) => {
      const list =
        keys == null ? Object.keys(localStore) : Array.isArray(keys) ? keys : [keys as string];
      const out: Record<string, unknown> = {};
      for (const k of list) if (k in localStore) out[k] = localStore[k];
      cb(out);
    }) as typeof chrome.storage.local.get;
    chrome.storage.local.set = ((items: Record<string, unknown>, cb?: () => void) => {
      Object.assign(localStore, items);
      cb?.();
    }) as typeof chrome.storage.local.set;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
  });

  afterEach(() => {
    vi.stubGlobal('fetch', originalFetch);
    vi.restoreAllMocks();
  });

  it('stores a watched token and reports it as already watching', async () => {
    const parsed = parseWatchAssetParams(ERC20);
    const saved = await applyWatchAsset({
      chainId: 1,
      wallet: TEST_ADDRESS,
      request: parsed,
    });
    expect(saved).toMatchObject({
      address: USDC.toLowerCase(),
      symbol: 'USDC',
      decimals: 6,
    });
    expect(await alreadyWatchingAsset(1, TEST_ADDRESS, USDC)).toBe(true);
    expect(await loadWatchedTokens(1, TEST_ADDRESS)).toHaveLength(1);
  });
});

describe('mergeWatchedBalanceRows', () => {
  it('merges a zero-balance stub when the token is not in the list', () => {
    const merged = mergeWatchedBalanceRows(
      [],
      [
        {
          address: USDC.toLowerCase(),
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
        },
      ],
      1,
    );
    expect(merged).toEqual([
      expect.objectContaining({
        address: getAddress(USDC),
        symbol: 'USDC',
        amount: '0',
        chainId: 1,
      }),
    ]);
  });
});
