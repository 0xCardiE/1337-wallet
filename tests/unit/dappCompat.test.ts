import { describe, expect, it } from 'vitest';
import {
  dappCompatForOrigin,
  isDappCompatMode,
  normalizeDappCompatByOrigin,
  resolveProviderInjectConfig,
} from '../../src/lib/dappCompat';

describe('dappCompat', () => {
  it('validates modes', () => {
    expect(isDappCompatMode('metamask')).toBe(true);
    expect(isDappCompatMode('walletconnect')).toBe(false);
  });

  it('keeps only http(s) origins with a non-default override', () => {
    expect(
      normalizeDappCompatByOrigin({
        'https://app.uniswap.org': 'metamask',
        'https://safe.eth': 'default',
        'chrome-extension://x': '1337',
        'https://bad': 'nope',
      }),
    ).toEqual({ 'https://app.uniswap.org': 'metamask' });
  });

  it('resolves per-origin MetaMask impersonation', () => {
    const settings = {
      replaceMetaMask: false,
      dappCompatByOrigin: { 'https://app.uniswap.org': 'metamask' as const },
    };
    expect(dappCompatForOrigin(settings, 'https://app.uniswap.org')).toBe('metamask');
    expect(resolveProviderInjectConfig(settings, 'https://app.uniswap.org')).toMatchObject({
      replaceMetaMask: true,
      is1337: false,
      isMetaMask: true,
      announceAsMetaMask: true,
    });
  });

  it('resolves 1337-only override', () => {
    const settings = {
      replaceMetaMask: true,
      dappCompatByOrigin: { 'https://local.test': '1337' as const },
    };
    expect(resolveProviderInjectConfig(settings, 'https://local.test')).toEqual({
      replaceMetaMask: false,
      is1337: true,
      isMetaMask: false,
      announceAs1337: true,
      announceAsMetaMask: false,
    });
  });

  it('follows the global replace-MetaMask default', () => {
    expect(resolveProviderInjectConfig({ replaceMetaMask: true }, 'https://x.com')).toMatchObject({
      is1337: true,
      isMetaMask: true,
      announceAs1337: true,
      announceAsMetaMask: true,
    });
    expect(resolveProviderInjectConfig({ replaceMetaMask: false }, 'https://x.com')).toMatchObject({
      announceAsMetaMask: false,
    });
  });
});
