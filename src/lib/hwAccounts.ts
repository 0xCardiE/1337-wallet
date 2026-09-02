import { listLedgerAddresses } from './ledger';
import { listTrezorAddresses } from './trezor';
import {
  hardwarePagePaths,
  type HardwareKind,
  type HwPathScheme,
} from './hwDerivation';

export type HardwareAddressRow = {
  address: `0x${string}`;
  derivationPath: string;
  index: number;
};

export async function listHardwareAddressPage(params: {
  kind: HardwareKind;
  scheme: HwPathScheme;
  startIndex: number;
  device?: HIDDevice;
}): Promise<HardwareAddressRow[]> {
  const paths = hardwarePagePaths(params.scheme, params.startIndex);
  const listed =
    params.kind === 'ledger'
      ? await listLedgerAddresses(paths, {
          device: params.device,
          hold: true,
        })
      : await listTrezorAddresses(paths);
  return listed.map((row, i) => ({
    ...row,
    index: params.startIndex + i,
  }));
}

export function importedAddressSet(accounts: Array<{ address: string }>): Set<string> {
  return new Set(accounts.map(a => a.address.toLowerCase()));
}

export function firstUnusedSelection(
  rows: HardwareAddressRow[],
  imported: Set<string>,
): Record<string, HardwareAddressRow> {
  const unused = rows.find(row => !imported.has(row.address.toLowerCase()));
  return unused ? { [unused.derivationPath]: unused } : {};
}
