import { describe, expect, it } from 'vitest';
import {
  firstHidDevice,
  forgetGrantedLedgerDevices,
  formatLedgerError,
  toLedgerPath,
  unwrapDefaultExport,
} from '../../src/lib/ledger';

describe('ledger helpers', () => {
  it('strips the m/ prefix Ledger JS APIs reject', () => {
    expect(toLedgerPath("m/44'/60'/0'/0/0")).toBe("44'/60'/0'/0/0");
    expect(toLedgerPath("44'/60'/0'/0/0")).toBe("44'/60'/0'/0/0");
    expect(toLedgerPath("  m/44'/60'/0'/0/1  ")).toBe("44'/60'/0'/0/1");
  });

  it('unwraps CJS, ESM, and double-default Ledger constructors', () => {
    class LedgerEth {}
    expect(unwrapDefaultExport(LedgerEth)).toBe(LedgerEth);
    expect(unwrapDefaultExport({ default: LedgerEth })).toBe(LedgerEth);
    expect(unwrapDefaultExport({ default: LedgerEth, __esModule: true })).toBe(LedgerEth);
    expect(unwrapDefaultExport({ default: { default: LedgerEth } })).toBe(LedgerEth);
  });

  it('takes the first HID device from a picker result', () => {
    const device = { vendorId: 0x2c97 } as HIDDevice;
    expect(firstHidDevice(undefined)).toBeUndefined();
    expect(firstHidDevice([])).toBeUndefined();
    expect(firstHidDevice([device])).toBe(device);
    expect(firstHidDevice(device)).toBe(device);
  });

  it('maps HID denial separately from a device-screen reject', () => {
    expect(formatLedgerError(new Error('Access denied to use Ledger device'))).toMatch(
      /did not grant the Ledger/,
    );
    expect(formatLedgerError(new Error('0x6985'))).toMatch(/rejected on the device/);
  });

  it('rejects a module that is not a constructor', () => {
    expect(() => unwrapDefaultExport({ default: { address: '0x' } })).toThrow(
      'Ledger library failed to load.',
    );
    expect(() => unwrapDefaultExport(undefined)).toThrow('Ledger library failed to load.');
  });

  it('forgets granted Ledger HID devices so Chrome can prompt again', async () => {
    const forget = async () => undefined;
    const device = { vendorId: 0x2c97, opened: false, forget } as HIDDevice & {
      forget: () => Promise<void>;
    };
    const hid = { getDevices: async () => [device] };
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { navigator: { hid } },
    });
    await expect(forgetGrantedLedgerDevices()).resolves.toBe(1);
  });
});
