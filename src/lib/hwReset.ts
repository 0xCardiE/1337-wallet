import { forgetGrantedLedgerHidDevices } from './ledgerHidGrant';
import { handleTrezorMessage } from './trezorBackground';

export type HardwareResetResult = {
  ledgerForgotten: number;
  trezorReset: boolean;
};

/** Drop Ledger WebHID grants and dispose the Trezor Connect session. */
export async function resetHardwareConnections(): Promise<HardwareResetResult> {
  const ledgerForgotten = await forgetGrantedLedgerHidDevices();
  const trezor = await handleTrezorMessage({ type: 'TREZOR_RESET' });
  return { ledgerForgotten, trezorReset: trezor.success };
}
