import { serializeTransaction, type Hex, type TransactionSerializable } from 'viem';
import { DEFAULT_ETH_DERIVATION_PATH } from './accounts';

export function toLedgerPath(path: string): string {
  const trimmed = path.trim();
  return trimmed.startsWith('m/') ? trimmed.slice(2) : trimmed;
}

async function openLedgerEth() {
  const [{ default: TransportWebHID }, { default: Eth }] = await Promise.all([
    import('@ledgerhq/hw-transport-webhid'),
    import('@ledgerhq/hw-app-eth'),
  ]);
  if (!(await TransportWebHID.isSupported())) {
    throw new Error('WebHID is not supported. Use Chrome desktop.');
  }
  const transport = await TransportWebHID.create();
  return { transport, eth: new Eth(transport) };
}

export async function connectLedgerAddress(
  derivationPath: string = DEFAULT_ETH_DERIVATION_PATH,
): Promise<{ address: `0x${string}`; derivationPath: string }> {
  const { transport, eth } = await openLedgerEth();
  try {
    const result = await eth.getAddress(toLedgerPath(derivationPath), true);
    return {
      address: result.address.toLowerCase() as `0x${string}`,
      derivationPath,
    };
  } catch (err) {
    throw new Error(formatLedgerError(err));
  } finally {
    await transport.close().catch(() => undefined);
  }
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
  try {
    const sig = await eth.signEIP712Message(toLedgerPath(params.derivationPath), params.typedData);
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

function formatLedgerError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/denied|reject|cancel|0x6985/i.test(message)) {
    return 'Ledger request was rejected on the device.';
  }
  if (/locked|0x5515|0x6b0c/i.test(message)) {
    return 'Unlock your Ledger and open the Ethereum app.';
  }
  if (/0x6a80|blind sign|unresolved|missing metadata/i.test(message)) {
    return 'Ledger could not clear-sign this contract call. Enable Blind signing in the Ethereum app settings, then retry.';
  }
  if (/No device|Access denied|NotFoundError/i.test(message)) {
    return 'No Ledger selected. Plug in the device, unlock it, and try again.';
  }
  return message || 'Ledger request failed.';
}
