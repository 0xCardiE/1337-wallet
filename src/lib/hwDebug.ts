import { closeLedgerPickerSession } from './ledger';
import { isUnpackedExtension } from './hwDebugFlags';
import type { HardwareResetResult } from './hwReset';

export type { HardwareResetResult } from './hwReset';
export { isUnpackedExtension } from './hwDebugFlags';

/**
 * Ask the service worker to forget Ledger HID + reset Trezor Connect.
 * Works from any 1337 extension page console via chrome.runtime.
 */
export async function resetHardwareConnections(): Promise<HardwareResetResult> {
  await closeLedgerPickerSession().catch(() => undefined);
  const response = (await chrome.runtime.sendMessage({ type: 'HW_RESET' })) as
    | HardwareResetResult
    | undefined;
  if (!response) throw new Error('No response from background hardware reset.');
  return response;
}

export function installHardwareDebugConsole(): void {
  if (typeof window === 'undefined' || !isUnpackedExtension()) return;
  const host = window as Window & {
    __1337?: { resetHardware: typeof resetHardwareConnections };
  };
  host.__1337 = { resetHardware: resetHardwareConnections };
}
