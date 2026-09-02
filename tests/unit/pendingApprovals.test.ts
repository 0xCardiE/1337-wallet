import { describe, expect, it } from 'vitest';
import {
  INTERNAL_WALLET_ORIGIN,
  isInternalWalletOrigin,
  isSignMethod,
} from '../../src/lib/pendingApprovals';

describe('pendingApprovals', () => {
  it('treats sign/send methods as confirmable', () => {
    expect(isSignMethod('eth_sendTransaction')).toBe(true);
    expect(isSignMethod('personal_sign')).toBe(true);
    expect(isSignMethod('eth_signTypedData_v4')).toBe(true);
    expect(isSignMethod('eth_sign')).toBe(true);
    expect(isSignMethod('eth_requestAccounts')).toBe(false);
    expect(isSignMethod('wallet_switchEthereumChain')).toBe(false);
  });

  it('recognizes the in-wallet origin', () => {
    expect(isInternalWalletOrigin(INTERNAL_WALLET_ORIGIN)).toBe(true);
    expect(isInternalWalletOrigin('https://app.uniswap.org')).toBe(false);
  });
});
