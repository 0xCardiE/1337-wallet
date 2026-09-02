import { concat, hashTypedData, keccak256 } from 'viem';
import { describe, expect, it } from 'vitest';
import {
  ensureEip712DomainType,
  prepareTrezorTypedData,
} from '../../src/lib/eip712Hashes';
import { normalizeTypedDataForHardware } from '../../src/lib/hardwareSign';

/** Uniswap Permit2 `PermitSingle` as app.uniswap.org sends it — no EIP712Domain type. */
const UNISWAP_PERMIT2 = {
  types: {
    PermitSingle: [
      { name: 'details', type: 'PermitDetails' },
      { name: 'spender', type: 'address' },
      { name: 'sigDeadline', type: 'uint256' },
    ],
    PermitDetails: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' },
    ],
  },
  primaryType: 'PermitSingle',
  domain: {
    name: 'Permit2',
    chainId: 42161,
    verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  message: {
    details: {
      token: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
      amount: '1461501637330902918203684832716283019655932542975',
      expiration: '281474976710655',
      nonce: '0',
    },
    spender: '0x0000000000001fF3684f28c67538d4D072C22734',
    sigDeadline: '1750000000',
  },
};

describe('eip712Hashes', () => {
  it('infers EIP712Domain from Uniswap Permit2 (dapps omit it)', () => {
    const prepared = ensureEip712DomainType(UNISWAP_PERMIT2);
    expect(prepared.types.EIP712Domain).toEqual([
      { name: 'name', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ]);
    expect(prepared.domain.chainId).toBe(42161);
  });

  it('normalizes hex chainId the same as a number', () => {
    const hex = ensureEip712DomainType({
      ...UNISWAP_PERMIT2,
      domain: { ...UNISWAP_PERMIT2.domain, chainId: '0xa4b1' },
    });
    expect(hex.domain.chainId).toBe(42161);
    expect(normalizeTypedDataForHardware({
      ...UNISWAP_PERMIT2,
      domain: { ...UNISWAP_PERMIT2.domain, chainId: '42161' },
    }).domain.chainId).toBe(42161);
  });

  it('computes Trezor domain + message hashes that reassemble to hashTypedData', () => {
    const { domain_separator_hash, message_hash, data } = prepareTrezorTypedData(UNISWAP_PERMIT2);
    expect(domain_separator_hash).toBe(
      '0x8a6e6e19bdfb3db3409910416b47c2f8fc28b49488d6555c7fceaa4479135bc3',
    );
    expect(message_hash).toBe(
      '0xc7395b71541a0a5092dfd657d55d7432fdb9b1999c1833665eb7e58cd7c5232a',
    );
    expect(message_hash).toBeDefined();
    const full = hashTypedData({
      domain: data.domain,
      types: data.types,
      primaryType: 'PermitSingle',
      message: data.message,
    });
    expect(keccak256(concat(['0x1901', domain_separator_hash, message_hash!]))).toBe(full);
  });

  it('omits message_hash when primaryType is EIP712Domain', () => {
    const { message_hash } = prepareTrezorTypedData({
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'chainId', type: 'uint256' },
        ],
      },
      primaryType: 'EIP712Domain',
      domain: { name: 'Example', chainId: 1 },
      message: {},
    });
    expect(message_hash).toBeUndefined();
  });
});
