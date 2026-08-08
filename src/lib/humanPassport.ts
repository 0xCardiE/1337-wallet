import { decodeFunctionResult, encodeFunctionData, getAddress, type Address } from 'viem';
import { chainJsonRpcCall } from './ethereum';

/** Human Passport Decoder deployments — passport.human.tech contract reference. */
const PASSPORT_DECODER_CHAINS = [
  { chainId: 8453, name: 'Base', decoder: '0xaa24a127d10C68C8F9Ac06199AA606953cD82eE7' },
  { chainId: 59144, name: 'Linea', decoder: '0x423cd60ab053F1b63D6F78c8c0c63e20F009d669' },
  { chainId: 42161, name: 'Arbitrum', decoder: '0x2050256A91cbABD7C42465aA0d5325115C1dEB43' },
  { chainId: 10, name: 'Optimism', decoder: '0x5558D441779Eca04A329BcD6b47830D2C6607769' },
  { chainId: 534352, name: 'Scroll', decoder: '0x8A5820030188346cC9532a1dD9FD2EF8d8F464de' },
  { chainId: 324, name: 'zkSync', decoder: '0x1166FCDCA3B04311Ba9E2eD5ad2c660E730e1386' },
] as const;

const SCORE_SCALE = 10_000;
const HUMAN_THRESHOLD = 20;
const CACHE_TTL_MS = 10 * 60 * 1000;

const DECODER_ABI = [
  {
    name: 'getScore',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'isHuman',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export interface OnchainPassportScore {
  address: Address;
  score: number;
  isHuman: boolean;
  threshold: number;
  chainName: string;
}

export type OnchainPassportLookup =
  | { kind: 'found'; score: OnchainPassportScore }
  | { kind: 'none' };

type CacheEntry = { at: number; value: OnchainPassportLookup };

const scoreCache = new Map<string, CacheEntry>();

function cacheKey(address: Address): string {
  return address.toLowerCase();
}

async function decoderCall<T>(
  chainId: number,
  decoder: `0x${string}`,
  functionName: 'getScore' | 'isHuman',
  address: Address,
): Promise<T> {
  const data = encodeFunctionData({
    abi: DECODER_ABI,
    functionName,
    args: [address],
  });
  const raw = await chainJsonRpcCall<string>(chainId, 'eth_call', [
    { to: decoder, data },
    'latest',
  ]);
  return decodeFunctionResult({
    abi: DECODER_ABI,
    functionName,
    data: raw as `0x${string}`,
  }) as T;
}

async function fetchOnChainForNetwork(
  chain: (typeof PASSPORT_DECODER_CHAINS)[number],
  address: Address,
): Promise<OnchainPassportScore | null> {
  try {
    const [rawScore, isHuman] = await Promise.all([
      decoderCall<bigint>(chain.chainId, chain.decoder, 'getScore', address),
      decoderCall<boolean>(chain.chainId, chain.decoder, 'isHuman', address),
    ]);
    return {
      address,
      score: Number(rawScore) / SCORE_SCALE,
      isHuman,
      threshold: HUMAN_THRESHOLD,
      chainName: chain.name,
    };
  } catch {
    return null;
  }
}

function pickBestScore(results: OnchainPassportScore[]): OnchainPassportScore | null {
  if (results.length === 0) return null;
  return results.reduce((best, cur) => {
    if (cur.isHuman && !best.isHuman) return cur;
    if (!cur.isHuman && best.isHuman) return best;
    return cur.score > best.score ? cur : best;
  });
}

/** Read onchain Human Passport across all supported mint chains (no API key). */
export async function fetchOnchainPassportScore(address: string): Promise<OnchainPassportLookup> {
  const normalized = getAddress(address.trim());
  const key = cacheKey(normalized);
  const cached = scoreCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  const results = await Promise.all(
    PASSPORT_DECODER_CHAINS.map(chain => fetchOnChainForNetwork(chain, normalized)),
  );
  const found = results.filter((row): row is OnchainPassportScore => row != null);
  const best = pickBestScore(found);
  const value: OnchainPassportLookup = best
    ? { kind: 'found', score: best }
    : { kind: 'none' };

  scoreCache.set(key, { at: Date.now(), value });
  return value;
}

export function formatPassportScoreLabel(score: OnchainPassportScore): string {
  const rounded = score.score >= 10 ? Math.round(score.score) : score.score.toFixed(1);
  return score.isHuman ? `Human ${rounded}` : `Sybil ${rounded}`;
}
