import { forgetGrantedLedgerDevices } from './ledger';

export type HardwareResetResult = {
  ledgerForgotten: number;
  trezorReset: boolean;
};

/** Unpacked builds only — store packages have an `update_url`. */
export function isUnpackedExtension(): boolean {
  try {
    return !chrome.runtime.getManifest().update_url;
  } catch {
    return false;
  }
}

/**
 * Drop the Chrome WebHID grant for Ledger and dispose the Trezor Connect
 * session. Next Connect Ledger shows the HID chooser; next Trezor call re-inits.
 */
export async function resetHardwareConnections(): Promise<HardwareResetResult> {
  const ledgerForgotten = await forgetGrantedLedgerDevices();
  let trezorReset = false;
  try {
    const response = (await chrome.runtime.sendMessage({ type: 'TREZOR_RESET' })) as
      | { success?: boolean }
      | undefined;
    trezorReset = response?.success === true;
  } catch {
    trezorReset = false;
  }
  return { ledgerForgotten, trezorReset };
}

export function installHardwareDebugConsole(): void {
  if (typeof window === 'undefined' || !isUnpackedExtension()) return;
  const host = window as Window & {
    __1337?: { resetHardware: typeof resetHardwareConnections };
  };
  host.__1337 = { resetHardware: resetHardwareConnections };
}
