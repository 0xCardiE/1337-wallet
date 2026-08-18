/** Shared Etherscan API v2 client. Free tier is 3 calls/sec — serialize + retry. */

export const ETHERSCAN_V2_URL = 'https://api.etherscan.io/v2/api';

const MIN_INTERVAL_MS = 400;
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 700;
const MAX_BACKOFF_MS = 8_000;

type EtherscanV2Json = {
  status?: string;
  message?: string;
  result?: unknown;
};

let queue: Promise<void> = Promise.resolve();
let lastAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isExplorerRateLimit(message: string, httpStatus?: number): boolean {
  if (httpStatus === 429) return true;
  return /rate.?limit|max calls per sec|too many requests|\b429\b/i.test(message);
}

function resultMessage(json: EtherscanV2Json): string {
  if (typeof json.result === 'string' && json.result.trim()) return json.result;
  return json.message ?? '';
}

function backoffMs(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const sec = Number(retryAfter);
    if (Number.isFinite(sec) && sec > 0) return Math.min(sec * 1000, MAX_BACKOFF_MS);
  }
  return Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
}

async function waitSlot(): Promise<void> {
  const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastAt));
  if (wait > 0) await sleep(wait);
  lastAt = Date.now();
}

/**
 * GET Etherscan v2. Calls are queued so Approvals/History/source share the 3/sec budget.
 * Rate-limit responses retry with backoff; other JSON errors are returned to the caller.
 */
export async function etherscanV2Get(query: URLSearchParams): Promise<EtherscanV2Json> {
  const run = queue.then(async () => {
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await waitSlot();
      try {
        const res = await fetch(`${ETHERSCAN_V2_URL}?${query.toString()}`);
        if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
          lastErr = new Error(
            res.status === 429
              ? 'Max calls per sec rate limit reached (3/sec)'
              : `Etherscan HTTP ${res.status}`,
          );
          await sleep(backoffMs(attempt, res.headers.get('Retry-After')));
          continue;
        }
        if (!res.ok) throw new Error(`Etherscan HTTP ${res.status}`);
        const json = (await res.json()) as EtherscanV2Json;
        const msg = resultMessage(json);
        if (json.status === '0' && isExplorerRateLimit(msg)) {
          lastErr = new Error(msg);
          await sleep(backoffMs(attempt, null));
          continue;
        }
        return json;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (isExplorerRateLimit(msg)) {
          lastErr = e instanceof Error ? e : new Error(msg);
          await sleep(backoffMs(attempt, null));
          continue;
        }
        throw e;
      }
    }
    throw lastErr ?? new Error('Etherscan rate limit');
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
