import { describe, expect, it } from 'vitest';
import {
  createAccountId,
  defaultAccountLabel,
  getActiveAccount,
  isHardwareAccount,
  isKeyBackedAccount,
  normalizeAccount,
  normalizeAccounts,
  resolveActiveAccountId,
  shortAddress,
} from '../../src/lib/accounts';

const ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

describe('accounts', () => {
  it('builds ids and short labels', () => {
    expect(createAccountId('local', ADDR)).toBe(`local:${ADDR.toLowerCase()}`);
    expect(shortAddress(ADDR)).toBe('0xf39F…2266');
    expect(defaultAccountLabel('ledger', ADDR)).toBe('Ledger 0xf39F…2266');
  });

  it('classifies hardware vs key-backed', () => {
    const local = normalizeAccount({ address: ADDR, kind: 'local' })!;
    const ledger = normalizeAccount({ address: ADDR, kind: 'ledger' })!;
    expect(isKeyBackedAccount(local)).toBe(true);
    expect(isHardwareAccount(local)).toBe(false);
    expect(isHardwareAccount(ledger)).toBe(true);
    expect(ledger.derivationPath).toBe("m/44'/60'/0'/0/0");
    expect(local.instant).toBeUndefined();
  });

  it('keeps per-account burner only on software wallets', () => {
    const imported = normalizeAccount({ address: ADDR, kind: 'imported', instant: true })!;
    const trezor = normalizeAccount({ address: ADDR, kind: 'trezor', instant: true })!;
    expect(imported.instant).toBe(true);
    expect(trezor.instant).toBeUndefined();
  });

  it('dedupes and resolves the active account', () => {
    const a = normalizeAccount({ address: ADDR, kind: 'local', id: 'a' })!;
    const b = normalizeAccount({
      address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      kind: 'imported',
      id: 'b',
    })!;
    const list = normalizeAccounts([a, { ...a, label: 'dup' }, null, b]);
    expect(list.map(x => x.id)).toEqual(['a', 'b']);
    expect(resolveActiveAccountId(list, 'missing')).toBe('a');
    expect(getActiveAccount(list, 'b')?.id).toBe('b');
  });
});
