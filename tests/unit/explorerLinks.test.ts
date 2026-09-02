import { describe, expect, it } from 'vitest';
import {
  addressExplorerLink,
  blockExplorerLink,
  txExplorerLink,
} from '../../src/lib/explorerTxHistory';

const VITALIK = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const TX = `0x${'ab'.repeat(32)}`;

describe('explorer scan links', () => {
  it('builds Etherscan address, block, and tx URLs', () => {
    expect(addressExplorerLink(1, VITALIK)).toBe(`https://etherscan.io/address/${VITALIK}`);
    expect(blockExplorerLink(1, 25_892_765)).toBe('https://etherscan.io/block/25892765');
    expect(txExplorerLink(1, TX)).toBe(`https://etherscan.io/tx/${TX}`);
  });

  it('uses the catalog explorer for other chains', () => {
    expect(addressExplorerLink(8453, VITALIK)).toBe(`https://basescan.org/address/${VITALIK}`);
    expect(blockExplorerLink(8453, 1)).toBe('https://basescan.org/block/1');
  });

  it('returns undefined for invalid inputs', () => {
    expect(addressExplorerLink(1, 'not-an-address')).toBeUndefined();
    expect(blockExplorerLink(1, -1)).toBeUndefined();
    expect(blockExplorerLink(1, 1.5)).toBeUndefined();
    expect(txExplorerLink(1, '0xdead')).toBeUndefined();
  });
});
