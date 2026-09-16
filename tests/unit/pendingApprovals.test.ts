import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INTERNAL_WALLET_ORIGIN,
  isInternalWalletOrigin,
  isSignMethod,
  listPendingApprovals,
  queueApprovalRequest,
  rejectAllPendingApprovals,
} from '../../src/lib/pendingApprovals';

describe('pendingApprovals', () => {
  beforeEach(() => {
    rejectAllPendingApprovals('Test cleanup');
  });

  afterEach(() => {
    rejectAllPendingApprovals('Test cleanup');
    vi.useRealTimers();
  });

  it('treats sign/send methods as confirmable', () => {
    expect(isSignMethod('eth_sendTransaction')).toBe(true);
    expect(isSignMethod('personal_sign')).toBe(true);
    expect(isSignMethod('eth_signTypedData_v4')).toBe(true);
    expect(isSignMethod('eth_sign')).toBe(true);
    expect(isSignMethod('eth_requestAccounts')).toBe(false);
    expect(isSignMethod('wallet_switchEthereumChain')).toBe(false);
    expect(isSignMethod('wallet_watchAsset')).toBe(false);
  });

  it('summarizes wallet_watchAsset for the confirm sheet', async () => {
    const pending = queueApprovalRequest({
      request: {
        id: 'watch',
        method: 'wallet_watchAsset',
        params: [
          {
            type: 'ERC20',
            options: {
              address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              symbol: 'USDC',
              decimals: 6,
            },
          },
        ],
      },
      origin: 'https://app.uniswap.org',
      chainId: 1,
    });
    const [row] = listPendingApprovals();
    expect(row.summary).toMatchObject({
      kind: 'watchAsset',
      title: 'Add token',
    });
    expect(row.summary.fields.some(f => f.value === 'USDC')).toBe(true);
    rejectAllPendingApprovals('Test cleanup');
    await expect(pending).resolves.toMatchObject({ ok: false });
  });

  it('recognizes the in-wallet origin', () => {
    expect(isInternalWalletOrigin(INTERNAL_WALLET_ORIGIN)).toBe(true);
    expect(isInternalWalletOrigin('https://app.uniswap.org')).toBe(false);
  });

  it('rejects every queued request when the wallet locks', async () => {
    const first = queueApprovalRequest({
      request: { id: 'first', method: 'personal_sign', params: ['hello'] },
      origin: 'https://evil.example',
      chainId: 1,
    });
    const second = queueApprovalRequest({
      request: {
        id: 'second',
        method: 'eth_sendTransaction',
        params: [{ to: '0x0000000000000000000000000000000000000001' }],
      },
      origin: 'https://evil.example',
      chainId: 1,
    });

    expect(listPendingApprovals()).toHaveLength(2);
    expect(rejectAllPendingApprovals('Wallet locked; pending request cancelled')).toBe(2);
    expect(listPendingApprovals()).toEqual([]);
    await expect(first).resolves.toMatchObject({
      ok: false,
      error: { code: 4001, message: 'Wallet locked; pending request cancelled' },
    });
    await expect(second).resolves.toMatchObject({
      ok: false,
      error: { code: 4001, message: 'Wallet locked; pending request cancelled' },
    });
  });

  it('expires a request instead of leaving stale consent pending', async () => {
    vi.useFakeTimers();
    const onExpired = vi.fn();
    const response = queueApprovalRequest({
      request: { id: 'expires', method: 'personal_sign', params: ['hello'] },
      origin: 'https://evil.example',
      chainId: 1,
      ttlMs: 100,
      onExpired,
    });

    await vi.advanceTimersByTimeAsync(100);

    await expect(response).resolves.toMatchObject({
      ok: false,
      error: { code: 4001, message: 'Request expired' },
    });
    expect(onExpired).toHaveBeenCalledOnce();
    expect(listPendingApprovals()).toEqual([]);
  });
});
