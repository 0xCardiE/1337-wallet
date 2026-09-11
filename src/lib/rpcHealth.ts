/**
 * Session-scoped RPC health: probe eth_chainId, demote bad endpoints, order
 * failover lists by health. Not persisted — resets when the extension reloads.
 */

export type RpcHealthStatus = 'unknown' | 'healthy' | 'slow' | 'unhealthy';

export type RpcEndpointHealth = {
  url: string;
  status: RpcHealthStatus;
  lastLatencyMs?: number;
  lastError?: string;
  lastCheckedAt?: number;
  /** Soft demotion expiry (ms since epoch). */
  demotedUntil?: number;
  failCount: number;
  successCount: number;
};

export type ChainRpcHealthSnapshot = {
  chainId: number;
  endpoints: RpcEndpointHealth[];
  activeUrl: string | null;
  healthyCount: number;
  probedAt: number;
};

export type RpcProbeResult = {
  url: string;
  ok: boolean;
  latencyMs: number;
  reportedChainId?: number;
  error?: string;
  status: RpcHealthStatus;
};

const SLOW_MS = 2500;
const DEMOTE_MS = 5 * 60 * 1000;
const PROBE_TIMEOUT_MS = 4500;

/** chainId → url → health */
const healthByChain = new Map<number, Map<string, RpcEndpointHealth>>();

/** Last successful RPC URL used per chain (runtime sticky). */
const stickyUrlByChain = new Map<number, string>();

type Listener = (chainId: number) => void;
const listeners = new Set<Listener>();

export function subscribeRpcHealth(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(chainId: number) {
  for (const l of listeners) {
    try {
      l(chainId);
    } catch {
      /* ignore */
    }
  }
}

function bucket(chainId: number): Map<string, RpcEndpointHealth> {
  let m = healthByChain.get(chainId);
  if (!m) {
    m = new Map();
    healthByChain.set(chainId, m);
  }
  return m;
}

function ensureEntry(chainId: number, url: string): RpcEndpointHealth {
  const m = bucket(chainId);
  let e = m.get(url);
  if (!e) {
    e = { url, status: 'unknown', failCount: 0, successCount: 0 };
    m.set(url, e);
  }
  return e;
}

function isDemoted(e: RpcEndpointHealth, now = Date.now()): boolean {
  return e.status === 'unhealthy' && (e.demotedUntil ?? 0) > now;
}

export function getStickyRpc(chainId: number): string | undefined {
  return stickyUrlByChain.get(chainId);
}

export function setStickyRpc(chainId: number, url: string | undefined): void {
  if (!url) stickyUrlByChain.delete(chainId);
  else stickyUrlByChain.set(chainId, url);
}

export function getEndpointHealth(
  chainId: number,
  url: string,
): RpcEndpointHealth | undefined {
  return healthByChain.get(chainId)?.get(url);
}

export function getChainHealthSnapshot(
  chainId: number,
  urls: string[],
): ChainRpcHealthSnapshot {
  const now = Date.now();
  const endpoints = urls.map(url => {
    const e = ensureEntry(chainId, url);
    // Expire demotions
    if (e.status === 'unhealthy' && (e.demotedUntil ?? 0) <= now && e.demotedUntil) {
      e.status = 'unknown';
      e.demotedUntil = undefined;
    }
    return { ...e };
  });
  const sticky = stickyUrlByChain.get(chainId) ?? null;
  return {
    chainId,
    endpoints,
    activeUrl: sticky && urls.includes(sticky) ? sticky : urls[0] ?? null,
    healthyCount: endpoints.filter(e => e.status === 'healthy' || e.status === 'slow').length,
    probedAt: Math.max(0, ...endpoints.map(e => e.lastCheckedAt ?? 0)),
  };
}

export function recordRpcSuccess(
  chainId: number,
  url: string,
  latencyMs?: number,
): void {
  const e = ensureEntry(chainId, url);
  e.successCount += 1;
  e.lastCheckedAt = Date.now();
  e.lastError = undefined;
  e.demotedUntil = undefined;
  if (latencyMs != null) e.lastLatencyMs = latencyMs;
  e.status =
    latencyMs != null && latencyMs >= SLOW_MS ? 'slow' : 'healthy';
  stickyUrlByChain.set(chainId, url);
  notify(chainId);
}

export function recordRpcFailure(
  chainId: number,
  url: string,
  error: string,
  opts?: { hard?: boolean; latencyMs?: number },
): void {
  const e = ensureEntry(chainId, url);
  e.failCount += 1;
  e.lastCheckedAt = Date.now();
  e.lastError = error.slice(0, 240);
  if (opts?.latencyMs != null) e.lastLatencyMs = opts.latencyMs;
  const hard = opts?.hard ?? true;
  if (hard || e.failCount >= 2) {
    e.status = 'unhealthy';
    e.demotedUntil = Date.now() + DEMOTE_MS;
  } else {
    e.status = 'slow';
  }
  if (stickyUrlByChain.get(chainId) === url) {
    stickyUrlByChain.delete(chainId);
  }
  notify(chainId);
}

/**
 * Sort known URLs: sticky healthy first, then healthy/slow by latency,
 * unknown, then demoted.
 */
/**
 * Keep the given order except: sticky healthy first, demoted/unhealthy last.
 * Used when the user ranked RPCs themselves.
 */
export function sortUrlsStableDemoteUnhealthy(chainId: number, urls: string[]): string[] {
  const now = Date.now();
  const sticky = stickyUrlByChain.get(chainId);
  const good: string[] = [];
  const bad: string[] = [];
  for (const url of urls) {
    const e = ensureEntry(chainId, url);
    if (isDemoted(e, now) || e.status === 'unhealthy') bad.push(url);
    else good.push(url);
  }
  if (sticky && good.includes(sticky)) {
    return [sticky, ...good.filter(u => u !== sticky), ...bad];
  }
  return [...good, ...bad];
}

export function sortUrlsByHealth(chainId: number, urls: string[]): string[] {
  const now = Date.now();
  const sticky = stickyUrlByChain.get(chainId);
  const scored = urls.map((url, index) => {
    const e = ensureEntry(chainId, url);
    const demoted = isDemoted(e, now);
    let rank = 50;
    if (demoted) rank = 90;
    else if (e.status === 'unhealthy') rank = 80;
    else if (e.status === 'unknown') rank = 40;
    else if (e.status === 'slow') rank = 20;
    else if (e.status === 'healthy') rank = 10;
    if (sticky === url && !demoted) rank = 0;
    const latency = e.lastLatencyMs ?? 99999;
    return { url, rank, latency, index };
  });
  scored.sort((a, b) => a.rank - b.rank || a.latency - b.latency || a.index - b.index);
  return scored.map(s => s.url);
}

function shortHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url.slice(0, 40);
  }
}

export function rpcHostLabel(url: string): string {
  return shortHost(url);
}

export function rpcProviderHint(url: string): string {
  const host = shortHost(url).toLowerCase();
  if (host.includes('publicnode')) return 'PublicNode';
  if (host.includes('drpc')) return 'dRPC';
  if (host.includes('ankr')) return 'Ankr';
  if (host.includes('llamarpc')) return 'LlamaRPC';
  if (host.includes('blastapi')) return 'Blast';
  if (host.includes('1rpc')) return '1RPC';
  if (host.includes('meowrpc')) return 'MeowRPC';
  if (host.includes('tenderly')) return 'Tenderly';
  if (host.includes('binance')) return 'Binance';
  if (host.includes('alchemy')) return 'Alchemy';
  if (host.includes('infura')) return 'Infura';
  return 'Public';
}

async function fetchWithTimeout(
  url: string,
  body: string,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: ctrl.signal,
    });
  } finally {
    window.clearTimeout(t);
  }
}

/** Probe a single endpoint with eth_chainId. */
export async function probeRpcEndpoint(
  url: string,
  expectedChainId: number,
  timeoutMs = PROBE_TIMEOUT_MS,
): Promise<RpcProbeResult> {
  const started = performance.now();
  try {
    const res = await fetchWithTimeout(
      url,
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_chainId',
        params: [],
      }),
      timeoutMs,
    );
    const latencyMs = Math.round(performance.now() - started);
    if (!res.ok) {
      const error = `HTTP ${res.status}`;
      recordRpcFailure(expectedChainId, url, error, { hard: true, latencyMs });
      return { url, ok: false, latencyMs, error, status: 'unhealthy' };
    }
    const json = (await res.json()) as {
      result?: string;
      error?: { message?: string };
    };
    if (json.error?.message) {
      recordRpcFailure(expectedChainId, url, json.error.message, {
        hard: true,
        latencyMs,
      });
      return {
        url,
        ok: false,
        latencyMs,
        error: json.error.message,
        status: 'unhealthy',
      };
    }
    if (!json.result) {
      const error = 'Empty eth_chainId result';
      recordRpcFailure(expectedChainId, url, error, { hard: true, latencyMs });
      return { url, ok: false, latencyMs, error, status: 'unhealthy' };
    }
    const reported = Number.parseInt(json.result, 16);
    if (!Number.isFinite(reported)) {
      const error = `Bad chainId ${json.result}`;
      recordRpcFailure(expectedChainId, url, error, { hard: true, latencyMs });
      return { url, ok: false, latencyMs, error, status: 'unhealthy' };
    }
    if (reported !== expectedChainId) {
      const error = `Wrong network: RPC reports chain ${reported}, expected ${expectedChainId}`;
      recordRpcFailure(expectedChainId, url, error, { hard: true, latencyMs });
      return {
        url,
        ok: false,
        latencyMs,
        reportedChainId: reported,
        error,
        status: 'unhealthy',
      };
    }
    recordRpcSuccess(expectedChainId, url, latencyMs);
    const status: RpcHealthStatus = latencyMs >= SLOW_MS ? 'slow' : 'healthy';
    return { url, ok: true, latencyMs, reportedChainId: reported, status };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - started);
    const error =
      err instanceof Error
        ? err.name === 'AbortError'
          ? `Timed out after ${timeoutMs}ms`
          : err.message
        : String(err);
    recordRpcFailure(expectedChainId, url, error, { hard: true, latencyMs });
    return { url, ok: false, latencyMs, error, status: 'unhealthy' };
  }
}

/**
 * Probe up to `limit` endpoints (health-ordered). Stops early once one is healthy
 * unless `probeAll` is set.
 */
export async function probeChainRpcs(
  chainId: number,
  urls: string[],
  opts?: { limit?: number; probeAll?: boolean },
): Promise<ChainRpcHealthSnapshot> {
  const limit = opts?.limit ?? 6;
  const ordered = sortUrlsByHealth(chainId, urls).slice(0, Math.max(limit, urls.length));
  const targets = ordered.slice(0, limit);

  // Probe first in parallel batches of 3 for speed
  const batchSize = 3;
  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = targets.slice(i, i + batchSize);
    await Promise.all(batch.map(u => probeRpcEndpoint(u, chainId)));
    if (!opts?.probeAll) {
      const snap = getChainHealthSnapshot(chainId, urls);
      if (snap.healthyCount > 0) return snap;
    }
  }
  return getChainHealthSnapshot(chainId, urls);
}

export function summarizeChainHealth(snap: ChainRpcHealthSnapshot): {
  tone: 'ok' | 'warn' | 'bad' | 'unknown';
  label: string;
  detail: string;
} {
  const active = snap.endpoints.find(e => e.url === snap.activeUrl) ?? snap.endpoints[0];
  if (!active) {
    return { tone: 'bad', label: 'No RPC', detail: 'No endpoints configured for this chain.' };
  }
  if (active.status === 'healthy') {
    return {
      tone: 'ok',
      label: rpcProviderHint(active.url),
      detail: `${rpcHostLabel(active.url)}${active.lastLatencyMs != null ? ` · ${active.lastLatencyMs}ms` : ''} · ${snap.healthyCount} healthy`,
    };
  }
  if (active.status === 'slow') {
    return {
      tone: 'warn',
      label: 'Slow RPC',
      detail: `${rpcHostLabel(active.url)} · ${active.lastLatencyMs ?? '?'}ms`,
    };
  }
  if (snap.healthyCount > 0) {
    return {
      tone: 'warn',
      label: 'Failover ready',
      detail: `${snap.healthyCount} healthy backup${snap.healthyCount === 1 ? '' : 's'} available`,
    };
  }
  if (active.status === 'unhealthy') {
    return {
      tone: 'bad',
      label: 'RPC down',
      detail: active.lastError ?? 'All recent probes failed',
    };
  }
  return {
    tone: 'unknown',
    label: 'RPC unchecked',
    detail: 'Tap to probe this network',
  };
}

/** Classify JSON-RPC / transport failures for failover decisions. */
export function classifyRpcFailure(err: unknown, httpStatus?: number): {
  retryOtherRpc: boolean;
  demote: boolean;
  hard: boolean;
  kind: 'transport' | 'rate_limit' | 'mismatch' | 'call';
} {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  if (httpStatus === 429 || /rate.?limit|too many requests|429/.test(msg)) {
    return { retryOtherRpc: true, demote: true, hard: false, kind: 'rate_limit' };
  }
  if (
    httpStatus != null &&
    (httpStatus >= 500 || httpStatus === 408 || httpStatus === 502 || httpStatus === 503)
  ) {
    return { retryOtherRpc: true, demote: true, hard: true, kind: 'transport' };
  }
  if (/failed to fetch|networkerror|aborted|timed out|timeout|econnreset|enotfound/.test(msg)) {
    return { retryOtherRpc: true, demote: true, hard: true, kind: 'transport' };
  }
  if (/wrong network|chain id|chainid|could not fetch chain/.test(msg)) {
    return { retryOtherRpc: true, demote: true, hard: true, kind: 'mismatch' };
  }
  // Business-logic / revert — endpoint is fine
  return { retryOtherRpc: false, demote: false, hard: false, kind: 'call' };
}

export class RpcExhaustedError extends Error {
  readonly chainId: number;
  readonly tried: string[];
  readonly lastError: string;

  constructor(chainId: number, tried: string[], lastError: string, method: string) {
    super(
      `Network unreachable on chain ${chainId}: ${method} failed on ${tried.length} RPC${tried.length === 1 ? '' : 's'}. ${lastError}`,
    );
    this.name = 'RpcExhaustedError';
    this.chainId = chainId;
    this.tried = tried;
    this.lastError = lastError;
  }
}
