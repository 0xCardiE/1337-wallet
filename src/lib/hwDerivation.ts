export type HwPathScheme = 'bip44' | 'ledgerLive' | 'legacy';
export type HardwareKind = 'ledger' | 'trezor';

export const HW_ADDRESS_PAGE_SIZE = 5;

export const HW_PATH_SCHEMES: { value: HwPathScheme; label: string; title: string }[] = [
  {
    value: 'bip44',
    label: 'BIP-44',
    title: "m/44'/60'/0'/0/x — Trezor and MetaMask default",
  },
  {
    value: 'ledgerLive',
    label: 'Ledger Live',
    title: "m/44'/60'/x'/0/0 — Ledger Live default",
  },
  {
    value: 'legacy',
    label: 'Legacy',
    title: "m/44'/60'/0'/x — older Ledger / MEW",
  },
];

export function defaultHwPathScheme(kind: HardwareKind): HwPathScheme {
  return kind === 'ledger' ? 'ledgerLive' : 'bip44';
}

export function hardwareDerivationPath(scheme: HwPathScheme, index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error('Address index must be a non-negative integer.');
  }
  if (scheme === 'ledgerLive') return `m/44'/60'/${index}'/0/0`;
  if (scheme === 'legacy') return `m/44'/60'/0'/${index}`;
  return `m/44'/60'/0'/0/${index}`;
}

export function hardwarePagePaths(
  scheme: HwPathScheme,
  startIndex: number,
  count: number = HW_ADDRESS_PAGE_SIZE,
): string[] {
  return Array.from({ length: count }, (_, i) => hardwareDerivationPath(scheme, startIndex + i));
}
