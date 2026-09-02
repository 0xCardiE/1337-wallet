import { describe, expect, it } from 'vitest';
import {
  accountFromPrivateKey,
  ethDerivationPath,
  looksLikeMnemonic,
  normalizeMnemonic,
  parseImportMnemonic,
  parseImportPrivateKey,
  privateKeyFromMnemonic,
} from '../../src/lib/walletCore';
import { TEST_ADDRESS, TEST_MNEMONIC, TEST_PK } from './fixtures';

describe('walletCore', () => {
  it('normalizes and validates BIP-39 phrases', () => {
    expect(normalizeMnemonic('  Test   TEST test ')).toBe('test test test');
    expect(parseImportMnemonic(`  ${TEST_MNEMONIC.toUpperCase()}  `)).toBe(TEST_MNEMONIC);
    expect(() => parseImportMnemonic('one two three')).toThrow(/12, 15, 18, 21, or 24/);
  });

  it('derives MetaMask-style paths and the Anvil #0 key', () => {
    expect(ethDerivationPath(0)).toBe("m/44'/60'/0'/0/0");
    expect(ethDerivationPath(3)).toBe("m/44'/60'/0'/0/3");
    expect(() => ethDerivationPath(-1)).toThrow(/non-negative/);
    expect(privateKeyFromMnemonic(TEST_MNEMONIC, 0).toLowerCase()).toBe(TEST_PK);
    expect(accountFromPrivateKey(TEST_PK).address).toBe(TEST_ADDRESS);
  });

  it('parses pasted private keys', () => {
    expect(parseImportPrivateKey(TEST_PK.slice(2))).toBe(TEST_PK);
    expect(() => parseImportPrivateKey('0xdead')).toThrow(/64 hex/);
  });

  it('distinguishes mnemonic paste from hex', () => {
    expect(looksLikeMnemonic(TEST_MNEMONIC)).toBe(true);
    expect(looksLikeMnemonic(TEST_PK)).toBe(false);
  });
});
