import { formatEther, getAddress, isAddress } from 'viem';
import { chainById } from './chainCatalog';
import type { TxHistoryRow } from './explorerTxHistory';
import type { ProviderRequest } from '../provider/types';
import {
  formatApprovalAmount,
  type TokenMeta,
  type TxRiskReport,
} from './txRisk';
import { CREATEX_ADDRESS, DISPERSE_CREATEX_CALLDATA } from './disperseCreate2';

function shortAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function functionBase(name: string | undefined): string | undefined {
  if (!name?.trim()) return undefined;
  return name.split('(')[0]?.trim() || undefined;
}

function hexValue(v: unknown): bigint | undefined {
  if (v == null) return undefined;
  if (typeof v === 'bigint') return v;
  if (typeof v !== 'string' || !v.trim()) return undefined;
  try {
    return BigInt(v);
  } catch {
    return undefined;
  }
}

const SELECTOR_LABELS: Record<string, string> = {
  '0xa9059cbb': 'transfer',
  '0x095ea7b3': 'approve',
  '0x39509351': 'increaseAllowance',
  '0xa22cb465': 'setApprovalForAll',
  '0x23b872dd': 'transferFrom',
  '0x42842e0e': 'safeTransferFrom',
  '0xb88d4fde': 'safeTransferFrom',
  '0x5ae401dc': 'multicall',
  '0xac9650d8': 'multicall',
  '0x3593564c': 'execute',
  '0xe63d38ed': 'disperseEther',
  '0xc73a2d60': 'disperseToken',
  '0x51ba162c': 'disperseTokenSimple',
  '0x26307668': 'deployCreate2',
};

function friendlyVerb(base: string): string | undefined {
  const n = base.toLowerCase();
  if (n === 'approve' || n === 'increaseallowance') return 'Approved token spending';
  if (n === 'setapprovalforall') return 'Approved an NFT operator';
  if (n === 'transfer' || n === 'safetransferfrom') return 'Sent tokens';
  if (n === 'transferfrom') return 'Moved tokens';
  if (n.startsWith('swap') || n.includes('exactinput') || n.includes('exactoutput')) {
    return 'Swapped tokens';
  }
  if (n === 'multicall' || n === 'aggregate3' || n === 'execute') {
    return 'Batched contract calls';
  }
  if (n === 'deposit' || n === 'depositeth') return 'Deposited';
  if (n === 'withdraw' || n === 'withdraweth') return 'Withdrew';
  if (n === 'bridge' || n.startsWith('startbridge') || n.includes('bridge')) return 'Bridged';
  if (n === 'claim' || n.startsWith('claim')) return 'Claimed';
  if (n === 'disperseether' || n === 'dispersetoken' || n === 'dispersetokensimple') {
    return 'Sent a Disperse batch';
  }
  if (n === 'deploycreate2') return 'Deploy a contract via CreateX';
  return undefined;
}

export type HumanLine = {
  headline: string;
  detail?: string;
};

export function humanizePendingRequest(args: {
  request: ProviderRequest;
  risk: TxRiskReport;
  chainId: number;
  tokenMeta?: TokenMeta | null;
  functionSignature?: string;
}): HumanLine {
  const { request, risk, chainId, tokenMeta, functionSignature } = args;
  const symbol = chainById(chainId)?.nativeCurrency.symbol ?? 'ETH';
  const tokenLabel = tokenMeta?.symbol || tokenMeta?.name || 'token';

  if (risk.siwe) {
    const bad =
      risk.siwe.domainMismatch || risk.siwe.uriMismatch || risk.siwe.chainMismatch;
    return {
      headline: bad
        ? `Sign-in claim does not match this page (${risk.siwe.domain})`
        : `Sign in to ${risk.siwe.domain}`,
      detail: risk.siwe.uri,
    };
  }

  if (risk.permit) {
    const spender = risk.permit.spender ? shortAddress(risk.permit.spender) : 'a spender';
    const amount =
      risk.permit.amount != null
        ? formatApprovalAmount(risk.permit.amount, tokenMeta?.decimals ?? 18)
        : undefined;
    return {
      headline: risk.permit.unlimited
        ? `Sign a gasless permit for unlimited ${tokenLabel}`
        : `Sign a ${risk.permit.primaryType} permit for ${tokenLabel}`,
      detail: amount ? `${spender} · ${amount}` : spender,
    };
  }

  if (risk.tokenApproval) {
    const a = risk.tokenApproval;
    const who = shortAddress(a.spender);
    if (a.kind === 'setApprovalForAll') {
      return {
        headline: a.approved
          ? `Allow ${who} to transfer every NFT in this collection`
          : `Revoke ${who} as an operator for this collection`,
        detail: shortAddress(a.token),
      };
    }
    const amount =
      a.amount != null ? formatApprovalAmount(a.amount, tokenMeta?.decimals ?? 18) : '';
    return {
      headline: a.unlimited
        ? `Allow ${who} to spend unlimited ${tokenLabel}`
        : `Allow ${who} to spend ${amount} ${tokenLabel}`,
    };
  }

  if (request.method === 'personal_sign') {
    return { headline: 'Sign a message from this site' };
  }

  if (request.method !== 'eth_sendTransaction') {
    return { headline: 'Sign typed data from this site' };
  }

  const tx = (request.params?.[0] ?? {}) as Record<string, unknown>;
  const to = typeof tx.to === 'string' && isAddress(tx.to) ? getAddress(tx.to) : undefined;
  const value = hexValue(tx.value) ?? 0n;
  const data = typeof tx.data === 'string' ? tx.data : '';
  const hasCalldata = data.length > 2 && data !== '0x';
  const base = functionBase(functionSignature) ?? SELECTOR_LABELS[data.slice(0, 10).toLowerCase()];

  if (!hasCalldata && to) {
    return {
      headline:
        value > 0n
          ? `Send ${formatEther(value)} ${symbol} to ${shortAddress(to)}`
          : `Send a zero-value transaction to ${shortAddress(to)}`,
    };
  }

  if (!to) {
    return {
      headline:
        value > 0n
          ? `Deploy a contract and send ${formatEther(value)} ${symbol}`
          : 'Deploy a contract',
    };
  }

  if (
    getAddress(to) === getAddress(CREATEX_ADDRESS) &&
    data.toLowerCase() === DISPERSE_CREATEX_CALLDATA.toLowerCase()
  ) {
    return {
      headline: 'Deploy Disperse.app on this chain',
      detail: 'CreateX CREATE2 · later users share this address',
    };
  }

  if (base) {
    const friendly = friendlyVerb(base);
    const valueBit =
      value > 0n ? ` and send ${formatEther(value)} ${symbol}` : '';
    return {
      headline: friendly
        ? `${friendly}${valueBit}`
        : `Call ${base} on ${shortAddress(to)}${valueBit}`,
      detail: friendly ? `${base} · ${shortAddress(to)}` : undefined,
    };
  }

  return {
    headline:
      value > 0n
        ? `Call a contract on ${shortAddress(to)} and send ${formatEther(value)} ${symbol}`
        : `Call a contract on ${shortAddress(to)}`,
    detail: data.length >= 10 ? `Selector ${data.slice(0, 10)}` : undefined,
  };
}

export function humanizeHistoryRow(
  row: TxHistoryRow,
  chainId: number,
): { title: string; subtitle: string } {
  const symbol = chainById(chainId)?.nativeCurrency.symbol ?? 'ETH';
  const base = functionBase(row.functionName);
  const selector = row.methodId?.toLowerCase();
  const inferred = base ?? (selector ? SELECTOR_LABELS[selector] : undefined);
  const friendly = inferred ? friendlyVerb(inferred) : undefined;
  const failed = !row.success;

  const peer =
    row.direction === 'in'
      ? row.from
        ? `From ${shortAddress(row.from)}`
        : 'Incoming'
      : row.to
        ? `To ${shortAddress(row.to)}`
        : 'Outgoing';

  if (row.direction === 'self' && row.value > 0n) {
    return {
      title: failed ? `Failed self-transfer` : `Sent ${symbol} to yourself`,
      subtitle: shortAddress(row.to ?? row.from),
    };
  }

  if (row.value > 0n && !inferred) {
    if (row.direction === 'in') {
      return {
        title: failed ? `Failed receive` : `Received ${symbol}`,
        subtitle: peer,
      };
    }
    return {
      title: failed ? `Failed send` : `Sent ${symbol}`,
      subtitle: peer,
    };
  }

  if (friendly) {
    return {
      title: failed ? `Failed · ${friendly}` : friendly,
      subtitle: inferred && inferred !== friendly ? `${inferred} · ${peer}` : peer,
    };
  }

  if (inferred) {
    return {
      title: failed ? `Failed · ${inferred}` : inferred,
      subtitle: peer,
    };
  }

  if (row.to && row.value === 0n) {
    return {
      title: failed ? 'Failed contract call' : 'Contract interaction',
      subtitle: peer,
    };
  }

  return {
    title: failed
      ? `Failed ${row.direction === 'in' ? 'receive' : 'send'}`
      : row.direction === 'in'
        ? `Received ${symbol}`
        : `Sent ${symbol}`,
    subtitle: peer,
  };
}
