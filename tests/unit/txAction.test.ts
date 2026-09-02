import { encodeFunctionData, parseEther } from 'viem';
import { describe, expect, it } from 'vitest';
import { classifyTxAction, formatActionNative, pagePathAndQuery } from '../../src/lib/txAction';

const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const TO = '0x1111111111111111111111111111111111111111';

const TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

describe('classifyTxAction', () => {
  it('returns undefined for non-send and for token approvals', () => {
    expect(
      classifyTxAction({ id: '1', method: 'personal_sign', params: ['hi'] }, { hits: [] }),
    ).toBeUndefined();
    expect(
      classifyTxAction(
        { id: '1', method: 'eth_sendTransaction', params: [{ to: TOKEN }] },
        { hits: ['unlimitedApproval'], tokenApproval: {} as never },
      ),
    ).toBeUndefined();
  });

  it('classifies a native send and an ERC-20 transfer', () => {
    expect(
      classifyTxAction(
        {
          id: '1',
          method: 'eth_sendTransaction',
          params: [{ to: TO, value: `0x${parseEther('1').toString(16)}` }],
        },
        { hits: [] },
      ),
    ).toEqual({ kind: 'send', to: TO, value: parseEther('1') });

    const data = encodeFunctionData({
      abi: TRANSFER_ABI,
      functionName: 'transfer',
      args: [TO, 1_000_000n],
    });
    const action = classifyTxAction(
      { id: '1', method: 'eth_sendTransaction', params: [{ to: TOKEN, data }] },
      { hits: [] },
    );
    expect(action).toMatchObject({
      kind: 'send',
      token: TOKEN,
      recipient: TO,
      tokenAmount: 1_000_000n,
    });
  });

  it('classifies Uniswap execute as a swap and unknown calldata as unknown', () => {
    expect(
      classifyTxAction(
        {
          id: '1',
          method: 'eth_sendTransaction',
          params: [{ to: TO, data: '0x3593564c00' }],
        },
        { hits: [] },
        'execute',
      ),
    ).toMatchObject({ kind: 'swap', functionName: 'execute' });

    expect(
      classifyTxAction(
        {
          id: '1',
          method: 'eth_sendTransaction',
          params: [{ to: TO, data: '0xdeadbeef00' }],
        },
        { hits: ['unknownContract'] },
      ),
    ).toMatchObject({ kind: 'unknown', creating: false, selector: '0xdeadbeef' });
  });
});

describe('txAction helpers', () => {
  it('formats native value and page path', () => {
    expect(formatActionNative(0n, 1)).toBe('0 ETH');
    expect(formatActionNative(parseEther('1'), 8453)).toMatch(/1 ETH/);
    expect(pagePathAndQuery('https://app.uniswap.org/swap?foo=1#hash')).toBe('/swap?foo=1');
    expect(pagePathAndQuery('https://app.uniswap.org/')).toBeUndefined();
  });
});
