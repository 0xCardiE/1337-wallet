/** Catalog of Tools-tab modules. 1337 is a signer — see docs/signer.md. */

import type { ChainKind } from './chainCatalog';

export const TOOL_IDS = [
  'inspect',
  'approvals',
  'swap',
  'ens',
  'multisend',
  'gas',
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

export type ToolDefinition = {
  id: ToolId;
  label: string;
  description: string;
  defaultEnabled: boolean;
  /** Li.Fi / ENS live on mainnets — hide the tab while a testnet is active. */
  mainnetOnly?: boolean;
};

export const TOOL_CATALOG: ToolDefinition[] = [
  {
    id: 'inspect',
    label: 'Inspect',
    description: 'Paste an address, token, ENS name, or transaction hash.',
    defaultEnabled: true,
  },
  {
    id: 'approvals',
    label: 'Approvals',
    description: 'Review and revoke token, NFT, and Permit2 allowances in one list.',
    defaultEnabled: true,
  },
  {
    id: 'swap',
    label: 'Swap',
    description: 'Cross-chain swaps via LI.FI.',
    defaultEnabled: true,
    mainnetOnly: true,
  },
  {
    id: 'ens',
    label: 'ENS',
    description: 'Resolve names and manage your .eth portfolio.',
    defaultEnabled: true,
    mainnetOnly: true,
  },
  {
    id: 'multisend',
    label: 'Multisend',
    description: 'Batch-send native or ERC-20 to a list of addresses.',
    defaultEnabled: true,
  },
  {
    id: 'gas',
    label: 'Gas',
    description: 'Top up gas on another chain when you are stuck.',
    defaultEnabled: true,
    mainnetOnly: true,
  },
];

const TOOL_ID_SET = new Set<string>(TOOL_IDS);

export function isToolId(v: unknown): v is ToolId {
  return typeof v === 'string' && TOOL_ID_SET.has(v);
}

export function defaultEnabledToolIds(): ToolId[] {
  return TOOL_CATALOG.filter(t => t.defaultEnabled).map(t => t.id);
}

export function normalizeEnabledTools(raw: unknown): ToolId[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = raw.filter(isToolId);
  return ids;
}

export function effectiveEnabledTools(settings: { enabledTools?: string[] }): ToolId[] {
  const normalized = normalizeEnabledTools(settings.enabledTools);
  if (normalized == null) return defaultEnabledToolIds();
  return TOOL_CATALOG.map(t => t.id).filter(id => normalized.includes(id));
}

export function toolAvailableOnChain(id: ToolId, kind: ChainKind | undefined): boolean {
  if (kind !== 'testnet') return true;
  return TOOL_CATALOG.find(t => t.id === id)?.mainnetOnly !== true;
}

/** User-enabled tools that make sense on the active network. */
export function visibleToolsForChain(
  settings: { enabledTools?: string[] },
  kind: ChainKind | undefined,
): ToolId[] {
  return effectiveEnabledTools(settings).filter(id => toolAvailableOnChain(id, kind));
}

export function isToolEnabled(
  settings: { enabledTools?: string[] },
  id: ToolId,
): boolean {
  return effectiveEnabledTools(settings).includes(id);
}
