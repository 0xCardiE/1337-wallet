import { chainById } from './chainCatalog';
import { summarizeApiError } from './errors';

export type DevErrorSection = {
  label: string;
  lines: string[];
  mono?: boolean;
};

export type FormattedDevError = {
  summary: string;
  sections: DevErrorSection[];
  detail: string;
};

const EIP1193_LABELS: Record<number, string> = {
  4000: 'Invalid request',
  4001: 'User rejected',
  4100: 'Unauthorized',
  4200: 'Unsupported method',
  4900: 'Disconnected',
  4902: 'Unrecognized chain',
  4901: 'Chain disconnected',
};

const SIMULATION_METHODS = new Set([
  'eth_call',
  'eth_estimateGas',
  'wallet_simulateV1',
  'wallet_simulate',
  'eth_simulateV1',
]);

function safeJson(value: unknown, space = 2): string {
  try {
    return JSON.stringify(
      value,
      (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
      space,
    );
  } catch {
    return String(value);
  }
}

function truncate(value: string, max = 160): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}… (${value.length} chars)`;
}

function hostnameFromOrigin(origin?: string): string | undefined {
  if (!origin) return undefined;
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
}

function hexWeiLabel(hex: unknown): string | undefined {
  if (typeof hex !== 'string' || !hex.startsWith('0x')) return undefined;
  try {
    const wei = BigInt(hex);
    const eth = Number(wei) / 1e18;
    if (eth > 0 && eth < 0.0001) return `${eth.toExponential(3)} ETH (${hex})`;
    return `${eth.toFixed(6).replace(/\.?0+$/, '')} ETH (${hex})`;
  } catch {
    return hex;
  }
}

function formatCallObject(obj: Record<string, unknown>): string[] {
  const lines: string[] = [];
  if (obj.from) lines.push(`from · ${String(obj.from)}`);
  if (obj.to) lines.push(`to · ${String(obj.to)}`);
  if (obj.value) {
    const v = hexWeiLabel(obj.value) ?? String(obj.value);
    lines.push(`value · ${v}`);
  }
  const gas = obj.gas ?? obj.gasLimit;
  if (gas) lines.push(`gas · ${String(gas)}`);
  if (obj.maxFeePerGas) lines.push(`maxFeePerGas · ${String(obj.maxFeePerGas)}`);
  if (obj.maxPriorityFeePerGas) {
    lines.push(`maxPriorityFeePerGas · ${String(obj.maxPriorityFeePerGas)}`);
  }
  if (obj.gasPrice) lines.push(`gasPrice · ${String(obj.gasPrice)}`);
  if (obj.data && typeof obj.data === 'string' && obj.data.length > 2) {
    lines.push(`data · ${truncate(obj.data, 120)}`);
    if (obj.data.length >= 10) {
      lines.push(`selector · ${obj.data.slice(0, 10)}`);
    }
  }
  if (obj.input && typeof obj.input === 'string' && obj.input.length > 2) {
    lines.push(`input · ${truncate(obj.input, 120)}`);
  }
  return lines;
}

function jsonSection(label: string, value: unknown): DevErrorSection {
  return {
    label,
    lines: safeJson(value, 2).split('\n'),
    mono: true,
  };
}

function formatWalletParams(method: string, params: unknown[]): DevErrorSection | null {
  const txLike = params.filter(
    p => p && typeof p === 'object' && ('data' in p || 'to' in p || 'from' in p),
  );
  if (txLike.length === params.length && txLike.length > 0) {
    const lines: string[] = [];
    txLike.forEach((p, i) => {
      if (txLike.length > 1) lines.push(`— tx ${i + 1} —`);
      lines.push(...formatCallObject(p as Record<string, unknown>));
    });
    return {
      label: method.startsWith('wallet_send') ? 'Batch transaction' : 'Wallet request',
      lines,
      mono: true,
    };
  }

  const head = params[0];
  if (!head || typeof head !== 'object') return jsonSection('RPC params', params);

  const obj = head as Record<string, unknown>;
  const lines: string[] = [];

  if (obj.from) lines.push(`from · ${String(obj.from)}`);
  if (obj.chainId) lines.push(`chainId · ${String(obj.chainId)}`);
  if (obj.version) lines.push(`version · ${String(obj.version)}`);

  const calls = obj.calls;
  if (Array.isArray(calls)) {
    calls.forEach((call, i) => {
      if (!call || typeof call !== 'object') return;
      const c = call as Record<string, unknown>;
      lines.push(`— call ${i + 1} —`);
      lines.push(...formatCallObject(c));
    });
  }

  const capabilities = obj.capabilities;
  if (capabilities && typeof capabilities === 'object') {
    lines.push('capabilities ·');
    lines.push(...safeJson(capabilities, 2).split('\n'));
  }

  if (lines.length) {
    return {
      label: method.startsWith('wallet_send') ? 'Batch transaction' : 'Wallet request',
      lines,
      mono: true,
    };
  }

  return jsonSection('RPC params', params);
}

function formatRpcParams(method: string, params: unknown[] | undefined): DevErrorSection | null {
  if (!params?.length) return null;

  if (
    method === 'eth_sendTransaction' ||
    method === 'eth_estimateGas' ||
    method === 'eth_call'
  ) {
    const head = params[0];
    if (head && typeof head === 'object') {
      const lines = formatCallObject(head as Record<string, unknown>);
      if (lines.length) {
        return {
          label: method === 'eth_estimateGas' ? 'Simulated transaction' : 'Call / transaction',
          lines,
          mono: true,
        };
      }
    }
  }

  if (method.startsWith('wallet_')) {
    return formatWalletParams(method, params);
  }

  if (method.startsWith('eth_get')) {
    return jsonSection('RPC params', params);
  }

  return jsonSection('RPC params', params);
}

export function providerErrorTitle(method: string, code?: number): string {
  if (SIMULATION_METHODS.has(method)) {
    if (method === 'eth_estimateGas') return 'Gas estimation failed';
    if (method === 'eth_call') return 'Contract simulation failed';
    return `Simulation failed (${method})`;
  }
  if (method.startsWith('wallet_send')) return `Batch send not supported (${method})`;
  if (method.startsWith('wallet_')) return `Wallet method not supported (${method})`;
  if (method === 'eth_sendTransaction') return 'Transaction request failed';
  if (code === 4200) return `Unsupported RPC method (${method})`;
  return `Dapp RPC failed (${method})`;
}

export function isUserRejectedProviderError(code: number, message: string): boolean {
  if (code === 4001) return true;
  return /user rejected|rejected on the device|denied on the device|cancelled by user|canceled by user|0x6985/i.test(
    message,
  );
}

export function isDisabledEthSign(method: string, code: number, message: string): boolean {
  return method === 'eth_sign' && (code === 4200 || /eth_sign is disabled/i.test(message));
}

/** Unexpected dapp RPC failures only. Rejects, device cancels, and disabled eth_sign are normal. */
export function shouldReportProviderError(
  code: number,
  message: string,
  method?: string,
): boolean {
  if (isUserRejectedProviderError(code, message)) return false;
  if (method && isDisabledEthSign(method, code, message)) return false;
  return true;
}

export type WalletNoticeKind = 'ok' | 'info' | 'warn';

export type WalletNoticePayload = {
  kind: WalletNoticeKind;
  title: string;
  message: string;
};

export function userNoticeForProviderFailure(
  method: string,
  code: number,
  message: string,
): WalletNoticePayload | null {
  if (isDisabledEthSign(method, code, message)) {
    return {
      kind: 'warn',
      title: 'This sign method is off',
      message: 'eth_sign is disabled. Use personal_sign or typed data.',
    };
  }
  if (isUserRejectedProviderError(code, message)) {
    return {
      kind: 'info',
      title: 'Rejected',
      message: message || 'Request rejected.',
    };
  }
  return null;
}

export function userNoticeForSignSuccess(method: string): WalletNoticePayload | null {
  if (method === 'personal_sign') {
    return {
      kind: 'ok',
      title: 'Signed',
      message: 'Message signed. The site has the signature.',
    };
  }
  if (
    method === 'eth_signTypedData' ||
    method === 'eth_signTypedData_v3' ||
    method === 'eth_signTypedData_v4'
  ) {
    return {
      kind: 'ok',
      title: 'Signed',
      message: 'Typed data signed. The site has the signature.',
    };
  }
  return null;
}

export function formatProviderRpcError(opts: {
  method: string;
  code?: number;
  message: string;
  origin?: string;
  chainId?: number;
  params?: unknown[];
  rpcData?: unknown;
}): FormattedDevError {
  const { method, code, message, origin, chainId, params, rpcData } = opts;
  const summary = message;
  const sections: DevErrorSection[] = [];

  const site = hostnameFromOrigin(origin);
  const chain = chainId != null ? chainById(chainId) : undefined;
  const metaLines: string[] = [];
  if (site) metaLines.push(`site · ${site}`);
  if (origin && origin !== site) metaLines.push(`origin · ${origin}`);
  if (chainId != null) {
    metaLines.push(
      `chain · ${chain?.name ?? 'Unknown'} (${chainId})`,
    );
  }
  metaLines.push(`method · ${method}`);
  if (code != null) {
    const label = EIP1193_LABELS[code];
    metaLines.push(label ? `code · ${code} (${label})` : `code · ${code}`);
  }
  if (metaLines.length) {
    sections.push({ label: 'Request', lines: metaLines });
  }

  const paramSection = formatRpcParams(method, params);
  if (paramSection) sections.push(paramSection);

  sections.push({ label: 'Error', lines: [message] });

  if (rpcData !== undefined) {
    sections.push(jsonSection('RPC data', rpcData));
  }

  const detail = sections
    .map(s => `${s.label}\n${s.lines.join('\n')}`)
    .join('\n\n');

  return { summary, sections, detail };
}

function errRecord(err: unknown): Record<string, unknown> | null {
  if (!err || typeof err !== 'object') return null;
  return err as Record<string, unknown>;
}

function walkErrorChain(err: unknown): unknown[] {
  const out: unknown[] = [];
  const seen = new Set<unknown>();
  let cur: unknown = err;
  while (cur != null && !seen.has(cur)) {
    seen.add(cur);
    out.push(cur);
    cur = errRecord(cur)?.cause;
  }
  return out;
}

/** Rich sections for wallet-internal failures (swap, gas station, signing). */
export function formatDevError(
  err: unknown,
  context?: Record<string, unknown>,
): FormattedDevError {
  const summary = summarizeApiError(err);
  const sections: DevErrorSection[] = [];

  if (context && Object.keys(context).length) {
    sections.push({
      label: 'Context',
      lines: [safeJson(context)],
      mono: true,
    });
  }

  sections.push({ label: 'Summary', lines: [summary] });

  const chain = walkErrorChain(err);
  if (chain.length > 1 || (chain.length === 1 && chain[0] instanceof Error && chain[0].stack)) {
    const lines: string[] = [];
    chain.forEach((item, i) => {
      if (item instanceof Error) {
        lines.push(`[${i}] ${item.name}: ${item.message}`);
        if (item.stack) lines.push(truncate(item.stack, 800));
      } else if (typeof item === 'string') {
        lines.push(`[${i}] ${item}`);
      } else {
        lines.push(`[${i}] ${truncate(safeJson(item), 400)}`);
      }
    });
    sections.push({ label: 'Error chain', lines, mono: true });
  }

  const root = errRecord(err);
  if (root) {
    if (typeof root.details === 'string' && root.details.trim()) {
      sections.push({ label: 'Details', lines: [root.details.trim()] });
    }
    if (Array.isArray(root.metaMessages) && root.metaMessages.length) {
      sections.push({
        label: 'Meta',
        lines: root.metaMessages.map(m => String(m)),
      });
    }
    const fieldLines: string[] = [];
    for (const key of ['code', 'data', 'request', 'transaction', 'receipt']) {
      if (root[key] !== undefined) {
        fieldLines.push(`${key}: ${truncate(safeJson(root[key]), 400)}`);
      }
    }
    if (fieldLines.length) {
      sections.push({ label: 'Fields', lines: fieldLines, mono: true });
    }
  }

  const detail = sections
    .map(s => `${s.label}\n${s.lines.join('\n')}`)
    .join('\n\n');

  return { summary, sections, detail };
}
