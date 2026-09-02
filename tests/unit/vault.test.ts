import { describe, expect, it } from 'vitest';
import {
  decryptVaultSecrets,
  encryptPrivateKey,
  encryptVaultSecrets,
} from '../../src/lib/vault';
import { TEST_MNEMONIC, TEST_PK } from './fixtures';

const PASSWORD = '1337-unit-password';

describe('vault', () => {
  it('round-trips v2 secrets including the mnemonic', async () => {
    const vault = await encryptVaultSecrets(
      { keys: { 'local:a': TEST_PK }, mnemonic: TEST_MNEMONIC },
      PASSWORD,
    );
    expect(vault.v).toBe(2);
    const out = await decryptVaultSecrets(vault, PASSWORD);
    expect(out.keys['local:a']).toBe(TEST_PK);
    expect(out.mnemonic).toBe(TEST_MNEMONIC);
  });

  it('rejects a wrong password', async () => {
    const vault = await encryptVaultSecrets({ keys: { a: TEST_PK } }, PASSWORD);
    await expect(decryptVaultSecrets(vault, 'wrong-password')).rejects.toThrow(
      /Wrong password/,
    );
  });

  it('still decrypts a v1 single-key vault', async () => {
    const v1 = await encryptPrivateKey(TEST_PK, PASSWORD);
    expect(v1.v).toBe(1);
    const out = await decryptVaultSecrets(v1, PASSWORD);
    expect(out.keys.legacy.toLowerCase()).toBe(TEST_PK);
  });
});
