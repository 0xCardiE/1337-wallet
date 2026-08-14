import { bytesToHex, getAddress, stringToHex, type Hex, type TransactionSerializable } from 'viem';
import { DEFAULT_ETH_DERIVATION_PATH, type WalletAccount } from './accounts';
import {
  bytesToHexMessage,
  parseTypedDataParam,
} from './backgroundSign';
import { chainJsonRpcCall } from './ethereum';
import { applyGasOverrides, type GasOverrideInput } from './gasOverrides';
import { signEip712WithLedger, signPersonalMessageWithLedger, signTxWithLedger } from './ledger';
import {
  signEip712WithTrezor,
  signPersonalMessageWithTrezor,
  signTxWithTrezor,
} from './trezor';

export function signatureComponentsToHex(r: string, s: string, v: number): Hex {
  const rClean = r.replace(/^0x/i, '').padStart(64, '0');
  const sClean = s.replace(/^0x/i, '').padStart(64, '0');
  const vNorm = v < 27 ? v + 27 : v;
  return `0x${rClean}${sClean}${vNorm.toString(16).padStart(2, '0')}` as Hex;
}

function messageParamToDeviceFormats(raw: unknown): { ledgerHex: string; trezorMessage: string; trezorHex: boolean } {
  if (typeof raw !== 'string') throw new Error('Invalid message parameter.');
  const normalized = bytesToHexMessage(raw);
  if (typeof normalized === 'string') {
    if (normalized.startsWith('0x')) {
      return { ledgerHex: normalized.slice(2), trezorMessage: normalized, trezorHex: true };
    }
    const hex = stringToHex(normalized);
    return { ledgerHex: hex.slice(2), trezorMessage: normalized, trezorHex: false };
  }
  const hex = bytesToHex(normalized);
  return { ledgerHex: hex.slice(2), trezorMessage: hex, trezorHex: true };
}

export function normalizeTypedDataForHardware(typed: ReturnType<typeof parseTypedDataParam>) {
  const domain = { ...typed.domain };
  if (domain.chainId !== undefined) {
    const cid = domain.chainId;
    if (typeof cid === 'string') {
      domain.chainId = cid.startsWith('0x') ? Number.parseInt(cid, 16) : Number(cid);
    }
  }
  const types = { ...typed.types };
  if (!types.EIP712Domain) {
    const fields: Array<{ name: string; type: string }> = [];
    if (domain.name !== undefined) fields.push({ name: 'name', type: 'string' });
    if (domain.version !== undefined) fields.push({ name: 'version', type: 'string' });
    if (domain.chainId !== undefined) fields.push({ name: 'chainId', type: 'uint256' });
    if (domain.verifyingContract !== undefined) {
      fields.push({ name: 'verifyingContract', type: 'address' });
    }
    if (domain.salt !== undefined) fields.push({ name: 'salt', type: 'bytes32' });
    types.EIP712Domain = fields;
  }
  return {
    domain,
    types,
    primaryType: typed.primaryType,
    message: typed.message,
  };
}

function parseTypedDataFromParams(method: string, params: unknown[]) {
  let typedRaw = params[1] ?? params[0];
  if (method === 'eth_signTypedData_v3' || method === 'eth_signTypedData_v4') {
    typedRaw = params[1];
  }
  return normalizeTypedDataForHardware(parseTypedDataParam(typedRaw));
}

function assertSignerAddress(account: WalletAccount, addrParam: unknown) {
  if (typeof addrParam === 'string' && getAddress(addrParam) !== getAddress(account.address)) {
    throw new Error('Signer address mismatch');
  }
}

export async function signPersonalMessageWithHardware(
  account: WalletAccount,
  messageParam: unknown,
): Promise<Hex> {
  const path = account.derivationPath || DEFAULT_ETH_DERIVATION_PATH;
  const formats = messageParamToDeviceFormats(messageParam);
  if (account.kind === 'ledger') {
    const sig = await signPersonalMessageWithLedger({
      derivationPath: path,
      messageHex: formats.ledgerHex,
    });
    return signatureComponentsToHex(sig.r, sig.s, sig.v);
  }
  return signPersonalMessageWithTrezor({
    derivationPath: path,
    message: formats.trezorMessage,
    hex: formats.trezorHex,
  });
}

export async function signEip712WithHardware(
  account: WalletAccount,
  typedData: ReturnType<typeof normalizeTypedDataForHardware>,
): Promise<Hex> {
  const path = account.derivationPath || DEFAULT_ETH_DERIVATION_PATH;
  if (account.kind === 'ledger') {
    const sig = await signEip712WithLedger({ derivationPath: path, typedData });
    return signatureComponentsToHex(sig.r, sig.s, sig.v);
  }
  return signEip712WithTrezor({ derivationPath: path, typedData });
}

async function buildHardwareTransaction(
  account: WalletAccount,
  chainId: number,
  rawTx: Record<string, unknown>,
  gasOverrides?: GasOverrideInput,
): Promise<TransactionSerializable & { to: Hex }> {
  const { tx: merged } = applyGasOverrides(rawTx, gasOverrides);
  if (!merged.to || typeof merged.to !== 'string') {
    throw new Error('Missing transaction to address.');
  }
  const value =
    typeof merged.value === 'string' && merged.value ? BigInt(merged.value) : 0n;
  const gas =
    typeof merged.gas === 'string' && merged.gas
      ? BigInt(merged.gas)
      : typeof merged.gasLimit === 'string' && merged.gasLimit
        ? BigInt(merged.gasLimit)
        : await chainJsonRpcCall<string>(chainId, 'eth_estimateGas', [
            {
              from: account.address,
              to: merged.to,
              data: (merged.data as string) ?? '0x',
              value: merged.value ?? '0x0',
            },
          ]).then(h => BigInt(h));
  const nonce =
    merged.nonce != null
      ? Number.parseInt(String(merged.nonce), String(merged.nonce).startsWith('0x') ? 16 : 10)
      : Number.parseInt(
          await chainJsonRpcCall<string>(chainId, 'eth_getTransactionCount', [
            account.address,
            'pending',
          ]),
          16,
        );
  const maxFee = merged.maxFeePerGas != null ? BigInt(String(merged.maxFeePerGas)) : undefined;
  const maxPrio =
    merged.maxPriorityFeePerGas != null ? BigInt(String(merged.maxPriorityFeePerGas)) : undefined;
  const gasPrice = merged.gasPrice != null ? BigInt(String(merged.gasPrice)) : undefined;

  if (maxFee != null) {
    return {
      type: 'eip1559',
      chainId,
      nonce,
      gas,
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: maxPrio ?? maxFee / 10n,
      to: merged.to as Hex,
      value,
      data: ((merged.data as string) ?? '0x') as Hex,
    };
  }
  return {
    type: 'legacy',
    chainId,
    nonce,
    gas,
    gasPrice: gasPrice ?? 1n,
    to: merged.to as Hex,
    value,
    data: ((merged.data as string) ?? '0x') as Hex,
  };
}

export async function signAndSendWithHardware(params: {
  account: WalletAccount;
  chainId: number;
  tx: TransactionSerializable & { to: Hex };
}): Promise<Hex> {
  if (params.account.kind !== 'ledger' && params.account.kind !== 'trezor') {
    throw new Error('Not a hardware account.');
  }
  const path = params.account.derivationPath || DEFAULT_ETH_DERIVATION_PATH;
  const tx = { ...params.tx, chainId: params.chainId };

  const signed =
    params.account.kind === 'ledger'
      ? await signTxWithLedger({ derivationPath: path, tx })
      : await signTxWithTrezor({
          derivationPath: path,
          tx: tx as TransactionSerializable & { to: Hex; chainId: number },
        });

  return chainJsonRpcCall<Hex>(params.chainId, 'eth_sendRawTransaction', [signed]);
}

export async function executeHardwareSignRequest(params: {
  account: WalletAccount;
  chainId: number;
  method: string;
  requestParams: unknown[];
  gasOverrides?: GasOverrideInput;
}): Promise<Hex> {
  const { account, chainId, method, requestParams, gasOverrides } = params;

  if (method === 'eth_sendTransaction') {
    const rawTx = (requestParams[0] ?? {}) as Record<string, unknown>;
    const tx = await buildHardwareTransaction(account, chainId, rawTx, gasOverrides);
    return signAndSendWithHardware({ account, chainId, tx });
  }

  if (method === 'eth_sign') {
    throw new Error('eth_sign is disabled. Use personal_sign or eth_signTypedData_v4.');
  }

  if (method === 'personal_sign') {
    const msgParam = requestParams[0];
    const addrParam = requestParams[1];
    assertSignerAddress(account, addrParam);
    return signPersonalMessageWithHardware(account, msgParam);
  }

  if (
    method === 'eth_signTypedData' ||
    method === 'eth_signTypedData_v3' ||
    method === 'eth_signTypedData_v4'
  ) {
    const addrParam = requestParams[0];
    assertSignerAddress(account, addrParam);
    const typedData = parseTypedDataFromParams(method, requestParams);
    return signEip712WithHardware(account, typedData);
  }

  throw new Error(`Unsupported hardware signing method: ${method}`);
}
