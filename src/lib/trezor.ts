import { serializeTransaction, type Hex, type TransactionSerializable } from 'viem';
import { DEFAULT_ETH_DERIVATION_PATH } from './accounts';

type TrezorResponse<T> = {
  success: boolean;
  payload?: T & { error?: string };
  error?: string;
};

async function sendTrezorMessage<T>(message: Record<string, unknown>): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as TrezorResponse<T> | undefined;
  if (!response) throw new Error('No response from Trezor background bridge.');
  if (!response.success) {
    throw new Error(
      response.error || response.payload?.error || 'Trezor request failed or was cancelled.',
    );
  }
  if (!response.payload) throw new Error('Trezor returned an empty payload.');
  return response.payload;
}

export async function listTrezorAddresses(
  derivationPaths: string[],
): Promise<Array<{ address: `0x${string}`; derivationPath: string }>> {
  const paths = derivationPaths.map(p => p.trim()).filter(Boolean);
  if (paths.length === 0) return [];
  await sendTrezorMessage({ type: 'TREZOR_INIT' });
  const payload = await sendTrezorMessage<{
    addresses: Array<{ address: string; path: string }>;
  }>({
    type: 'TREZOR_ETHEREUM_GET_ADDRESS',
    paths,
    showOnTrezor: false,
  });
  const rows = payload.addresses ?? [];
  if (rows.length === 0) throw new Error('Trezor returned no addresses.');
  return rows.map((row, i) => ({
    address: row.address.toLowerCase() as `0x${string}`,
    derivationPath: row.path || paths[i],
  }));
}

export async function connectTrezorAddress(
  derivationPath: string = DEFAULT_ETH_DERIVATION_PATH,
): Promise<{ address: `0x${string}`; derivationPath: string }> {
  const [row] = await listTrezorAddresses([derivationPath]);
  if (!row) throw new Error('Trezor returned no address.');
  return row;
}

function toHexQuantity(value: number | bigint): string {
  return `0x${BigInt(value).toString(16)}`;
}

export async function signTxWithTrezor(params: {
  derivationPath: string;
  tx: TransactionSerializable & { to: Hex; chainId: number };
}): Promise<Hex> {
  await sendTrezorMessage({ type: 'TREZOR_INIT' });
  const tx = params.tx;
  if (tx.nonce == null || tx.gas == null) {
    throw new Error('Transaction missing nonce or gas.');
  }

  const trezorTx: Record<string, unknown> = {
    to: tx.to,
    value: toHexQuantity(tx.value ?? 0n),
    data: tx.data || '0x',
    chainId: tx.chainId,
    nonce: toHexQuantity(tx.nonce),
    gasLimit: toHexQuantity(tx.gas),
  };

  if (tx.type === 'eip1559' || tx.maxFeePerGas != null) {
    trezorTx.maxFeePerGas = toHexQuantity(tx.maxFeePerGas ?? 0n);
    trezorTx.maxPriorityFeePerGas = toHexQuantity(tx.maxPriorityFeePerGas ?? 0n);
  } else if (tx.gasPrice != null) {
    trezorTx.gasPrice = toHexQuantity(tx.gasPrice);
  }

  const payload = await sendTrezorMessage<{ r: string; s: string; v: string | number }>({
    type: 'TREZOR_ETHEREUM_SIGN_TRANSACTION',
    path: params.derivationPath,
    transaction: trezorTx,
  });

  const v =
    typeof payload.v === 'string' ? Number.parseInt(payload.v, 16) : Number(payload.v);

  return serializeTransaction(tx, {
    r: ensureHex(payload.r),
    s: ensureHex(payload.s),
    v: BigInt(v),
  });
}

export async function signPersonalMessageWithTrezor(params: {
  derivationPath: string;
  message: string;
  hex: boolean;
}): Promise<Hex> {
  await sendTrezorMessage({ type: 'TREZOR_INIT' });
  const payload = await sendTrezorMessage<{ signature: string }>({
    type: 'TREZOR_ETHEREUM_SIGN_MESSAGE',
    path: params.derivationPath,
    message: params.message,
    hex: params.hex,
  });
  return ensureHex(payload.signature);
}

export async function signEip712WithTrezor(params: {
  derivationPath: string;
  typedData: {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  };
}): Promise<Hex> {
  await sendTrezorMessage({ type: 'TREZOR_INIT' });
  const payload = await sendTrezorMessage<{ signature: string }>({
    type: 'TREZOR_ETHEREUM_SIGN_TYPED_DATA',
    path: params.derivationPath,
    data: params.typedData,
    metamask_v4_compat: true,
  });
  return ensureHex(payload.signature);
}

function ensureHex(value: string): Hex {
  return (value.startsWith('0x') ? value : `0x${value}`) as Hex;
}
