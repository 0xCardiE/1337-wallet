import { formatEther } from 'viem';
import type { ProviderRequest, ProviderResponse } from '../provider/types';
import { providerError } from '../provider/types';
import { bytesToHexMessage, parseTypedDataParam } from './backgroundSign';

/** Origin stamped on in-wallet hardware sends so the confirm sheet is not a dapp. */
export const INTERNAL_WALLET_ORIGIN = '1337://wallet';

export function isInternalWalletOrigin(origin?: string): boolean {
  return origin === INTERNAL_WALLET_ORIGIN;
}

const SIGN_METHODS = new Set([
  'eth_sendTransaction',
  'personal_sign',
  'eth_sign',
  'eth_signTypedData',
  'eth_signTypedData_v3',
  'eth_signTypedData_v4',
]);

export function isSignMethod(method: string): boolean {
  return SIGN_METHODS.has(method);
}

export type ApprovalSummary = {
  kind: 'transaction' | 'message' | 'typedData';
  method: string;
  origin?: string;
  hostname?: string;
  title: string;
  fields: { label: string; value: string }[];
};

type PendingEntry = {
  id: string;
  request: ProviderRequest;
  origin?: string;
  tabId?: number;
  chainId: number;
  summary: ApprovalSummary;
  createdAt: number;
  resolve: (res: ProviderResponse) => void;
};

const pending = new Map<string, PendingEntry>();

function hostnameFromOrigin(origin?: string): string | undefined {
  if (!origin) return undefined;
  if (isInternalWalletOrigin(origin)) return '1337';
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
}

function truncate(value: string, max = 120): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function formatMessagePreview(raw: unknown): string {
  if (typeof raw === 'string') {
    if (raw.startsWith('0x') && raw.length > 2) {
      try {
        const decoded = bytesToHexMessage(raw);
        if (typeof decoded === 'string') return truncate(decoded);
        return truncate(
          new TextDecoder().decode(decoded as Uint8Array),
          200,
        );
      } catch {
        return truncate(raw);
      }
    }
    return truncate(raw);
  }
  return truncate(JSON.stringify(raw));
}

export function buildApprovalSummary(
  request: ProviderRequest,
  origin?: string,
): ApprovalSummary {
  const { method, params = [] } = request;
  const hostname = hostnameFromOrigin(origin);

  if (method === 'eth_sendTransaction') {
    const tx = (params[0] ?? {}) as Record<string, unknown>;
    const to = typeof tx.to === 'string' ? tx.to : '—';
    const valueRaw = typeof tx.value === 'string' ? tx.value : undefined;
    let valueLabel = '0 ETH';
    if (valueRaw && valueRaw !== '0x0' && valueRaw !== '0x') {
      try {
        valueLabel = `${formatEther(BigInt(valueRaw))} ETH`;
      } catch {
        valueLabel = valueRaw;
      }
    }
    const data =
      typeof tx.data === 'string' && tx.data.length > 2
        ? truncate(tx.data, 80)
        : undefined;
    const fields = [
      { label: 'To', value: to },
      { label: 'Amount', value: valueLabel },
    ];
    if (data) fields.push({ label: 'Data', value: data });
    return {
      kind: 'transaction',
      method,
      origin,
      hostname,
      title: 'Confirm transaction',
      fields,
    };
  }

  if (method === 'personal_sign' || method === 'eth_sign') {
    const msgParam = method === 'personal_sign' ? params[0] : params[1];
    return {
      kind: 'message',
      method,
      origin,
      hostname,
      title: 'Sign message',
      fields: [{ label: 'Message', value: formatMessagePreview(msgParam) }],
    };
  }

  let typedRaw = params[1] ?? params[0];
  if (method === 'eth_signTypedData_v3' || method === 'eth_signTypedData_v4') {
    typedRaw = params[1];
  }
  try {
    const typed = parseTypedDataParam(typedRaw);
    const domainName =
      typeof typed.domain.name === 'string' ? typed.domain.name : undefined;
    return {
      kind: 'typedData',
      method,
      origin,
      hostname,
      title: 'Sign typed data',
      fields: [
        { label: 'Primary type', value: typed.primaryType },
        ...(domainName ? [{ label: 'Domain', value: domainName }] : []),
      ],
    };
  } catch {
    return {
      kind: 'typedData',
      method,
      origin,
      hostname,
      title: 'Sign typed data',
      fields: [{ label: 'Payload', value: truncate(String(typedRaw)) }],
    };
  }
}

export type PendingApproval = {
  id: string;
  request: ProviderRequest;
  origin?: string;
  tabId?: number;
  chainId: number;
  summary: ApprovalSummary;
  createdAt: number;
};

export function queueApprovalRequest(opts: {
  request: ProviderRequest;
  origin?: string;
  tabId?: number;
  chainId: number;
  onQueued?: () => void;
}): Promise<ProviderResponse> {
  const { request, origin, tabId, chainId, onQueued } = opts;
  const id = request.id;
  return new Promise(resolve => {
    const summary = buildApprovalSummary(request, origin);
    pending.set(id, {
      id,
      request,
      origin,
      tabId,
      chainId,
      summary,
      createdAt: Date.now(),
      resolve,
    });
    onQueued?.();
  });
}

export function listPendingApprovals(): PendingApproval[] {
  return Array.from(pending.values())
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(({ resolve: _, ...rest }) => rest);
}

export function takePendingApproval(id: string): PendingEntry | undefined {
  const entry = pending.get(id);
  if (entry) pending.delete(id);
  return entry;
}

export function rejectPendingApproval(
  id: string,
  message = 'User rejected the request',
): boolean {
  const entry = pending.get(id);
  if (!entry) return false;
  pending.delete(id);
  entry.resolve({
    id,
    ok: false,
    error: providerError(4001, message),
  });
  return true;
}

export function resolvePendingApproval(
  id: string,
  response: ProviderResponse,
): boolean {
  const entry = pending.get(id);
  if (!entry) return false;
  pending.delete(id);
  entry.resolve(response);
  return true;
}
