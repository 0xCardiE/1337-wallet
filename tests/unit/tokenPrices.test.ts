import { describe, expect, it } from 'vitest';
import {
  applyFetchedUsdPrices,
  llamaCoinId,
  llamaCoinsChain,
  parseLlamaCoinPrices,
} from '../../src/lib/tokenPrices';
import { mergeMainAssetRows, type WalletBalEntry } from '../../src/lib/walletBalances';

const SPENDLE = '0x999999999991e178d52cd95afd4b00d066664144';

describe('llama coin ids', () => {
  it('maps catalog chains onto Llama coins slugs', () => {
    expect(llamaCoinsChain(1)).toBe('ethereum');
    expect(llamaCoinsChain(56)).toBe('bsc');
    expect(llamaCoinsChain(324)).toBe('era');
    expect(llamaCoinsChain(43114)).toBe('avax');
    expect(llamaCoinsChain(11155111)).toBeNull();
    expect(llamaCoinId(1, SPENDLE)).toBe(`ethereum:${SPENDLE}`);
  });
});

describe('parseLlamaCoinPrices', () => {
  it('keeps confident positive prices and ignores junk', () => {
    const prices = parseLlamaCoinPrices({
      coins: {
        [`ethereum:${SPENDLE}`]: { price: 2.04, confidence: 0.99, symbol: 'sPENDLE' },
        'ethereum:0xdead': { price: 1, confidence: 0.1 },
        'ethereum:0xzero': { price: 0, confidence: 0.99 },
      },
    });
    expect(prices.get(`ethereum:${SPENDLE}`)).toBe(2.04);
    expect(prices.has('ethereum:0xdead')).toBe(false);
    expect(prices.has('ethereum:0xzero')).toBe(false);
  });
});

describe('applyFetchedUsdPrices', () => {
  it('fills a missing unit price and leaves priced rows alone', () => {
    const rows = [
      { chainId: 1, address: SPENDLE, symbol: 'sPENDLE' },
      { chainId: 1, address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', priceUSD: '1' },
    ];
    const next = applyFetchedUsdPrices(
      rows,
      new Map([[`ethereum:${SPENDLE}`, 2.04]]),
    );
    expect(next[0]?.priceUSD).toBe('2.04');
    expect(next[1]?.priceUSD).toBe('1');
  });
});

describe('mergeMainAssetRows', () => {
  function row(partial: Partial<WalletBalEntry> & Pick<WalletBalEntry, 'address'>): WalletBalEntry {
    return {
      symbol: 'TKN',
      decimals: 18,
      amount: '1',
      chainId: 1,
      name: 'Token',
      ...partial,
    };
  }

  it('adds a newly priced token without dropping the current main list', () => {
    const eth = row({
      address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      symbol: 'ETH',
      name: 'Ether',
      priceUSD: '3000',
      amount: '1000000000000000000',
    });
    const spendle = row({
      address: SPENDLE,
      symbol: 'sPENDLE',
      name: 'StakedPendle',
      priceUSD: '2.04',
      amount: '279359200000000000000',
    });
    const merged = mergeMainAssetRows([eth], [eth, spendle]);
    expect(merged.map(r => r.symbol)).toEqual(['ETH', 'sPENDLE']);
  });
});
