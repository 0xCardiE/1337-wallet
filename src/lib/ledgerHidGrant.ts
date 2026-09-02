/** Ledger USB vendor id (`@ledgerhq/devices`). */
export const LEDGER_USB_VENDOR_ID = 0x2c97;

export function ledgerHid(): HID | undefined {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  return nav?.hid;
}

export async function getGrantedLedgerDevice(): Promise<HIDDevice | undefined> {
  const hid = ledgerHid();
  if (!hid) return undefined;
  const devices = await hid.getDevices();
  return devices.find(d => d.vendorId === LEDGER_USB_VENDOR_ID);
}

/** Revoke Chrome’s WebHID grant so the next connect shows the device list again. */
export async function forgetGrantedLedgerHidDevices(): Promise<number> {
  const hid = ledgerHid();
  if (!hid) return 0;
  const devices = (await hid.getDevices()).filter(d => d.vendorId === LEDGER_USB_VENDOR_ID);
  let forgotten = 0;
  for (const device of devices) {
    if (device.opened) await device.close().catch(() => undefined);
    const forget = (device as HIDDevice & { forget?: () => Promise<void> }).forget;
    if (typeof forget !== 'function') continue;
    await forget.call(device);
    forgotten += 1;
  }
  return forgotten;
}
