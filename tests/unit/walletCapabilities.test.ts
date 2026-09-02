import { describe, expect, it } from 'vitest';
import { toHexChainId } from '../../src/provider/types';
import {
  eip5792Capabilities,
  parseWalletGetCapabilitiesParams,
} from '../../src/lib/walletCapabilities';

describe('eip5792Capabilities', () => {
  it('returns empty capability objects for catalog chains', () => {
    const all = eip5792Capabilities();
    expect(all[toHexChainId(1)]).toEqual({});
    expect(all[toHexChainId(42161)]).toEqual({});
    expect(all[toHexChainId(1)]).not.toHaveProperty('atomic');
    expect(all[toHexChainId(1)]).not.toHaveProperty('atomicBatch');
    expect(all[toHexChainId(1)]).not.toHaveProperty('paymasterService');
  });

  it('filters to requested catalog chains and omits unknown ids', () => {
    const filtered = eip5792Capabilities([42161, 999999]);
    expect(Object.keys(filtered)).toEqual([toHexChainId(42161)]);
    expect(filtered[toHexChainId(42161)]).toEqual({});
  });
});

describe('parseWalletGetCapabilitiesParams', () => {
  it('reads Uniswap-style [address] probes', () => {
    expect(
      parseWalletGetCapabilitiesParams(['0xF067A77Ed156F328982F0B927E0e9659bD4C144A']),
    ).toEqual({
      address: '0xF067A77Ed156F328982F0B927E0e9659bD4C144A',
    });
  });

  it('reads optional chain id filter and skips malformed ids', () => {
    expect(
      parseWalletGetCapabilitiesParams([
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        ['0xa4b1', 'nope', 8453],
      ]),
    ).toEqual({
      address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      chainIds: [42161, 8453],
    });
  });

  it('rejects a non-array chain id filter', () => {
    expect(() =>
      parseWalletGetCapabilitiesParams(['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', '0x1']),
    ).toThrow(/Invalid params/);
  });
});
