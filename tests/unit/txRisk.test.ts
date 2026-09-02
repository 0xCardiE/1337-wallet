import { encodeFunctionData, maxUint256, parseEther } from 'viem';
import { describe, expect, it } from 'vitest';
import {
  classifyRequest,
  formatApprovalAmount,
  formatNativeValue,
  isUnlimitedAmount,
  selectorFromCalldata,
} from '../../src/lib/txRisk';

const SPENDER = '0x1111111111111111111111111111111111111111';
const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

const APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

const SET_ALL_ABI = [
  {
    name: 'setApprovalForAll',
    type: 'function',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
] as const;

function permitTyped(chainId: number, amount: bigint) {
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'Permit',
    domain: { name: 'USD Coin', chainId, verifyingContract: TOKEN },
    message: {
      owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      spender: SPENDER,
      value: `0x${amount.toString(16)}`,
      nonce: '0x0',
      deadline: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    },
  };
}

describe('txRisk helpers', () => {
  it('detects unlimited amounts and 4-byte selectors', () => {
    expect(isUnlimitedAmount(maxUint256)).toBe(true);
    expect(isUnlimitedAmount((1n << 160n) - 1n)).toBe(true);
    expect(isUnlimitedAmount(100n)).toBe(false);
    expect(selectorFromCalldata('0xa9059cbb0001')).toBe('0xa9059cbb');
    expect(formatApprovalAmount(maxUint256)).toBe('Unlimited');
    expect(formatNativeValue(parseEther('1.5'))).toBe('1.5');
  });
});

describe('classifyRequest', () => {
  it('flags unlimited ERC-20 approve', () => {
    const data = encodeFunctionData({
      abi: APPROVE_ABI,
      functionName: 'approve',
      args: [SPENDER, maxUint256],
    });
    const report = classifyRequest(
      { id: '1', method: 'eth_sendTransaction', params: [{ to: TOKEN, data }] },
      { chainId: 1 },
    );
    expect(report.hits).toContain('unlimitedApproval');
    expect(report.tokenApproval?.unlimited).toBe(true);
    expect(report.hits).not.toContain('unknownContract');
  });

  it('flags NFT setApprovalForAll(true) and not a known-safe unknown', () => {
    const data = encodeFunctionData({
      abi: SET_ALL_ABI,
      functionName: 'setApprovalForAll',
      args: [SPENDER, true],
    });
    const report = classifyRequest(
      { id: '1', method: 'eth_sendTransaction', params: [{ to: TOKEN, data }] },
      { chainId: 1 },
    );
    expect(report.hits).toEqual(['unlimitedApproval']);
    expect(report.tokenApproval?.kind).toBe('setApprovalForAll');
  });

  it('treats ERC-20 transfer as known-safe', () => {
    const report = classifyRequest(
      {
        id: '1',
        method: 'eth_sendTransaction',
        params: [{ to: TOKEN, data: '0xa9059cbb', value: '0x0' }],
      },
      { chainId: 1 },
    );
    expect(report.hits).toEqual([]);
  });

  it('flags unknown selectors and contract creation', () => {
    const unknown = classifyRequest(
      {
        id: '1',
        method: 'eth_sendTransaction',
        params: [{ to: TOKEN, data: '0xdeadbeef00' }],
      },
      { chainId: 1 },
    );
    expect(unknown.hits).toContain('unknownContract');
    expect(unknown.unknownSelector).toBe('0xdeadbeef');

    const create = classifyRequest(
      { id: '1', method: 'eth_sendTransaction', params: [{ data: '0x60806040' }] },
      { chainId: 1 },
    );
    expect(create.hits).toContain('unknownContract');
    expect(create.unknownSelector).toBe('contract-creation');
  });

  it('flags high-value native sends at the threshold', () => {
    const report = classifyRequest(
      {
        id: '1',
        method: 'eth_sendTransaction',
        params: [{ to: SPENDER, value: `0x${parseEther('1').toString(16)}` }],
      },
      { chainId: 1, highValueNative: 1 },
    );
    expect(report.hits).toContain('highValue');
  });

  it('does not flag a small native send', () => {
    const report = classifyRequest(
      {
        id: '1',
        method: 'eth_sendTransaction',
        params: [{ to: SPENDER, value: `0x${parseEther('0.01').toString(16)}` }],
      },
      { chainId: 1, highValueNative: 1 },
    );
    expect(report.hits).not.toContain('highValue');
  });

  it('flags SIWE domain mismatch on personal_sign', () => {
    const msg = `evil.com wants you to sign in with your Ethereum account:
0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

URI: https://evil.com
Version: 1
Chain ID: 1
Nonce: abc
Issued At: 2026-01-01T00:00:00.000Z`;
    const report = classifyRequest(
      { id: '1', method: 'personal_sign', params: [msg, SPENDER] },
      { chainId: 1, origin: 'https://app.uniswap.org' },
    );
    expect(report.hits).toContain('siweMismatch');
    expect(report.siwe?.domainMismatch).toBe(true);
  });

  it('flags Permit + chain mismatch on typed data', () => {
    const report = classifyRequest(
      {
        id: '1',
        method: 'eth_signTypedData_v4',
        params: [SPENDER, JSON.stringify(permitTyped(10, maxUint256))],
      },
      { chainId: 1 },
    );
    expect(report.hits).toEqual(
      expect.arrayContaining(['permit', 'unlimitedApproval', 'eip712ChainMismatch']),
    );
    expect(report.eip712Chain?.mismatch).toBe(true);
    expect(report.permit?.unlimited).toBe(true);
  });

  it('does not hit permit for a non-permit typed message', () => {
    const typed = {
      types: {
        EIP712Domain: [{ name: 'chainId', type: 'uint256' }],
        Mail: [{ name: 'contents', type: 'string' }],
      },
      primaryType: 'Mail',
      domain: { chainId: 1 },
      message: { contents: 'hi' },
    };
    const report = classifyRequest(
      { id: '1', method: 'eth_signTypedData_v4', params: [SPENDER, typed] },
      { chainId: 1 },
    );
    expect(report.hits).toEqual([]);
  });
});
