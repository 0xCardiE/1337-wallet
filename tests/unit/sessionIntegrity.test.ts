import { describe, expect, it } from 'vitest';
import {
  applySessionPatch,
  isUnlockedSessionConsistent,
  planSessionReconcile,
  sessionBlobFromLegacy,
  sessionNeedsVaultHydrate,
} from '../../src/lib/sessionIntegrity';

const PK = `0x${'11'.repeat(32)}`;
const PK2 = `0x${'22'.repeat(32)}`;
const HW = {
  kind: 'ledger' as const,
  accountId: 'ledger:0xabc',
  address: '0xabc',
  derivationPath: "m/44'/60'/0'/0/0",
};

describe('sessionIntegrity', () => {
  it('keeps unlock password when only the active key is patched', () => {
    const next = applySessionPatch(
      { privateKeyHex: PK, unlockPassword: 'secret', lastActivity: 1 },
      { privateKeyHex: PK2 },
      50,
    );
    expect(next.privateKeyHex).toBe(PK2);
    expect(next.unlockPassword).toBe('secret');
    expect(next.hardware).toBeUndefined();
    expect(next.lastActivity).toBe(50);
  });

  it('drops the software key when switching to hardware, and keeps the password', () => {
    const next = applySessionPatch(
      { privateKeyHex: PK, unlockPassword: 'secret' },
      { hardware: HW },
      9,
    );
    expect(next.privateKeyHex).toBeUndefined();
    expect(next.hardware).toEqual(HW);
    expect(next.unlockPassword).toBe('secret');
  });

  it('treats PK-without-password as an inconsistent unlock', () => {
    expect(isUnlockedSessionConsistent({ privateKeyHex: PK })).toBe(false);
    expect(
      isUnlockedSessionConsistent({ privateKeyHex: PK, unlockPassword: 'x' }),
    ).toBe(true);
    expect(isUnlockedSessionConsistent({ hardware: HW, unlockPassword: 'x' })).toBe(
      true,
    );
    expect(isUnlockedSessionConsistent({ hardware: HW })).toBe(false);
  });

  it('migrates split legacy session keys into one blob', () => {
    const blob = sessionBlobFromLegacy({
      privateKeyHex: PK,
      unlockPassword: 'pw',
      lastActivity: 3,
    });
    expect(blob).toEqual({
      privateKeyHex: PK,
      unlockPassword: 'pw',
      lastActivity: 3,
    });
  });

  it('flags missing seed keys or a missing mnemonic as needing vault hydrate', () => {
    const seed = {
      id: 'local:a',
      kind: 'local' as const,
      derivationPath: "m/44'/60'/0'/0/0",
    };
    const seed2 = {
      id: 'local:b',
      kind: 'local' as const,
      derivationPath: "m/44'/60'/0'/0/1",
    };
    expect(sessionNeedsVaultHydrate([seed, seed2], ['local:a'], true)).toBe(true);
    expect(sessionNeedsVaultHydrate([seed], ['local:a'], false)).toBe(true);
    expect(sessionNeedsVaultHydrate([seed, seed2], ['local:a', 'local:b'], true)).toBe(
      false,
    );
    expect(
      sessionNeedsVaultHydrate(
        [{ id: 'ledger:x', kind: 'ledger', derivationPath: seed.derivationPath }],
        [],
        false,
      ),
    ).toBe(false);
  });

  it('locks a signing session that has no vault password on either side', () => {
    expect(
      planSessionReconcile({
        backgroundHasMaterial: true,
        backgroundPassword: undefined,
        uiPassword: null,
        needsVaultHydrate: true,
      }),
    ).toBe('lock');
  });

  it('clears signing material together', () => {
    const next = applySessionPatch(
      { privateKeyHex: PK, unlockPassword: 'secret', hardware: HW },
      { clear: true },
      7,
    );
    expect(next).toEqual({ lastActivity: 7 });
  });

  it('keeps an intact session as-is', () => {
    expect(
      planSessionReconcile({
        backgroundHasMaterial: true,
        backgroundPassword: 'pw',
        uiPassword: 'pw',
        needsVaultHydrate: false,
      }),
    ).toBe('keep');
  });

  it('repairs background from an in-page password instead of locking', () => {
    expect(
      planSessionReconcile({
        backgroundHasMaterial: true,
        backgroundPassword: undefined,
        uiPassword: 'pw',
        needsVaultHydrate: false,
      }),
    ).toBe('repair');
    expect(
      planSessionReconcile({
        backgroundHasMaterial: true,
        backgroundPassword: undefined,
        uiPassword: 'pw',
        needsVaultHydrate: true,
      }),
    ).toBe('hydrate');
  });
});
