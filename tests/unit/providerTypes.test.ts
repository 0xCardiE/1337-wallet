import { describe, expect, it } from 'vitest';
import {
  PROVIDER_RPC_METHODS,
  parseChainIdParam,
  providerError,
  toHexChainId,
} from '../../src/provider/types';

describe('provider types', () => {
  it('exposes the signer RPC surface including disabled eth_sign', () => {
    expect(PROVIDER_RPC_METHODS).toContain('eth_requestAccounts');
    expect(PROVIDER_RPC_METHODS).toContain('personal_sign');
    expect(PROVIDER_RPC_METHODS).toContain('eth_signTypedData_v4');
    expect(PROVIDER_RPC_METHODS).toContain('eth_sign');
    expect(PROVIDER_RPC_METHODS).toContain('wallet_revokePermissions');
    expect(PROVIDER_RPC_METHODS).toContain('wallet_getCapabilities');
  });

  it('parses and formats chain ids', () => {
    expect(toHexChainId(1)).toBe('0x1');
    expect(toHexChainId(8453)).toBe('0x2105');
    expect(parseChainIdParam('0x2105')).toBe(8453);
    expect(parseChainIdParam('10')).toBe(10);
    expect(parseChainIdParam(137)).toBe(137);
    expect(parseChainIdParam('nope')).toBeNull();
  });

  it('builds a provider error payload', () => {
    expect(providerError(4200, 'eth_sign is disabled')).toEqual({
      code: 4200,
      message: 'eth_sign is disabled',
    });
  });
});
