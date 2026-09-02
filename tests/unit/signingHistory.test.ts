import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SIGNING_HISTORY_MAX,
  appendSigning,
  buildSigningRecord,
  clearSigningHistory,
  isMessageSignMethod,
  loadSigningHistory,
} from '../../src/lib/signingHistory';
import { TEST_ADDRESS } from './fixtures';

const NOW = 1_700_000_000_000;

function personalSignRequest(message: string) {
  return {
    id: 'req-1',
    method: 'personal_sign' as const,
    params: [message, TEST_ADDRESS],
  };
}

describe('signingHistory', () => {
  let localStore: Record<string, unknown>;

  beforeEach(() => {
    localStore = {};
    chrome.storage.local.get = vi.fn((_keys: unknown, cb: (r: Record<string, unknown>) => void) => {
      cb({ ...localStore });
    }) as typeof chrome.storage.local.get;
    chrome.storage.local.set = vi.fn((items: Record<string, unknown>, cb?: () => void) => {
      Object.assign(localStore, items);
      cb?.();
    }) as typeof chrome.storage.local.set;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records personal_sign and typed data, not transactions', () => {
    expect(isMessageSignMethod('personal_sign')).toBe(true);
    expect(isMessageSignMethod('eth_signTypedData_v4')).toBe(true);
    expect(isMessageSignMethod('eth_sendTransaction')).toBe(false);

    const message = buildSigningRecord({
      account: TEST_ADDRESS,
      chainId: 1,
      request: personalSignRequest('hello from unit'),
      origin: 'https://app.uniswap.org',
      pageUrl: 'https://app.uniswap.org/swap?foo=1',
      signature: `0x${'ab'.repeat(65)}`,
      source: 'confirm',
      now: NOW,
    });
    expect(message).toMatchObject({
      kind: 'message',
      headline: 'Sign a message from this site',
      preview: 'hello from unit',
      hostname: 'app.uniswap.org',
      source: 'confirm',
    });

    const typed = buildSigningRecord({
      account: TEST_ADDRESS,
      chainId: 1,
      request: {
        id: 'req-2',
        method: 'eth_signTypedData_v4',
        params: [
          TEST_ADDRESS,
          JSON.stringify({
            types: {
              EIP712Domain: [{ name: 'name', type: 'string' }],
              Mail: [{ name: 'contents', type: 'string' }],
            },
            primaryType: 'Mail',
            domain: { name: 'Ether Mail' },
            message: { contents: 'Hello' },
          }),
        ],
      },
      origin: 'https://mail.example',
      source: 'hardware',
      now: NOW,
    });
    expect(typed).toMatchObject({
      kind: 'typedData',
      primaryType: 'Mail',
      domainName: 'Ether Mail',
      hostname: 'mail.example',
      source: 'hardware',
    });
    expect(typed?.typedFields?.some(f => f.label === 'contents' && f.value === 'Hello')).toBe(true);

    expect(
      buildSigningRecord({
        account: TEST_ADDRESS,
        chainId: 1,
        request: { id: 'tx', method: 'eth_sendTransaction', params: [{ to: TEST_ADDRESS }] },
        source: 'confirm',
      }),
    ).toBeNull();
  });

  it('labels SIWE and Permit', () => {
    const siwe = `app.uniswap.org wants you to sign in with your Ethereum account:
${TEST_ADDRESS}

URI: https://app.uniswap.org
Version: 1
Chain ID: 1
Nonce: x
Issued At: 2026-01-01T00:00:00.000Z`;
    const siweRow = buildSigningRecord({
      account: TEST_ADDRESS,
      chainId: 1,
      request: personalSignRequest(siwe),
      origin: 'https://app.uniswap.org',
      source: 'confirm',
      now: NOW,
    });
    expect(siweRow?.kind).toBe('siwe');
    expect(siweRow?.headline).toMatch(/Sign in to app\.uniswap\.org/);

    const permit = buildSigningRecord({
      account: TEST_ADDRESS,
      chainId: 1,
      request: {
        id: 'p',
        method: 'eth_signTypedData_v4',
        params: [
          TEST_ADDRESS,
          JSON.stringify({
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
            domain: {
              name: 'USD Coin',
              chainId: 1,
              verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            },
            message: {
              owner: TEST_ADDRESS,
              spender: '0x1111111111111111111111111111111111111111',
              value: '1',
              nonce: '0',
              deadline: '1',
            },
          }),
        ],
      },
      origin: 'https://app.uniswap.org',
      source: 'confirm',
      now: NOW,
    });
    expect(permit?.kind).toBe('permit');
    expect(permit?.headline).toMatch(/permit/i);
  });

  it('persists per account and caps the list', async () => {
    const first = buildSigningRecord({
      account: TEST_ADDRESS,
      chainId: 1,
      request: personalSignRequest('one'),
      origin: 'https://a.example',
      source: 'confirm',
      now: NOW,
    });
    expect(first).not.toBeNull();
    await appendSigning(first!);
    expect((await loadSigningHistory(TEST_ADDRESS)).map(r => r.preview)).toEqual(['one']);

    const many = Array.from({ length: SIGNING_HISTORY_MAX + 5 }, (_, i) =>
      buildSigningRecord({
        account: TEST_ADDRESS,
        chainId: 1,
        request: { id: `n-${i}`, method: 'personal_sign', params: [`m${i}`] },
        source: 'instant',
        now: NOW + i,
      }),
    );
    for (const row of many) {
      if (row) await appendSigning(row);
    }
    const loaded = await loadSigningHistory(TEST_ADDRESS);
    expect(loaded).toHaveLength(SIGNING_HISTORY_MAX);
    expect(loaded[0]?.preview).toBe(`m${SIGNING_HISTORY_MAX + 4}`);

    await clearSigningHistory(TEST_ADDRESS);
    expect(await loadSigningHistory(TEST_ADDRESS)).toEqual([]);
  });
});
