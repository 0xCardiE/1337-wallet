import { describe, expect, it } from 'vitest';
import {
  checkSiweAgainstOrigin,
  parseSiweMessage,
  siweDomainMatchesOrigin,
} from '../../src/lib/siwe';

const SIWE = `app.uniswap.org wants you to sign in with your Ethereum account:
0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

URI: https://app.uniswap.org
Version: 1
Chain ID: 1
Nonce: 32891756
Issued At: 2026-01-01T00:00:00.000Z`;

describe('parseSiweMessage', () => {
  it('parses a standard EIP-4361 message', () => {
    const parsed = parseSiweMessage(SIWE);
    expect(parsed).toEqual({
      domain: 'app.uniswap.org',
      address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      uri: 'https://app.uniswap.org',
      version: '1',
      chainId: 1,
      nonce: '32891756',
    });
  });

  it('returns null for a plain personal_sign message', () => {
    expect(parseSiweMessage('hello from a dapp')).toBeNull();
  });

  it('accepts hex Chain ID', () => {
    const parsed = parseSiweMessage(
      `x.com wants you to sign in with your Ethereum account:\n\nURI: https://x.com\nChain ID: 0xa`,
    );
    expect(parsed?.chainId).toBe(10);
  });
});

describe('siweDomainMatchesOrigin', () => {
  it('matches host and hostname', () => {
    expect(siweDomainMatchesOrigin('app.uniswap.org', 'https://app.uniswap.org/swap')).toBe(true);
    expect(siweDomainMatchesOrigin('localhost:3000', 'http://localhost:3000')).toBe(true);
  });

  it('rejects a different host', () => {
    expect(siweDomainMatchesOrigin('evil.com', 'https://app.uniswap.org')).toBe(false);
  });

  it('is lenient when origin is missing', () => {
    expect(siweDomainMatchesOrigin('app.uniswap.org', undefined)).toBe(true);
  });
});

describe('checkSiweAgainstOrigin', () => {
  it('flags domain, URI, and chain mismatches', () => {
    const parsed = parseSiweMessage(SIWE)!;
    const check = checkSiweAgainstOrigin(parsed, 'https://evil.com/login', 8453);
    expect(check).toEqual({
      domainMismatch: true,
      uriMismatch: true,
      chainMismatch: true,
    });
  });

  it('passes when domain, URI, and chain match', () => {
    const parsed = parseSiweMessage(SIWE)!;
    expect(checkSiweAgainstOrigin(parsed, 'https://app.uniswap.org', 1)).toEqual({
      domainMismatch: false,
      uriMismatch: false,
      chainMismatch: false,
    });
  });
});
