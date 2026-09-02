import { describe, expect, it } from 'vitest';
import { isMainAssetRow } from '../../src/lib/tokenListFilter';
import type { WalletBalEntry } from '../../src/lib/walletBalances';

function entry(partial: Partial<WalletBalEntry> & Pick<WalletBalEntry, 'address'>): WalletBalEntry {
  return {
    symbol: 'TKN',
    decimals: 18,
    amount: '1000000000000000000',
    chainId: 1,
    name: 'Token',
    ...partial,
  };
}

describe('isMainAssetRow', () => {
  const empty = { hidden: new Set<string>(), touched: new Set<string>() };

  it('always keeps native and valued tokens', () => {
    expect(
      isMainAssetRow(
        entry({
          address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          symbol: 'ETH',
          name: 'Ether',
        }),
        empty,
      ),
    ).toBe(true);
    expect(
      isMainAssetRow(entry({ address: `0x${'11'.repeat(20)}`, priceUSD: '2' }), empty),
    ).toBe(true);
  });

  it('hides user-hidden tokens and URL-spam airdrops', () => {
    const hidden = new Set([`0x${'22'.repeat(20)}`]);
    expect(
      isMainAssetRow(entry({ address: `0x${'22'.repeat(20)}`, priceUSD: '10' }), {
        hidden,
        touched: new Set(),
      }),
    ).toBe(false);
    expect(
      isMainAssetRow(
        entry({
          address: `0x${'33'.repeat(20)}`,
          name: 'Claim via www.scam.com',
          symbol: 'VISIT',
        }),
        empty,
      ),
    ).toBe(false);
  });

  it('keeps untouched dust only when the user has used the token', () => {
    const addr = `0x${'44'.repeat(20)}`;
    expect(isMainAssetRow(entry({ address: addr, priceUSD: '0' }), empty)).toBe(false);
    expect(
      isMainAssetRow(entry({ address: addr, priceUSD: '0' }), {
        hidden: new Set(),
        touched: new Set([addr]),
      }),
    ).toBe(true);
  });
});
