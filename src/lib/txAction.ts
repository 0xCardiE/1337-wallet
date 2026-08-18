import { decodeFunctionData, getAddress, isAddress, type Hex } from 'viem';
import type { ProviderRequest } from '../provider/types';
import { chainById } from './chainCatalog';
import { CREATEX_ADDRESS, DISPERSE_CREATEX_CALLDATA } from './disperseCreate2';
import type { TxRiskReport } from './txRisk';
import { formatNativeValue, selectorFromCalldata } from './txRisk';

const SELECTOR_TRANSFER = '0xa9059cbb';
const SELECTOR_TRANSFER_FROM = '0x23b872dd';
const SELECTOR_SAFE_TRANSFER = '0x42842e0e';
const SELECTOR_SAFE_TRANSFER_DATA = '0xb88d4fde';
const SELECTOR_UNISWAP_EXECUTE = '0x3593564c';

const SELECTOR_DISPERSE_ETHER = '0xe63d38ed';
const SELECTOR_DISPERSE_TOKEN = '0xc73a2d60';
const SELECTOR_DISPERSE_SIMPLE = '0x51ba162c';

const TRANSFER_SELECTORS = new Set([
  SELECTOR_TRANSFER,
  SELECTOR_TRANSFER_FROM,
  SELECTOR_SAFE_TRANSFER,
  SELECTOR_SAFE_TRANSFER_DATA,
]);

const ERC20_TRANSFER_ABI = [
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    type: 'function',
  },
  {
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transferFrom',
    type: 'function',
  },
] as const;

function hexValue(v: unknown): bigint {
  if (v == null) return 0n;
  if (typeof v === 'bigint') return v;
  if (typeof v !== 'string' || !v.trim()) return 0n;
  try {
    return BigInt(v);
  } catch {
    return 0n;
  }
}

function asAddress(v: unknown): `0x${string}` | undefined {
  if (typeof v !== 'string' || !isAddress(v)) return undefined;
  try {
    return getAddress(v);
  } catch {
    return undefined;
  }
}

function functionBase(name: string | undefined): string | undefined {
  if (!name?.trim()) return undefined;
  return name.split('(')[0]?.trim() || undefined;
}

function looksLikeSwap(base: string | undefined, selector: string | undefined): boolean {
  if (selector === SELECTOR_UNISWAP_EXECUTE) return true;
  if (!base) return false;
  const n = base.toLowerCase();
  return n.startsWith('swap') || n.includes('exactinput') || n.includes('exactoutput');
}

export type SendAction = {
  kind: 'send';
  to: `0x${string}`;
  value: bigint;
  token?: `0x${string}`;
  tokenAmount?: bigint;
  recipient?: `0x${string}`;
};

export type SwapAction = {
  kind: 'swap';
  to: `0x${string}`;
  value: bigint;
  selector?: string;
  functionName?: string;
};

export type UnknownCallAction = {
  kind: 'unknown';
  to?: `0x${string}`;
  value: bigint;
  selector?: string;
  functionName?: string;
  creating: boolean;
};

export type TxAction = SendAction | SwapAction | UnknownCallAction;

function decodeTokenSend(tx: Record<string, unknown>): SendAction | undefined {
  const token = asAddress(tx.to);
  const data = typeof tx.data === 'string' ? tx.data : undefined;
  if (!token || !data) return undefined;
  const selector = selectorFromCalldata(data);
  if (!selector || !TRANSFER_SELECTORS.has(selector)) return undefined;
  try {
    if (selector === SELECTOR_TRANSFER) {
      const decoded = decodeFunctionData({ abi: ERC20_TRANSFER_ABI, data: data as Hex });
      if (decoded.functionName !== 'transfer' || !decoded.args) return undefined;
      return {
        kind: 'send',
        to: token,
        value: hexValue(tx.value),
        token,
        tokenAmount: decoded.args[1] as bigint,
        recipient: getAddress(decoded.args[0] as `0x${string}`),
      };
    }
    const decoded = decodeFunctionData({ abi: ERC20_TRANSFER_ABI, data: data as Hex });
    if (decoded.functionName !== 'transferFrom' || !decoded.args) return undefined;
    return {
      kind: 'send',
      to: token,
      value: hexValue(tx.value),
      token,
      tokenAmount: decoded.args[2] as bigint,
      recipient: getAddress(decoded.args[1] as `0x${string}`),
    };
  } catch {
    return {
      kind: 'send',
      to: token,
      value: hexValue(tx.value),
      token,
    };
  }
}

/** Structured send / swap / unknown for the confirm sheet. Approval/permit/SIWE stay on TxRiskReport. */
export function classifyTxAction(
  request: ProviderRequest,
  risk: TxRiskReport,
  functionSignature?: string,
): TxAction | undefined {
  if (request.method !== 'eth_sendTransaction') return undefined;
  if (risk.tokenApproval) return undefined;

  const tx = (request.params?.[0] ?? {}) as Record<string, unknown>;
  const to = asAddress(tx.to);
  const value = hexValue(tx.value);
  const data = typeof tx.data === 'string' ? tx.data : '';
  const hasCalldata = data.length > 2 && data !== '0x';
  const selector = selectorFromCalldata(data);
  const base = functionBase(functionSignature);
  const creating = tx.to == null || tx.to === '';

  if (!hasCalldata && to) {
    return { kind: 'send', to, value };
  }

  if (
    to &&
    getAddress(to) === getAddress(CREATEX_ADDRESS) &&
    data.toLowerCase() === DISPERSE_CREATEX_CALLDATA.toLowerCase()
  ) {
    return undefined;
  }

  if (
    selector === SELECTOR_DISPERSE_ETHER ||
    selector === SELECTOR_DISPERSE_TOKEN ||
    selector === SELECTOR_DISPERSE_SIMPLE
  ) {
    return undefined;
  }

  const tokenSend = decodeTokenSend(tx);
  if (tokenSend) return tokenSend;

  if (to && looksLikeSwap(base, selector)) {
    return { kind: 'swap', to, value, selector, functionName: base };
  }

  return {
    kind: 'unknown',
    to,
    value,
    selector,
    functionName: base,
    creating,
  };
}

export function formatActionNative(value: bigint, chainId: number): string {
  const symbol = chainById(chainId)?.nativeCurrency.symbol ?? 'ETH';
  if (value <= 0n) return `0 ${symbol}`;
  return `${formatNativeValue(value)} ${symbol}`;
}

/** Path + query for the confirm sheet (no hash — SPAs stuff state there). */
export function pagePathAndQuery(pageUrl?: string): string | undefined {
  if (!pageUrl) return undefined;
  try {
    const u = new URL(pageUrl);
    const path = `${u.pathname}${u.search}`;
    if (!path || path === '/') return undefined;
    return path;
  } catch {
    return undefined;
  }
}
