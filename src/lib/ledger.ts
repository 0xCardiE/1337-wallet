import TransportWebHIDModule from '@ledgerhq/hw-transport-webhid';
import LedgerEthModule from '@ledgerhq/hw-app-eth';
import { serializeTransaction, type Hex, type TransactionSerializable } from 'viem';
import { DEFAULT_ETH_DERIVATION_PATH } from './accounts';
import { eip712BlindSignHashes } from './eip712Hashes';
import {
  forgetGrantedLedgerHidDevices,
  LEDGER_USB_VENDOR_ID,
  ledgerHid,
} from './ledgerHidGrant';

export { getGrantedLedgerDevice, LEDGER_USB_VENDOR_ID } from './ledgerHidGrant';

export function toLedgerPath(path: string): string {
  const trimmed = path.trim();
  return trimmed.startsWith('m/') ? trimmed.slice(2) : trimmed;
}

/** CJS/ESM interop for Ledger packages (webpack may wrap `exports.default`). */
export function unwrapDefaultExport<T>(mod: unknown): T {
  if (typeof mod === 'function') return mod as T;
  if (mod && typeof mod === 'object') {
    const exported = (mod as { default?: unknown }).default;
    if (typeof exported === 'function') return exported as T;
    if (exported && typeof exported === 'object') {
      const nested = (exported as { default?: unknown }).default;
      if (typeof nested === 'function') return nested as T;
    }
  }
  throw new Error('Ledger library failed to load.');
}

/**
 * Start the Chrome HID chooser in this turn — no `await` before `requestDevice`,
 * or Chrome swallows the click and shows nothing.
 */
export function startLedgerHidPicker(): Promise<HIDDevice[]> {
  const hid = ledgerHid();
  if (!hid) {
    return Promise.reject(new Error('WebHID is not supported. Use Chrome desktop.'));
  }
  return hid.requestDevice({ filters: [{ vendorId: LEDGER_USB_VENDOR_ID }] });
}

/**
 * Chrome renders the HID device chooser only in a normal browser tab with an
 * address bar — never in the side panel or a `type: 'popup'` window (there
 * `requestDevice` resolves empty without showing anything). MetaMask forces
 * "Expand View" (a full tab) for the same reason.
 */
export async function openLedgerHidConnectTab(): Promise<void> {
  await chrome.tabs.create({
    url: chrome.runtime.getURL('index.html?ledgerhid=1'),
    active: true,
  });
}

let pickerSession: Awaited<ReturnType<typeof openLedgerEth>> | null = null;

export async function closeLedgerPickerSession(): Promise<void> {
  const session = pickerSession;
  pickerSession = null;
  if (session) await session.transport.close().catch(() => undefined);
}

/** Revoke Chrome’s WebHID grant so the next connect shows the device list again. */
export async function forgetGrantedLedgerDevices(): Promise<number> {
  await closeLedgerPickerSession();
  return forgetGrantedLedgerHidDevices();
}

export function firstHidDevice(picked: HIDDevice[] | HIDDevice | undefined): HIDDevice | undefined {
  if (!picked) return undefined;
  return Array.isArray(picked) ? picked[0] : picked;
}

async function requestLedgerHidDevice(opts?: { device?: HIDDevice }): Promise<HIDDevice> {
  if (opts?.device) return opts.device;
  const hid = ledgerHid();
  if (!hid) throw new Error('WebHID is not supported. Use Chrome desktop.');
  const existing = (await hid.getDevices()).filter(d => d.vendorId === LEDGER_USB_VENDOR_ID);
  if (existing[0]) return existing[0];
  const device = firstHidDevice(await startLedgerHidPicker());
  if (!device) {
    throw new Error(
      'Chrome did not grant the Ledger. Close Ledger Live, unlock the Nano, open the Ethereum app, then pick it in the browser list.',
    );
  }
  return device;
}

async function openLedgerEth(opts?: { device?: HIDDevice }) {
  // Static imports stay in the popup chunk. Dynamic `import()` made a second
  // LavaMoat graph with numeric IDs ("Policy does not allow importing 2 from 6").
  const TransportWebHID = unwrapDefaultExport<typeof import('@ledgerhq/hw-transport-webhid').default>(
    TransportWebHIDModule,
  );
  const LedgerEth = unwrapDefaultExport<typeof import('@ledgerhq/hw-app-eth').default>(
    LedgerEthModule,
  );
  if (!ledgerHid()) {
    throw new Error('WebHID is not supported. Use Chrome desktop.');
  }
  try {
    const device = await requestLedgerHidDevice(opts);
    if (device.opened) await device.close().catch(() => undefined);
    const transport = await TransportWebHID.open(device);
    return { transport, eth: new LedgerEth(transport) };
  } catch (err) {
    throw new Error(formatLedgerError(err));
  }
}

export async function listLedgerAddresses(
  derivationPaths: string[],
  opts?: { device?: HIDDevice; hold?: boolean },
): Promise<Array<{ address: `0x${string}`; derivationPath: string }>> {
  if (derivationPaths.length === 0) return [];
  const opened = opts?.hold
    ? pickerSession ?? (pickerSession = await openLedgerEth(opts))
    : await openLedgerEth(opts);
  try {
    const out: Array<{ address: `0x${string}`; derivationPath: string }> = [];
    for (const derivationPath of derivationPaths) {
      // false = do not confirm each address on the device (picker lists many).
      const result = await opened.eth.getAddress(toLedgerPath(derivationPath), false);
      out.push({
        address: result.address.toLowerCase() as `0x${string}`,
        derivationPath,
      });
    }
    return out;
  } catch (err) {
    if (opts?.hold) await closeLedgerPickerSession();
    throw new Error(formatLedgerError(err));
  } finally {
    if (!opts?.hold) await opened.transport.close().catch(() => undefined);
  }
}

export async function connectLedgerAddress(
  derivationPath: string = DEFAULT_ETH_DERIVATION_PATH,
  opts?: { device?: HIDDevice },
): Promise<{ address: `0x${string}`; derivationPath: string }> {
  const [row] = await listLedgerAddresses([derivationPath], opts);
  if (!row) throw new Error('Ledger returned no address.');
  return row;
}

function parseLedgerV(v: string | number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return 0;
  if (s.startsWith('0x') || s.startsWith('0X')) return Number.parseInt(s, 16);
  if (/^[0-9]+$/.test(s)) return Number.parseInt(s, 10);
  return Number.parseInt(s, 16);
}

export async function signSerializedTxWithLedger(params: {
  derivationPath: string;
  unsignedSerialized: Hex;
}): Promise<{ r: Hex; s: Hex; v: number }> {
  const { transport, eth } = await openLedgerEth();
  try {
    const rawTxHex = params.unsignedSerialized.replace(/^0x/i, '');
    const path = toLedgerPath(params.derivationPath);
    const resolutionConfig = {
      erc20: true,
      externalPlugins: true,
      nft: true,
      uniswapV3: true,
    };
    let sig: { r: string; s: string; v: string };
    try {
      // Resolve ERC-20 / plugin metadata so the device can clear-sign contract calls.
      // throwOnError=false: CAL miss still attempts a device sign (blind-sign fallback).
      sig = await eth.clearSignTransaction(path, rawTxHex, resolutionConfig, false);
    } catch (clearErr) {
      try {
        sig = await eth.signTransaction(path, rawTxHex, null);
      } catch {
        throw clearErr;
      }
    }
    return {
      r: ensureHex(sig.r),
      s: ensureHex(sig.s),
      v: parseLedgerV(sig.v),
    };
  } catch (err) {
    throw new Error(formatLedgerError(err));
  } finally {
    await transport.close().catch(() => undefined);
  }
}

export async function signTxWithLedger(params: {
  derivationPath: string;
  tx: TransactionSerializable;
}): Promise<Hex> {
  const unsignedSerialized = serializeTransaction(params.tx);
  const sig = await signSerializedTxWithLedger({
    derivationPath: params.derivationPath,
    unsignedSerialized,
  });
  return serializeTransaction(params.tx, {
    r: sig.r,
    s: sig.s,
    v: BigInt(sig.v),
  });
}

export async function signPersonalMessageWithLedger(params: {
  derivationPath: string;
  messageHex: string;
}): Promise<{ r: Hex; s: Hex; v: number }> {
  const { transport, eth } = await openLedgerEth();
  try {
    const sig = await eth.signPersonalMessage(
      toLedgerPath(params.derivationPath),
      params.messageHex.replace(/^0x/i, ''),
    );
    return { r: ensureHex(sig.r), s: ensureHex(sig.s), v: sig.v };
  } catch (err) {
    throw new Error(formatLedgerError(err));
  } finally {
    await transport.close().catch(() => undefined);
  }
}

export function isLedgerEip712ClearSignUnsupported(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /0x6d00|INS_NOT_SUPPORTED/i.test(message);
}

function toLedgerHashHex(value: string): string {
  return value.replace(/^0x/i, '');
}

export async function signEip712WithLedger(params: {
  derivationPath: string;
  typedData: {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  };
}): Promise<{ r: Hex; s: Hex; v: number }> {
  const { transport, eth } = await openLedgerEth();
  const path = toLedgerPath(params.derivationPath);
  try {
    let sig: { r: string; s: string; v: number };
    try {
      sig = await eth.signEIP712Message(path, params.typedData);
    } catch (clearErr) {
      // Nano S / older ETH apps have no full EIP-712 APDU (Uniswap Permit2 hits this).
      if (!isLedgerEip712ClearSignUnsupported(clearErr)) throw clearErr;
      const hashes = eip712BlindSignHashes(params.typedData);
      sig = await eth.signEIP712HashedMessage(
        path,
        toLedgerHashHex(hashes.domainSeparatorHash),
        toLedgerHashHex(hashes.messageHash),
      );
    }
    return { r: ensureHex(sig.r), s: ensureHex(sig.s), v: sig.v };
  } catch (err) {
    throw new Error(formatLedgerError(err));
  } finally {
    await transport.close().catch(() => undefined);
  }
}

function ensureHex(value: string): Hex {
  return (value.startsWith('0x') ? value : `0x${value}`) as Hex;
}

export function formatLedgerError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/user gesture|must be handling/i.test(message)) {
    return 'Chrome blocked the device list (lost click). Use the Ledger tab and click Allow.';
  }
  if (/Access denied to use Ledger|did not grant the Ledger|No device|NotFoundError|HIDNotSupported/i.test(message)) {
    return 'Chrome did not grant the Ledger. Close Ledger Live, unlock the Nano, open the Ethereum app, then pick it in the browser list.';
  }
  if (/0x6985|denied on the device/i.test(message)) {
    return 'Ledger request was rejected on the device.';
  }
  if (/locked|0x5515|0x6b0c/i.test(message)) {
    return 'Unlock your Ledger and open the Ethereum app.';
  }
  if (/0x6d00|INS_NOT_SUPPORTED/i.test(message)) {
    return 'This Ledger Ethereum app cannot sign this typed data. Update the Ethereum app in Ledger Live, enable Blind signing, then retry.';
  }
  if (/0x6a80|blind sign|unresolved|missing metadata/i.test(message)) {
    return 'Ledger could not clear-sign this contract call. Enable Blind signing in the Ethereum app settings, then retry.';
  }
  return message || 'Ledger request failed.';
}
