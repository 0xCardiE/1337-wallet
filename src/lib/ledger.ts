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

export async function signSerializedTxWithLedger(params: {
  derivationPath: string;
  unsignedSerialized: Hex;
}): Promise<{ r: Hex; s: Hex; v: number }> {
  const { transport, eth } = await openLedgerEth();
  try {
    const rawTxHex = params.unsignedSerialized.replace(/^0x/i, '');
    const sig = await eth.signTransaction(toLedgerPath(params.derivationPath), rawTxHex, null);
    return {
      r: ensureHex(sig.r),
      s: ensureHex(sig.s),
      v: Number.parseInt(sig.v, 16),
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
  if (/denied|reject|cancel/i.test(message)) return 'Ledger request was rejected on the device.';
  if (/locked|0x5515|0x6b0c/i.test(message)) {
    return 'Unlock your Ledger and open the Ethereum app.';
  }
  if (/No device|Access denied|NotFoundError/i.test(message)) {
    return 'No Ledger selected. Plug in the device, unlock it, and try again.';
  }
  return message || 'Ledger request failed.';
}
