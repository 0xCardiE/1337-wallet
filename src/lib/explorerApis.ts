import { chainById } from './chainCatalog';

/**
 * Public Blockscout API origins for catalog chains Etherscan Free misses or never covered.
 * Browser links stay on the catalog explorer (`optimistic.etherscan.io`, etc.).
 * Unichain / MegaETH stay on Etherscan — they are still Free.
 */
const BLOCKSCOUT_API_ORIGIN: Record<number, string> = {
  10: 'https://explorer.optimism.io',
  100: 'https://gnosis.blockscout.com',
  324: 'https://zksync.blockscout.com',
  4663: 'https://robinhoodchain.blockscout.com',
  8453: 'https://base.blockscout.com',
  84532: 'https://base-sepolia.blockscout.com',
  57073: 'https://explorer.inkonchain.com',
  534352: 'https://scroll.blockscout.com',
  11155420: 'https://optimism-sepolia.blockscout.com',
};

/** Official Blockscout hosts that do not contain "blockscout" in the hostname. */
const BLOCKSCOUT_EXTRA_HOSTS = new Set([
  'explorer.optimism.io',
  'explorer.inkonchain.com',
  'explorer.testnet.chain.robinhood.com',
]);

/** Etherscan v2 community (`txlist` / `getLogs`) — not source/ABI, which stay free. */
const ETHERSCAN_PAID_ONLY = new Set([
  10, 56, 97, 8453, 84532, 43114, 11155420,
]);

const ETHERSCAN_NONE = new Set([
  324, 4663, 46630, 57073, 6342, 534352,
]);

export type EtherscanCommunityAccess = 'free' | 'paid' | 'none';

export function catalogExplorerOrigin(chainId: number): string | undefined {
  const url = chainById(chainId)?.blockExplorerUrls[0]?.trim();
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

export function isBlockscoutOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.replace(/^www\./, '');
    return /blockscout/i.test(host) || BLOCKSCOUT_EXTRA_HOSTS.has(host);
  } catch {
    return false;
  }
}

export function etherscanCommunityAccess(chainId: number): EtherscanCommunityAccess {
  if (ETHERSCAN_PAID_ONLY.has(chainId)) return 'paid';
  if (ETHERSCAN_NONE.has(chainId)) return 'none';
  return 'free';
}

/** Blockscout instance to query. Catalog origin wins when it already is Blockscout. */
export function blockscoutApiOrigin(chainId: number): string | undefined {
  const catalog = catalogExplorerOrigin(chainId);
  if (catalog && isBlockscoutOrigin(catalog)) return catalog;
  return BLOCKSCOUT_API_ORIGIN[chainId];
}

export function isEtherscanCoverageError(message: string): boolean {
  return /free api access is not supported|upgrade your api plan|full chain coverage|not supported for this chain/i.test(
    message,
  );
}

/**
 * True when History/Approvals cannot load without an Etherscan key.
 * False when a Blockscout instance can serve the chain (no key).
 */
export function needsExplorerApiKey(chainId: number): boolean {
  if (blockscoutApiOrigin(chainId)) return false;
  return etherscanCommunityAccess(chainId) !== 'none';
}

export function explorerErrorMessage(json: {
  status?: string;
  message?: string;
  result?: unknown;
}): string {
  if (typeof json.result === 'string' && json.result.trim()) return json.result;
  return json.message ?? '';
}

export async function blockscoutGet(
  origin: string,
  query: URLSearchParams,
): Promise<{ status?: string; message?: string; result?: unknown }> {
  const res = await fetch(`${origin}/api?${query.toString()}`);
  if (!res.ok) throw new Error(`Blockscout API HTTP ${res.status}`);
  return (await res.json()) as { status?: string; message?: string; result?: unknown };
}
