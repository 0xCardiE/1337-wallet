import { isAddress } from 'viem';
import { chainById } from './chainCatalog';

const COINS_URL = 'https://coins.llama.fi/prices/current';
const MIN_CONFIDENCE = 0.5;
const BATCH = 40;
const TTL_MS = 10 * 60_000;

/** Llama coins slugs that differ from our `logoSlug`. */
const CHAIN_OVERRIDE: Record<number, string> = {
  56: 'bsc',
  100: 'gnosis',
  324: 'era',
  43114: 'avax',
};

const NATIVE = new Set([
  '0x0000000000000000000000000000000000000000',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
]);

const priceCache = new Map<string, { at: number; price: number }>();

export function llamaCoinsChain(chainId: number): string | null {
  const chain = chainById(chainId);
  if (!chain || chain.kind === 'testnet') return null;
  const slug = CHAIN_OVERRIDE[chainId] ?? chain.logoSlug;
  return slug?.trim() || null;
}

export function llamaCoinId(chainId: number, address: string): string | null {
  const slug = llamaCoinsChain(chainId);
  if (!slug || !isAddress(address) || NATIVE.has(address.toLowerCase())) return null;
  return `${slug}:${address.toLowerCase()}`;
}

export function parseLlamaCoinPrices(json: unknown): Map<string, number> {
  const out = new Map<string, number>();
  if (!json || typeof json !== 'object') return out;
  const coins = (json as { coins?: unknown }).coins;
  if (!coins || typeof coins !== 'object') return out;
  for (const [id, raw] of Object.entries(coins as Record<string, unknown>)) {
    if (!id || !raw || typeof raw !== 'object') continue;
    const rec = raw as { price?: unknown; confidence?: unknown };
    const price = Number(rec.price);
    const confidence = rec.confidence == null ? 1 : Number(rec.confidence);
    if (!Number.isFinite(price) || price <= 0) continue;
    if (!Number.isFinite(confidence) || confidence < MIN_CONFIDENCE) continue;
    out.set(id.toLowerCase(), price);
  }
  return out;
}

export function applyFetchedUsdPrices<T extends { address: string; chainId: number; priceUSD?: string }>(
  rows: T[],
  pricesByLlamaId: Map<string, number>,
): T[] {
  if (pricesByLlamaId.size === 0) return rows;
  return rows.map(row => {
    if (row.priceUSD) return row;
    const id = llamaCoinId(row.chainId, row.address);
    if (!id) return row;
    const price = pricesByLlamaId.get(id.toLowerCase());
    if (price == null || !(price > 0)) return row;
    return { ...row, priceUSD: String(price) };
  });
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** USD per token from DefiLlama. Keys are `llamaCoinId` values. */
export async function fetchLlamaUsdPrices(
  tokens: { chainId: number; address: string }[],
): Promise<Map<string, number>> {
  const now = Date.now();
  const out = new Map<string, number>();
  const missing: string[] = [];
  const seen = new Set<string>();

  for (const t of tokens) {
    const id = llamaCoinId(t.chainId, t.address);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const cached = priceCache.get(id);
    if (cached && now - cached.at < TTL_MS) {
      out.set(id, cached.price);
      continue;
    }
    missing.push(id);
  }

  for (const batch of chunks(missing, BATCH)) {
    try {
      const res = await fetch(`${COINS_URL}/${batch.join(',')}`);
      if (!res.ok) continue;
      const parsed = parseLlamaCoinPrices(await res.json());
      for (const id of batch) {
        const price = parsed.get(id.toLowerCase());
        if (price == null) continue;
        priceCache.set(id, { at: now, price });
        out.set(id, price);
      }
    } catch {
      /* keep whatever we already have */
    }
  }

  return out;
}
