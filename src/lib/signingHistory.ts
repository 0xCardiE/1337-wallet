import { getAddress } from 'viem';
import type { ProviderRequest } from '../provider/types';
import { bytesToHexMessage, parseTypedDataParam } from './backgroundSign';
import { isInternalWalletOrigin } from './pendingApprovals';
import { humanizePendingRequest } from './txHumanize';
import { classifyRequest } from './txRisk';

export const SIGNING_HISTORY_KEY = '1337_signings_v1';
export const SIGNING_HISTORY_MAX = 200;
const MAX_PREVIEW = 280;
const MAX_MESSAGE = 4_000;
const MAX_FIELD = 240;

const MESSAGE_SIGN_METHODS = new Set([
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v3',
  'eth_signTypedData_v4',
]);

export type SigningKind = 'siwe' | 'permit' | 'typedData' | 'message';
export type SigningSource = 'confirm' | 'instant' | 'hardware';

export type SigningRecord = {
  id: string;
  account: string;
  chainId: number;
  signedAt: number;
  method: string;
  kind: SigningKind;
  origin?: string;
  hostname?: string;
  pageUrl?: string;
  headline: string;
  detail?: string;
  preview: string;
  primaryType?: string;
  domainName?: string;
  message?: string;
  typedFields?: { label: string; value: string }[];
  signature?: string;
  source: SigningSource;
};

type PersistedBundle = Record<string, SigningRecord[]>;

export function isMessageSignMethod(method: string): boolean {
  return MESSAGE_SIGN_METHODS.has(method);
}

function storage(): chrome.storage.LocalStorageArea {
  return chrome.storage.local;
}

function accountKey(address: string): string {
  return address.toLowerCase();
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function hostnameFromOrigin(origin?: string): string | undefined {
  if (!origin) return undefined;
  if (isInternalWalletOrigin(origin)) return '1337';
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
}

function decodeMessage(raw: unknown): string {
  if (typeof raw !== 'string') {
    try {
      return JSON.stringify(raw);
    } catch {
      return String(raw);
    }
  }
  if (raw.startsWith('0x') && raw.length > 2) {
    try {
      const decoded = bytesToHexMessage(raw);
      if (typeof decoded === 'string') return decoded;
      return new TextDecoder().decode(decoded);
    } catch {
      return raw;
    }
  }
  return raw;
}

function flattenTypedMessage(
  message: Record<string, unknown>,
): { label: string; value: string }[] {
  return Object.entries(message).map(([label, value]) => ({
    label,
    value: truncate(
      value != null && typeof value === 'object' ? JSON.stringify(value) : String(value),
      MAX_FIELD,
    ),
  }));
}

export function buildSigningRecord(opts: {
  account: string;
  chainId: number;
  request: ProviderRequest;
  origin?: string;
  pageUrl?: string;
  signature?: string;
  source: SigningSource;
  now?: number;
}): SigningRecord | null {
  const { request, chainId, origin, pageUrl, source } = opts;
  if (!isMessageSignMethod(request.method)) return null;

  let account: string;
  try {
    account = getAddress(opts.account).toLowerCase();
  } catch {
    return null;
  }

  const params = request.params ?? [];
  const risk = classifyRequest(request, { chainId, origin });
  const human = humanizePendingRequest({ request, risk, chainId });
  const hostname = hostnameFromOrigin(origin);
  const signedAt = opts.now ?? Date.now();
  const signature =
    typeof opts.signature === 'string' && opts.signature.startsWith('0x')
      ? opts.signature
      : undefined;

  const base = {
    id: `${signedAt.toString(16)}-${request.id}`,
    account,
    chainId,
    signedAt,
    method: request.method,
    origin,
    hostname,
    pageUrl,
    headline: human.headline,
    detail: human.detail,
    signature,
    source,
  };

  if (request.method === 'personal_sign') {
    const text = decodeMessage(params[0]);
    const kind: SigningKind = risk.siwe ? 'siwe' : 'message';
    return {
      ...base,
      kind,
      preview: truncate(text, MAX_PREVIEW),
      message: truncate(text, MAX_MESSAGE),
    };
  }

  let typedRaw = params[1] ?? params[0];
  if (request.method === 'eth_signTypedData_v3' || request.method === 'eth_signTypedData_v4') {
    typedRaw = params[1];
  }
  try {
    const typed = parseTypedDataParam(typedRaw);
    const domainName =
      typeof typed.domain.name === 'string' && typed.domain.name.trim()
        ? typed.domain.name.trim()
        : undefined;
    const typedFields = flattenTypedMessage(typed.message);
    const previewBits = [
      typed.primaryType,
      domainName,
      hostname,
    ].filter(Boolean);
    return {
      ...base,
      kind: risk.permit ? 'permit' : 'typedData',
      preview: truncate(previewBits.join(' · ') || typed.primaryType, MAX_PREVIEW),
      primaryType: typed.primaryType,
      domainName,
      typedFields,
    };
  } catch {
    const raw = typeof typedRaw === 'string' ? typedRaw : JSON.stringify(typedRaw ?? '');
    return {
      ...base,
      kind: 'typedData',
      preview: truncate(raw, MAX_PREVIEW),
      message: truncate(raw, MAX_MESSAGE),
    };
  }
}

async function readAll(): Promise<PersistedBundle> {
  return new Promise((resolve, reject) => {
    storage().get([SIGNING_HISTORY_KEY], r => {
      const err = chrome.runtime?.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      const raw = r[SIGNING_HISTORY_KEY];
      const bundle = raw && typeof raw === 'object' ? (raw as PersistedBundle) : {};
      resolve(bundle);
    });
  });
}

async function writeAll(bundle: PersistedBundle): Promise<void> {
  return new Promise((resolve, reject) => {
    storage().set({ [SIGNING_HISTORY_KEY]: bundle }, () => {
      const err = chrome.runtime?.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

function sanitizeRows(raw: unknown): SigningRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((row): row is SigningRecord => {
    if (!row || typeof row !== 'object') return false;
    const r = row as SigningRecord;
    return (
      typeof r.id === 'string' &&
      typeof r.account === 'string' &&
      typeof r.chainId === 'number' &&
      typeof r.signedAt === 'number' &&
      typeof r.method === 'string' &&
      typeof r.kind === 'string' &&
      typeof r.headline === 'string' &&
      typeof r.preview === 'string'
    );
  });
}

export async function loadSigningHistory(address: string): Promise<SigningRecord[]> {
  const all = await readAll();
  const rows = sanitizeRows(all[accountKey(address)]);
  return [...rows].sort((a, b) => b.signedAt - a.signedAt);
}

export async function appendSigning(record: SigningRecord): Promise<void> {
  const all = await readAll();
  const key = accountKey(record.account);
  const prev = sanitizeRows(all[key]);
  const next = [record, ...prev.filter(r => r.id !== record.id)].slice(0, SIGNING_HISTORY_MAX);
  all[key] = next;
  await writeAll(all);
}

export async function clearSigningHistory(address: string): Promise<void> {
  const all = await readAll();
  delete all[accountKey(address)];
  await writeAll(all);
}

export async function clearAllSigningHistory(): Promise<void> {
  await writeAll({});
}

/** Record a successful message / typed-data sign. Never throws. */
export async function recordSuccessfulSigning(opts: {
  account: string;
  chainId: number;
  request: ProviderRequest;
  origin?: string;
  pageUrl?: string;
  signature?: string;
  source: SigningSource;
}): Promise<void> {
  try {
    const record = buildSigningRecord(opts);
    if (!record) return;
    await appendSigning(record);
  } catch {
    /* local history must not fail the sign */
  }
}

export function subscribeSigningHistory(onChange: () => void): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: string,
  ) => {
    if (area === 'local' && changes[SIGNING_HISTORY_KEY]) onChange();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
