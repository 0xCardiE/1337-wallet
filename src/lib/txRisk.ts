import {
  decodeFunctionData,
  decodeFunctionResult,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  hexToString,
  isAddress,
  isHex,
  parseEther,
  trim,
  type Hex,
} from 'viem';
import { bytesToHexMessage, parseTypedDataParam } from './backgroundSign';
import { chainJsonRpcCall } from './ethereum';
import {
  DEFAULT_HIGH_VALUE_NATIVE,
  type InstantGateId,
} from './instantGates';
import { parseChainIdParam } from '../provider/types';
import type { ProviderRequest } from '../provider/types';
import { checkSiweAgainstOrigin, parseSiweMessage, type ParsedSiwe } from './siwe';

const MAX_UINT160 = (1n << 160n) - 1n;

const SELECTOR_APPROVE = '0x095ea7b3';
const SELECTOR_INCREASE_ALLOWANCE = '0x39509351';
const SELECTOR_SET_APPROVAL_FOR_ALL = '0xa22cb465';

/** Selectors Instant may auto-sign without the unknown-contract gate. */
const KNOWN_SAFE_SELECTORS = new Set([
  SELECTOR_APPROVE,
  SELECTOR_INCREASE_ALLOWANCE,
  SELECTOR_SET_APPROVAL_FOR_ALL,
  '0xa9059cbb', // transfer
  '0x23b872dd', // transferFrom
  '0x42842e0e', // safeTransferFrom(address,address,uint256)
  '0xb88d4fde', // safeTransferFrom(address,address,uint256,bytes)
]);

const PERMIT_PRIMARY_TYPES = new Set([
  'Permit',
  'PermitSingle',
  'PermitBatch',
  'PermitTransferFrom',
  'PermitBatchTransferFrom',
  'PermitWitnessTransferFrom',
  'PermitBatchWitnessTransferFrom',
]);

const ERC20_APPROVE_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'addedValue', type: 'uint256' },
    ],
    name: 'increaseAllowance',
    type: 'function',
  },
  {
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    name: 'setApprovalForAll',
    type: 'function',
  },
] as const;

const ERC20_META_ABI = [
  { inputs: [], name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'name', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
] as const;

export type TokenApprovalAction = {
  kind: 'erc20Approve' | 'increaseAllowance' | 'setApprovalForAll';
  token: `0x${string}`;
  spender: `0x${string}`;
  amount?: bigint;
  unlimited: boolean;
  approved?: boolean;
};

export type PermitAction = {
  primaryType: string;
  spender?: `0x${string}`;
  token?: `0x${string}`;
  amount?: bigint;
  unlimited: boolean;
};

export type SiweRisk = ParsedSiwe & {
  domainMismatch: boolean;
  uriMismatch: boolean;
  chainMismatch: boolean;
};

export type Eip712ChainRisk = {
  domainChainId: number;
  walletChainId: number;
  mismatch: boolean;
};

export type TxRiskReport = {
  hits: InstantGateId[];
  tokenApproval?: TokenApprovalAction;
  permit?: PermitAction;
  siwe?: SiweRisk;
  eip712Chain?: Eip712ChainRisk;
  highValueWei?: bigint;
  unknownSelector?: string;
};

export function isUnlimitedAmount(amount: bigint): boolean {
  return amount >= (1n << 255n) || amount === MAX_UINT160;
}

export function selectorFromCalldata(data: unknown): string | undefined {
  if (typeof data !== 'string' || !isHex(data) || data.length < 10) return undefined;
  return data.slice(0, 10).toLowerCase();
}

function hexBigInt(v: unknown): bigint | undefined {
  if (v == null) return undefined;
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.floor(v));
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (!s) return undefined;
  try {
    return BigInt(s.startsWith('0x') || s.startsWith('0X') ? s : s);
  } catch {
    return undefined;
  }
}

function asAddress(v: unknown): `0x${string}` | undefined {
  if (typeof v !== 'string' || !isAddress(v)) return undefined;
  return getAddress(v);
}

export function parseDomainChainId(raw: unknown): number | null {
  return parseChainIdParam(raw);
}

function decodeTokenApproval(tx: Record<string, unknown>): TokenApprovalAction | undefined {
  const token = asAddress(tx.to);
  const data = typeof tx.data === 'string' ? tx.data : undefined;
  if (!token || !data) return undefined;
  const selector = selectorFromCalldata(data);
  if (!selector) return undefined;

  try {
    if (selector === SELECTOR_APPROVE) {
      const decoded = decodeFunctionData({ abi: ERC20_APPROVE_ABI, data: data as Hex });
      if (decoded.functionName !== 'approve' || !decoded.args) return undefined;
      const spender = decoded.args[0] as `0x${string}`;
      const amount = decoded.args[1] as bigint;
      return {
        kind: 'erc20Approve',
        token,
        spender: getAddress(spender),
        amount,
        unlimited: isUnlimitedAmount(amount),
      };
    }
    if (selector === SELECTOR_INCREASE_ALLOWANCE) {
      const decoded = decodeFunctionData({ abi: ERC20_APPROVE_ABI, data: data as Hex });
      if (decoded.functionName !== 'increaseAllowance' || !decoded.args) return undefined;
      const spender = decoded.args[0] as `0x${string}`;
      const added = decoded.args[1] as bigint;
      return {
        kind: 'increaseAllowance',
        token,
        spender: getAddress(spender),
        amount: added,
        unlimited: isUnlimitedAmount(added),
      };
    }
    if (selector === SELECTOR_SET_APPROVAL_FOR_ALL) {
      const decoded = decodeFunctionData({ abi: ERC20_APPROVE_ABI, data: data as Hex });
      if (decoded.functionName !== 'setApprovalForAll' || !decoded.args) return undefined;
      const operator = decoded.args[0] as `0x${string}`;
      const approved = decoded.args[1] as boolean;
      return {
        kind: 'setApprovalForAll',
        token,
        spender: getAddress(operator),
        approved,
        unlimited: approved === true,
      };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function decodePermit(typed: {
  primaryType: string;
  domain: Record<string, unknown>;
  message: Record<string, unknown>;
}): PermitAction | undefined {
  if (!PERMIT_PRIMARY_TYPES.has(typed.primaryType)) return undefined;
  const msg = typed.message;
  const details =
    msg.details && typeof msg.details === 'object'
      ? (msg.details as Record<string, unknown>)
      : undefined;

  const spender = asAddress(msg.spender);
  const token = asAddress(details?.token ?? msg.token ?? typed.domain.verifyingContract);
  const amount = hexBigInt(details?.amount ?? msg.value ?? msg.amount ?? msg.allowed);

  return {
    primaryType: typed.primaryType,
    spender,
    token,
    amount,
    unlimited: amount != null ? isUnlimitedAmount(amount) : false,
  };
}

function messageToUtf8(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  if (!raw.startsWith('0x')) return raw;
  try {
    const decoded = bytesToHexMessage(raw);
    if (typeof decoded === 'string') return decoded;
    return new TextDecoder().decode(decoded);
  } catch {
    return raw;
  }
}

function typedPayload(method: string, params: unknown[]): unknown {
  let typedRaw = params[1] ?? params[0];
  if (method === 'eth_signTypedData_v3' || method === 'eth_signTypedData_v4') {
    typedRaw = params[1];
  }
  return typedRaw;
}

export function classifyRequest(
  request: ProviderRequest,
  opts: { chainId: number; origin?: string; highValueNative?: number },
): TxRiskReport {
  const hits = new Set<InstantGateId>();
  const report: TxRiskReport = { hits: [] };
  const { method, params = [] } = request;
  const highValueNative = opts.highValueNative ?? DEFAULT_HIGH_VALUE_NATIVE;

  if (method === 'eth_sendTransaction') {
    const tx = (params[0] ?? {}) as Record<string, unknown>;
    const value = hexBigInt(tx.value) ?? 0n;
    let threshold = 0n;
    try {
      threshold = parseEther(String(highValueNative));
    } catch {
      threshold = parseEther(String(DEFAULT_HIGH_VALUE_NATIVE));
    }
    if (value > 0n && value >= threshold) {
      report.highValueWei = value;
      hits.add('highValue');
    }

    const approval = decodeTokenApproval(tx);
    if (approval) {
      report.tokenApproval = approval;
      if (approval.unlimited) hits.add('unlimitedApproval');
    } else {
      const selector = selectorFromCalldata(tx.data);
      const creating = tx.to == null || tx.to === '';
      if (creating) {
        report.unknownSelector = 'contract-creation';
        hits.add('unknownContract');
      } else if (selector && !KNOWN_SAFE_SELECTORS.has(selector)) {
        report.unknownSelector = selector;
        hits.add('unknownContract');
      }
    }
  }

  if (method === 'personal_sign') {
    const text = messageToUtf8(params[0]);
    if (text) {
      const parsed = parseSiweMessage(text);
      if (parsed) {
        const check = checkSiweAgainstOrigin(parsed, opts.origin, opts.chainId);
        report.siwe = { ...parsed, ...check };
        if (check.domainMismatch || check.uriMismatch || check.chainMismatch) {
          hits.add('siweMismatch');
        }
      }
    }
  }

  if (
    method === 'eth_signTypedData' ||
    method === 'eth_signTypedData_v3' ||
    method === 'eth_signTypedData_v4'
  ) {
    try {
      const typed = parseTypedDataParam(typedPayload(method, params));
      const domainChainId = parseDomainChainId(typed.domain.chainId);
      if (domainChainId != null) {
        const mismatch = domainChainId !== opts.chainId;
        report.eip712Chain = {
          domainChainId,
          walletChainId: opts.chainId,
          mismatch,
        };
        if (mismatch) hits.add('eip712ChainMismatch');
      }
      const permit = decodePermit(typed);
      if (permit) {
        report.permit = permit;
        hits.add('permit');
        if (permit.unlimited) hits.add('unlimitedApproval');
      }
    } catch {
      /* invalid typed data is handled by the signer */
    }
  }

  report.hits = INSTANT_GATE_ORDER.filter(id => hits.has(id));
  return report;
}

const INSTANT_GATE_ORDER: InstantGateId[] = [
  'unlimitedApproval',
  'unknownContract',
  'highValue',
  'permit',
  'eip712ChainMismatch',
  'siweMismatch',
];

export function formatApprovalAmount(amount: bigint | undefined, decimals = 18): string {
  if (amount == null) return '—';
  if (isUnlimitedAmount(amount)) return 'Unlimited';
  try {
    return formatUnits(amount, decimals);
  } catch {
    return amount.toString();
  }
}

export function formatNativeValue(wei: bigint): string {
  try {
    return formatEther(wei);
  } catch {
    return wei.toString();
  }
}

export type TokenMeta = {
  symbol?: string;
  name?: string;
  decimals: number;
};

function decodeMetaString(data: Hex, fn: 'symbol' | 'name'): string | undefined {
  try {
    const value = decodeFunctionResult({
      abi: ERC20_META_ABI,
      functionName: fn,
      data,
    });
    if (typeof value === 'string' && value.trim()) return value.trim();
  } catch {
    /* bytes32 fallback */
  }
  try {
    if (data.length >= 66) {
      const s = hexToString(trim(data), { size: 32 }).replace(/\0/g, '').trim();
      if (s) return s;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

export async function fetchErc20Meta(
  chainId: number,
  token: `0x${string}`,
): Promise<TokenMeta> {
  const meta: TokenMeta = { decimals: 18 };
  try {
    const raw = await chainJsonRpcCall<string>(chainId, 'eth_call', [
      { to: token, data: encodeFunctionData({ abi: ERC20_META_ABI, functionName: 'symbol' }) },
      'latest',
    ]);
    const symbol = decodeMetaString(raw as Hex, 'symbol');
    if (symbol) meta.symbol = symbol;
  } catch {
    /* optional */
  }
  try {
    const raw = await chainJsonRpcCall<string>(chainId, 'eth_call', [
      { to: token, data: encodeFunctionData({ abi: ERC20_META_ABI, functionName: 'name' }) },
      'latest',
    ]);
    const name = decodeMetaString(raw as Hex, 'name');
    if (name) meta.name = name;
  } catch {
    /* optional */
  }
  try {
    const raw = await chainJsonRpcCall<string>(chainId, 'eth_call', [
      { to: token, data: encodeFunctionData({ abi: ERC20_META_ABI, functionName: 'decimals' }) },
      'latest',
    ]);
    const decimals = decodeFunctionResult({
      abi: ERC20_META_ABI,
      functionName: 'decimals',
      data: raw as Hex,
    });
    if (typeof decimals === 'bigint' && decimals >= 0n && decimals <= 36n) {
      meta.decimals = Number(decimals);
    } else if (typeof decimals === 'number' && Number.isFinite(decimals) && decimals >= 0 && decimals <= 36) {
      meta.decimals = decimals;
    }
  } catch {
    /* keep 18 */
  }
  return meta;
}
