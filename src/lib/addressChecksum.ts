import { getAddress } from 'viem';

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

export type AddressChecksumIssue = {
  raw: string;
  reason: 'badChecksum';
};

/** Mixed-case hex that fails EIP-55. All-lower / all-upper is not checksummed and is fine. */
export function inspectAddressChecksum(raw: string): AddressChecksumIssue | null {
  if (!ADDR_RE.test(raw)) return null;
  const body = raw.slice(2);
  const allLower = body === body.toLowerCase();
  const allUpper = body === body.toUpperCase();
  if (allLower || allUpper) return null;
  try {
    const checksummed = getAddress(raw);
    if (checksummed !== raw) return { raw, reason: 'badChecksum' };
    return null;
  } catch {
    return { raw, reason: 'badChecksum' };
  }
}

function walkForAddresses(value: unknown, out: AddressChecksumIssue[], seen: Set<string>): void {
  if (typeof value === 'string') {
    if (!ADDR_RE.test(value) || seen.has(value)) return;
    seen.add(value);
    const issue = inspectAddressChecksum(value);
    if (issue) out.push(issue);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) walkForAddresses(v, out, seen);
    return;
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      walkForAddresses(v, out, seen);
    }
  }
}

/** Scan a provider request for mixed-case addresses that fail EIP-55. */
export function findChecksumIssues(params: unknown[] | undefined): AddressChecksumIssue[] {
  const out: AddressChecksumIssue[] = [];
  walkForAddresses(params ?? [], out, new Set());
  return out;
}

export function shortChecksumRaw(raw: string): string {
  if (raw.length < 12) return raw;
  return `${raw.slice(0, 8)}…${raw.slice(-6)}`;
}
