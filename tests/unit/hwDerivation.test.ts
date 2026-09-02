import { describe, expect, it } from 'vitest';
import {
  firstUnusedSelection,
  importedAddressSet,
  type HardwareAddressRow,
} from '../../src/lib/hwAccounts';
import {
  defaultHwPathScheme,
  hardwareDerivationPath,
  hardwarePagePaths,
  HW_ADDRESS_PAGE_SIZE,
} from '../../src/lib/hwDerivation';

const A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;
const B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const;

function row(index: number, address: `0x${string}`): HardwareAddressRow {
  return {
    address,
    derivationPath: hardwareDerivationPath('bip44', index),
    index,
  };
}

describe('hardware derivation paths', () => {
  it('defaults Ledger to Ledger Live and Trezor to BIP-44', () => {
    expect(defaultHwPathScheme('ledger')).toBe('ledgerLive');
    expect(defaultHwPathScheme('trezor')).toBe('bip44');
  });

  it('builds the three MetaMask-style schemes', () => {
    expect(hardwareDerivationPath('bip44', 0)).toBe("m/44'/60'/0'/0/0");
    expect(hardwareDerivationPath('bip44', 3)).toBe("m/44'/60'/0'/0/3");
    expect(hardwareDerivationPath('ledgerLive', 0)).toBe("m/44'/60'/0'/0/0");
    expect(hardwareDerivationPath('ledgerLive', 2)).toBe("m/44'/60'/2'/0/0");
    expect(hardwareDerivationPath('legacy', 4)).toBe("m/44'/60'/0'/4");
  });

  it('pages five paths from an offset', () => {
    expect(hardwarePagePaths('bip44', 5)).toEqual([
      "m/44'/60'/0'/0/5",
      "m/44'/60'/0'/0/6",
      "m/44'/60'/0'/0/7",
      "m/44'/60'/0'/0/8",
      "m/44'/60'/0'/0/9",
    ]);
    expect(hardwarePagePaths('ledgerLive', 0)).toHaveLength(HW_ADDRESS_PAGE_SIZE);
  });

  it('rejects a negative index', () => {
    expect(() => hardwareDerivationPath('bip44', -1)).toThrow(/non-negative/);
  });
});

describe('hardware picker selection', () => {
  it('marks already-imported addresses and preselects the first unused', () => {
    const imported = importedAddressSet([{ address: A }]);
    expect(imported.has(A)).toBe(true);
    const rows = [row(0, A), row(1, B)];
    expect(firstUnusedSelection(rows, imported)).toEqual({
      "m/44'/60'/0'/0/1": row(1, B),
    });
    expect(firstUnusedSelection([row(0, A)], imported)).toEqual({});
  });
});
