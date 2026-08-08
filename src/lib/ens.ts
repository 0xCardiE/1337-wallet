import { createPublicClient, getAddress, http, type Address } from 'viem';
import { mainnet } from 'viem/chains';
import { getEnsName } from 'viem/actions';
import { shortAddress, type WalletAccount } from './accounts';
import { healthyRpcUrlsFor } from './chainRpcRegistry';
import { DEFAULT_CHAIN_ID } from './constants';

const CACHE_TTL_MS = 30 * 60 * 1000;
const RPC_TIMEOUT_MS = 8_000;
const MAX_RPC_ATTEMPTS = 5;

type CacheEntry = { at: number; name: string | null };

const ensCache = new Map<string, CacheEntry>();

function cacheKey(address: Address): string {
  return address.toLowerCase();
}

/** Reverse-resolve an Ethereum mainnet ENS name for `address` (cached). */
export async function fetchEnsName(address: string): Promise<string | null> {
  let normalized: Address;
  try {
    normalized = getAddress(address.trim());
  } catch {
    return null;
  }

  const key = cacheKey(normalized);
  const cached = ensCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.name;
  }

  const rpcs = healthyRpcUrlsFor(DEFAULT_CHAIN_ID).slice(0, MAX_RPC_ATTEMPTS);
  if (rpcs.length === 0) return null;

  for (const rpc of rpcs) {
    try {
      const client = createPublicClient({
        chain: mainnet,
        transport: http(rpc, { timeout: RPC_TIMEOUT_MS }),
      });
      const name = await getEnsName(client, { address: normalized });
      ensCache.set(key, { at: Date.now(), name: name ?? null });
      return name ?? null;
    } catch {
      continue;
    }
  }

  return null;
}

/** Append ENS to a wallet label when the address has a reverse record. */
export function accountLabelWithEns(
  account: Pick<WalletAccount, 'label' | 'address'>,
  ensName: string | null | undefined,
): string {
  const base = account.label?.trim() || shortAddress(account.address);
  const ens = ensName?.trim();
  if (!ens) return base;
  if (base.toLowerCase().includes(ens.toLowerCase())) return base;
  return `${base} · ${ens}`;
}
