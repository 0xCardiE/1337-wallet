import { getAddress, isAddress, isHex } from 'viem';

export type InspectKind = 'address' | 'tx' | 'ens' | 'unknown';

export type ParsedInspectInput =
  | { kind: 'address'; address: `0x${string}` }
  | { kind: 'tx'; hash: `0x${string}` }
  | { kind: 'ens'; name: string }
  | { kind: 'unknown'; raw: string };

const TX_RE = /^0x[a-fA-F0-9]{64}$/;
const ENS_RE = /^[a-z0-9-]+\.eth$/i;

export function parseInspectInput(raw: string): ParsedInspectInput {
  const value = raw.trim();
  if (!value) return { kind: 'unknown', raw: value };

  if (TX_RE.test(value) && isHex(value)) {
    return { kind: 'tx', hash: value.toLowerCase() as `0x${string}` };
  }

  if (isAddress(value)) {
    return { kind: 'address', address: getAddress(value) };
  }

  const asName = value.endsWith('.eth') ? value : `${value}.eth`;
  if (ENS_RE.test(asName) || value.includes('.')) {
    return { kind: 'ens', name: value.includes('.') ? value : asName };
  }

  return { kind: 'unknown', raw: value };
}
