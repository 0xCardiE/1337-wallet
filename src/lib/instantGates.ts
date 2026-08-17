/** Instant-mode risk gates. Default is gated (pause Instant and show approval). */

export const INSTANT_GATE_IDS = [
  'unlimitedApproval',
  'unknownContract',
  'highValue',
  'permit',
  'eip712ChainMismatch',
  'siweMismatch',
] as const;

export type InstantGateId = (typeof INSTANT_GATE_IDS)[number];

export const DEFAULT_HIGH_VALUE_NATIVE = 1;

export const INSTANT_GATE_META: Record<
  InstantGateId,
  { title: string; description: string }
> = {
  unlimitedApproval: {
    title: 'Unlimited token approvals',
    description: 'ERC-20 approve(max), NFT setApprovalForAll, and similar unlimited allowances.',
  },
  unknownContract: {
    title: 'Unknown contract calls',
    description: 'Transactions whose function is not a known transfer or approve.',
  },
  highValue: {
    title: 'High-value native sends',
    description: 'Transactions sending more than the native-token threshold below.',
  },
  permit: {
    title: 'Permit / Permit2 signatures',
    description: 'Gasless token permits that grant spending rights without a transaction.',
  },
  eip712ChainMismatch: {
    title: 'EIP-712 chain ID mismatch',
    description: 'Typed data whose domain.chainId does not match the active network.',
  },
  siweMismatch: {
    title: 'SIWE domain mismatch',
    description: 'Sign-In with Ethereum messages whose domain or URI does not match the page.',
  },
};

const GATE_ID_SET = new Set<string>(INSTANT_GATE_IDS);

export function isInstantGateId(v: string): v is InstantGateId {
  return GATE_ID_SET.has(v);
}

export function normalizeInstantUngatedGates(raw: unknown): InstantGateId[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: InstantGateId[] = [];
  const seen = new Set<InstantGateId>();
  for (const row of raw) {
    if (typeof row !== 'string' || !isInstantGateId(row) || seen.has(row)) continue;
    seen.add(row);
    out.push(row);
  }
  return out.length ? out : undefined;
}

export function normalizeHighValueNative(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(n) || n < 0) return DEFAULT_HIGH_VALUE_NATIVE;
  return Math.min(1_000_000, n);
}

export function effectiveHighValueNative(settings: {
  instantHighValueNative?: number;
}): number {
  return settings.instantHighValueNative ?? DEFAULT_HIGH_VALUE_NATIVE;
}

/** Gates that still interrupt Instant. Empty when fully ungated. */
export function effectiveActiveInstantGates(settings: {
  instantFullyUngated?: boolean;
  instantUngatedGates?: InstantGateId[];
}): Set<InstantGateId> {
  if (settings.instantFullyUngated) return new Set();
  const ungated = new Set(settings.instantUngatedGates ?? []);
  return new Set(INSTANT_GATE_IDS.filter(id => !ungated.has(id)));
}
