import { beforeEach, describe, expect, it } from 'vitest';
import { clearAccountSession, isUnlocked } from '../../src/lib/accountSession';
import { hydrateAccountFromBackground } from '../../src/lib/sessionBridge';
import { TEST_PK } from './fixtures';

describe('hydrateAccountFromBackground', () => {
  beforeEach(() => {
    clearAccountSession();
  });

  it('does not open the wallet on a private key with no vault password', async () => {
    chrome.runtime.sendMessage = ((
      msg: { type?: string },
      cb?: (r: unknown) => void,
    ) => {
      if (msg?.type === 'GET_SESSION') {
        cb?.({ ok: true, privateKeyHex: TEST_PK });
      } else {
        cb?.({ ok: true });
      }
      return Promise.resolve();
    }) as typeof chrome.runtime.sendMessage;

    const ok = await hydrateAccountFromBackground();
    expect(ok).toBe(false);
    expect(isUnlocked()).toBe(false);
  });
});
