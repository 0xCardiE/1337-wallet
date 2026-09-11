import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_MAINNET_ORDER,
  DEFAULT_TESTNET_ORDER,
  chainsByKind,
  chainsOrdered,
  setCustomChains,
} from '../../src/lib/chainCatalog';

describe('chain catalog fame order', () => {
  afterEach(() => {
    setCustomChains([]);
  });

  it('lists Ethereum, Base, Robinhood, HyperEVM first among mainnets', () => {
    const ids = chainsByKind('mainnet').map(c => c.chainId);
    expect(ids.slice(0, DEFAULT_MAINNET_ORDER.length)).toEqual([...DEFAULT_MAINNET_ORDER]);
    expect(ids[0]).toBe(1);
    expect(ids[1]).toBe(8453);
    expect(ids[2]).toBe(4663);
    expect(ids[3]).toBe(999);
    expect(ids[4]).toBe(56);
    expect(ids[5]).toBe(43114);
    expect(ids[6]).toBe(42161);
    expect(ids[7]).toBe(137);
    expect(ids[8]).toBe(143);
    expect(ids[9]).toBe(4326);
    expect(ids[10]).toBe(100);
  });

  it('keeps remaining mainnets after the fame list', () => {
    const ids = chainsByKind('mainnet').map(c => c.chainId);
    expect(ids.indexOf(10)).toBeGreaterThan(ids.indexOf(100));
    expect(ids).toContain(2741);
  });

  it('aligns testnets with the same fame ranking', () => {
    const ids = chainsByKind('testnet').map(c => c.chainId);
    expect(ids.slice(0, DEFAULT_TESTNET_ORDER.length)).toEqual([...DEFAULT_TESTNET_ORDER]);
  });

  it('lets the user rank over fame order and appends unknown custom chains', () => {
    setCustomChains([
      {
        chainId: 31337,
        name: 'Anvil',
        shortName: 'anvil',
        kind: 'mainnet',
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['http://127.0.0.1:8545'],
        blockExplorerUrls: [],
      },
    ]);
    const ids = chainsOrdered('mainnet', [8453, 1]).map(c => c.chainId);
    expect(ids.slice(0, 2)).toEqual([8453, 1]);
    expect(ids.at(-1)).toBe(31337);
  });
});
