import {
  privateKeyToAccount,
  signMessage as viemSignMessage,
  signTypedData as viemSignTypedData,
} from 'viem/accounts';
import {
  encodeFunctionData,
  getAddress,
  hexToBytes,
  isAddress,
  isHex,
  type Hex,
} from 'viem';
import { ERC20_ABI } from './abis';
import { chainJsonRpcCall } from './ethereum';
import type { SignTxOptions } from './gasOverrides';

export function addressFromPrivateKey(pk: `0x${string}`): `0x${string}` {
  return privateKeyToAccount(pk).address;
}

export async function signPersonalMessage(
  pk: `0x${string}`,
  message: string | Hex | Uint8Array,
): Promise<Hex> {
  if (message instanceof Uint8Array) {
    return viemSignMessage({ privateKey: pk, message: { raw: message } });
  }
  if (typeof message === 'string' && !message.startsWith('0x')) {
    return viemSignMessage({ privateKey: pk, message });
  }
  return viemSignMessage({ privateKey: pk, message: { raw: message as Hex } });
}

export async function signEip712(
  pk: `0x${string}`,
  typedData: {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  },
): Promise<Hex> {
  return viemSignTypedData({
    privateKey: pk,
    domain: typedData.domain as never,
    types: typedData.types as never,
    primaryType: typedData.primaryType,
    message: typedData.message as never,
  });
}

type TxInput = {
  from?: string;
  to?: string;
  data?: string;
  value?: string;
  gas?: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: string;
  chainId?: string | number;
};

function bigIntish(v: string | number | undefined | null): bigint | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'number') return BigInt(v);
  const s = v.trim();
  if (!s) return undefined;
  if (s.startsWith('0x') || s.startsWith('0X')) return BigInt(s);
  return BigInt(s);
}

export async function signAndSendTransaction(
  pk: `0x${string}`,
  chainId: number,
  tx: TxInput,
  opts?: SignTxOptions,
): Promise<Hex> {
  const account = privateKeyToAccount(pk);
  if (tx.from && getAddress(tx.from) !== account.address) {
    throw new Error('Transaction from address does not match unlocked wallet');
  }
  if (!tx.to) throw new Error('Missing transaction to address');

  const value = bigIntish(tx.value) ?? 0n;
  const gasLimit =
    bigIntish(tx.gas ?? tx.gasLimit) ??
    (await chainJsonRpcCall<string>(chainId, 'eth_estimateGas', [
      {
        from: account.address,
        to: tx.to,
        data: tx.data ?? '0x',
        value: value ? `0x${value.toString(16)}` : '0x0',
      },
    ]).then(h => BigInt(h)));
  const gasBuffered = opts?.gasLimitFinal ?? (gasLimit * 125n) / 100n;

  const nonce =
    tx.nonce != null
      ? Number.parseInt(String(tx.nonce), tx.nonce.toString().startsWith('0x') ? 16 : 10)
      : Number.parseInt(
          await chainJsonRpcCall<string>(chainId, 'eth_getTransactionCount', [
            account.address,
            'pending',
          ]),
          16,
        );

  const maxFee = bigIntish(tx.maxFeePerGas);
  const maxPrio = bigIntish(tx.maxPriorityFeePerGas);
  const legacyGas = bigIntish(tx.gasPrice);

  let signed: Hex;
  if (maxFee !== undefined) {
    signed = await account.signTransaction({
      chainId,
      type: 'eip1559',
      nonce,
      gas: gasBuffered,
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: maxPrio ?? maxFee / 10n,
      to: getAddress(tx.to),
      value,
      data: (tx.data as Hex) ?? '0x',
    });
  } else if (legacyGas !== undefined) {
    signed = await account.signTransaction({
      chainId,
      type: 'legacy',
      nonce,
      gas: gasBuffered,
      gasPrice: legacyGas,
      to: getAddress(tx.to),
      value,
      data: (tx.data as Hex) ?? '0x',
    });
  } else {
    const gasHex = await chainJsonRpcCall<string>(chainId, 'eth_gasPrice', []);
    const gasPrice = BigInt(gasHex);
    signed = await account.signTransaction({
      chainId,
      type: 'eip1559',
      nonce,
      gas: gasBuffered,
      maxFeePerGas: (gasPrice * 150n) / 100n,
      maxPriorityFeePerGas: gasPrice / 10n,
      to: getAddress(tx.to),
      value,
      data: (tx.data as Hex) ?? '0x',
    });
  }

  return (await chainJsonRpcCall<string>(chainId, 'eth_sendRawTransaction', [
    signed,
  ])) as Hex;
}

export function parseAddressList(raw: string): `0x${string}`[] {
  const lines = raw
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(Boolean);
  const out: `0x${string}`[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (!isAddress(line)) throw new Error(`Invalid address: ${line}`);
    const a = getAddress(line);
    const lo = a.toLowerCase();
    if (seen.has(lo)) continue;
    seen.add(lo);
    out.push(a);
  }
  if (!out.length) throw new Error('Paste at least one address.');
  return out;
}

export async function sendNativeTransfer(params: {
  pk: `0x${string}`;
  chainId: number;
  to: `0x${string}`;
  amount: bigint;
}): Promise<Hex> {
  const from = addressFromPrivateKey(params.pk);
  return signAndSendTransaction(params.pk, params.chainId, {
    from,
    to: params.to,
    value: `0x${params.amount.toString(16)}`,
  });
}

export async function sendErc20Transfer(params: {
  pk: `0x${string}`;
  chainId: number;
  token: `0x${string}`;
  to: `0x${string}`;
  amount: bigint;
}): Promise<Hex> {
  const from = addressFromPrivateKey(params.pk);
  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [params.to, params.amount],
  });
  return signAndSendTransaction(params.pk, params.chainId, {
    from,
    to: params.token,
    data,
    value: '0x0',
  });
}

export function parseTypedDataParam(raw: unknown): {
  domain: Record<string, unknown>;
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
} {
  if (typeof raw === 'string') {
    return parseTypedDataParam(JSON.parse(raw));
  }
  if (!raw || typeof raw !== 'object') throw new Error('Invalid typed data');
  const obj = raw as Record<string, unknown>;
  if (!obj.primaryType || !obj.types || !obj.message) {
    throw new Error('Invalid typed data payload');
  }
  return {
    domain: (obj.domain as Record<string, unknown>) ?? {},
    types: obj.types as Record<string, Array<{ name: string; type: string }>>,
    primaryType: String(obj.primaryType),
    message: obj.message as Record<string, unknown>,
  };
}

export function bytesToHexMessage(message: string | Hex): string | Hex {
  if (typeof message === 'string' && message.startsWith('0x')) {
    try {
      return hexToBytes(message as Hex);
    } catch {
      return message;
    }
  }
  return message;
}
