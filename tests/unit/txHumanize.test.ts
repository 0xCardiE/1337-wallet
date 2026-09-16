import { encodeFunctionData, maxUint256, parseEther } from 'viem';
import { describe, expect, it } from 'vitest';
import { CREATEX_ADDRESS, DISPERSE_CREATEX_CALLDATA } from '../../src/lib/disperseCreate2';
import { humanizeHistoryRow, humanizePendingRequest } from '../../src/lib/txHumanize';
import { classifyRequest } from '../../src/lib/txRisk';

const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const TO = '0x1111111111111111111111111111111111111111';

function riskFor(request: Parameters<typeof classifyRequest>[0]) {
  return classifyRequest(request, { chainId: 1, origin: 'https://app.uniswap.org' });
}

describe('humanizePendingRequest', () => {
  it('explains a native send', () => {
    const request = {
      id: '1',
      method: 'eth_sendTransaction' as const,
      params: [{ to: TO, value: `0x${parseEther('2').toString(16)}` }],
    };
    const line = humanizePendingRequest({
      request,
      risk: riskFor(request),
      chainId: 1,
    });
    expect(line.headline).toMatch(/Send 2 ETH to 0x1111/);
  });

  it('explains unlimited approve', () => {
    const request = {
      id: '1',
      method: 'eth_sendTransaction' as const,
      params: [
        {
          to: TOKEN,
          data: encodeFunctionData({
            abi: [
              {
                name: 'approve',
                type: 'function',
                inputs: [
                  { name: 'spender', type: 'address' },
                  { name: 'amount', type: 'uint256' },
                ],
                outputs: [{ type: 'bool' }],
              },
            ],
            functionName: 'approve',
            args: [TO, maxUint256],
          }),
        },
      ],
    };
    const line = humanizePendingRequest({
      request,
      risk: riskFor(request),
      chainId: 1,
      tokenMeta: { symbol: 'USDC', decimals: 6 },
    });
    expect(line.headline).toBe('Allow 0x1111…1111 to spend unlimited USDC');
  });

  it('explains a SIWE mismatch', () => {
    const msg = `evil.com wants you to sign in with your Ethereum account:
0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

URI: https://evil.com
Version: 1
Chain ID: 1
Nonce: x
Issued At: 2026-01-01T00:00:00.000Z`;
    const request = { id: '1', method: 'personal_sign' as const, params: [msg] };
    const line = humanizePendingRequest({
      request,
      risk: riskFor(request),
      chainId: 1,
    });
    expect(line.headline).toMatch(/does not match this page \(evil\.com\)/);
  });

  it('names the first-user Disperse CreateX deploy', () => {
    const request = {
      id: '1',
      method: 'eth_sendTransaction' as const,
      params: [{ to: CREATEX_ADDRESS, data: DISPERSE_CREATEX_CALLDATA }],
    };
    const line = humanizePendingRequest({
      request,
      risk: { hits: ['unknownContract'] },
      chainId: 1,
    });
    expect(line.headline).toBe('Deploy Disperse.app on this chain');
  });

  it('explains wallet_watchAsset', () => {
    const request = {
      id: '1',
      method: 'wallet_watchAsset' as const,
      params: [
        {
          type: 'ERC20',
          options: {
            address: TOKEN,
            symbol: 'USDC',
            decimals: 6,
          },
        },
      ],
    };
    const line = humanizePendingRequest({
      request,
      risk: { hits: [] },
      chainId: 1,
    });
    expect(line.headline).toBe('Add USDC to Assets');
    expect(line.detail).toMatch(/0xA0b8/i);
  });
});

describe('humanizeHistoryRow', () => {
  it('titles a native send and a failed contract call', () => {
    expect(
      humanizeHistoryRow(
        {
          hash: `0x${'11'.repeat(32)}`,
          from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          to: TO,
          value: parseEther('1'),
          timestamp: 0,
          success: true,
          direction: 'out',
        },
        1,
      ).title,
    ).toBe('Sent ETH');

    expect(
      humanizeHistoryRow(
        {
          hash: `0x${'22'.repeat(32)}`,
          from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          to: TO,
          value: 0n,
          timestamp: 0,
          success: false,
          direction: 'out',
          methodId: '0xdeadbeef',
        },
        1,
      ).title,
    ).toBe('Failed contract call');
  });
});
