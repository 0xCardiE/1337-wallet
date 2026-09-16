import { formatEther } from 'viem';
import type { ProviderRequest, ProviderResponse } from '../provider/types';
import { providerError } from '../provider/types';
import { bytesToHexMessage, parseTypedDataParam } from './backgroundSign';
import { parseWatchAssetParams } from './watchAsset';

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

/** Keep background approvals aligned with the inpage provider timeout. */
export const PENDING_APPROVAL_TTL_MS = 2 * 60 * 1000;

export function isSignMethod(method: string): boolean {
  return SIGN_METHODS.has(method);
}

export type ApprovalSummary = {
  kind: 'transaction' | 'message' | 'typedData' | 'watchAsset';
  method: string;
  origin?: string;
  hostname?: string;
  pageUrl?: string;
  title: string;
  fields: { label: string; value: string }[];
};

type PendingEntry = {
  id: string;
  request: ProviderRequest;
  origin?: string;
  pageUrl?: string;
  tabId?: number;
  chainId: number;
  summary: ApprovalSummary;
  createdAt: number;
  resolve: (res: ProviderResponse) => void;
  timeoutId?: ReturnType<typeof setTimeout>;
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
  pageUrl?: string,
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
      pageUrl,
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
      pageUrl,
      title: 'Sign message',
      fields: [{ label: 'Message', value: formatMessagePreview(msgParam) }],
    };
  }

  if (method === 'wallet_watchAsset') {
    try {
      const parsed = parseWatchAssetParams(params);
      const fields = [
        { label: 'Token', value: parsed.address },
        ...(parsed.symbol ? [{ label: 'Symbol', value: parsed.symbol }] : []),
        ...(parsed.decimals != null
          ? [{ label: 'Decimals', value: String(parsed.decimals) }]
          : []),
      ];
      return {
        kind: 'watchAsset',
        method,
        origin,
        hostname,
        pageUrl,
        title: 'Add token',
        fields,
      };
    } catch {
      return {
        kind: 'watchAsset',
        method,
        origin,
        hostname,
        pageUrl,
        title: 'Add token',
        fields: [{ label: 'Request', value: truncate(JSON.stringify(params)) }],
      };
    }
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
      pageUrl,
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
      pageUrl,
      title: 'Sign typed data',
      fields: [{ label: 'Payload', value: truncate(String(typedRaw)) }],
    };
  }
}

export type PendingApproval = {
  id: string;
  request: ProviderRequest;
  origin?: string;
  pageUrl?: string;
  tabId?: number;
  chainId: number;
  summary: ApprovalSummary;
  createdAt: number;
};

export function queueApprovalRequest(opts: {
  request: ProviderRequest;
  origin?: string;
  pageUrl?: string;
  tabId?: number;
  chainId: number;
  onQueued?: () => void;
  onExpired?: () => void;
  /** Internal hardware flows may opt into a longer timeout. */
  ttlMs?: number;
}): Promise<ProviderResponse> {
  const { request, origin, pageUrl, tabId, chainId, onQueued, onExpired } = opts;
  const id = request.id;
  rejectPendingApproval(id, 'Request superseded by a newer request');

  return new Promise(resolve => {
    const summary = buildApprovalSummary(request, origin, pageUrl);
    const entry: PendingEntry = {
      id,
      request,
      origin,
      pageUrl,
      tabId,
      chainId,
      summary,
      createdAt: Date.now(),
      resolve,
    };
    pending.set(id, entry);

    const ttlMs =
      typeof opts.ttlMs === 'number' && Number.isFinite(opts.ttlMs) && opts.ttlMs > 0
        ? opts.ttlMs
        : PENDING_APPROVAL_TTL_MS;
    entry.timeoutId = setTimeout(() => {
      if (rejectPendingApproval(id, 'Request expired')) onExpired?.();
    }, ttlMs);

    onQueued?.();
  });
}

export function listPendingApprovals(): PendingApproval[] {
  return Array.from(pending.values())
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(({ resolve: _, timeoutId: __, ...rest }) => rest);
}

export function takePendingApproval(id: string): PendingEntry | undefined {
  const entry = pending.get(id);
  if (entry) {
    pending.delete(id);
    if (entry.timeoutId) clearTimeout(entry.timeoutId);
  }
  return entry;
}

export function rejectPendingApproval(
  id: string,
  message = 'User rejected the request',
): boolean {
  const entry = takePendingApproval(id);
  if (!entry) return false;
  entry.resolve({
    id,
    ok: false,
    error: providerError(4001, message),
  });
  return true;
}

export function rejectAllPendingApprovals(
  message = 'Pending request cancelled',
): number {
  let rejected = 0;
  for (const id of [...pending.keys()]) {
    if (rejectPendingApproval(id, message)) rejected += 1;
  }
  return rejected;
}

export function resolvePendingApproval(
  id: string,
  response: ProviderResponse,
): boolean {
  const entry = takePendingApproval(id);
  if (!entry) return false;
  entry.resolve(response);
  return true;
}
