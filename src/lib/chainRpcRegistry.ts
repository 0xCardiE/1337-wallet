import type { ExtendedChain } from '@lifi/types';
import { CHAIN_CATALOG, MAX_RPC_OPTIONS, type ChainDefinition } from './chainCatalog';
import { CHAIN_RPC_FALLBACK } from './constants';
import { applyOrder } from './listOrder';
import { sortUrlsByHealth, sortUrlsStableDemoteUnhealthy } from './rpcHealth';

const catalogRpcs: Record<number, string[]> = Object.fromEntries(
  CHAIN_CATALOG.map(c => [c.chainId, [...c.rpcUrls]]),
);

const customChainRpcs: Record<number, string[]> = {};

const extraRpcsByChainId: Record<number, string[]> = {};

/** User-selected RPC URL per chain (persisted). */
let preferredRpcByChainId: Record<number, string> = {};
let customRpcByChainId: Record<number, string[]> = {};
let rpcOrderByChainId: Record<number, string[]> = {};

export function setPreferredRpcMap(map: Record<number, string>): void {
  preferredRpcByChainId = { ...map };
}

export function setCustomRpcMap(map: Record<number, string[]>): void {
  customRpcByChainId = { ...map };
}

export function setRpcOrderMap(map: Record<number, string[]>): void {
  rpcOrderByChainId = { ...map };
}

export function rpcOrderFor(chainId: number): string[] | undefined {
  const list = rpcOrderByChainId[chainId];
  return list?.length ? list : undefined;
}

/** Sync built-in RPC lists from user-added chain definitions. */
export function setCustomChainRpcCatalog(chains: ChainDefinition[]): void {
  for (const key of Object.keys(customChainRpcs)) {
    delete customChainRpcs[Number(key)];
  }
  for (const c of chains) {
    if (!c?.rpcUrls?.length) continue;
    customChainRpcs[c.chainId] = [...c.rpcUrls];
  }
}

export function preferredRpcFor(chainId: number): string | undefined {
  const url = preferredRpcByChainId[chainId]?.trim();
  return url || undefined;
}

export function setPreferredRpc(chainId: number, url: string | undefined): void {
  if (!url?.trim()) {
    const next = { ...preferredRpcByChainId };
    delete next[chainId];
    preferredRpcByChainId = next;
    return;
  }
  preferredRpcByChainId = { ...preferredRpcByChainId, [chainId]: url.trim() };
}

/**
 * Prefer hardcoded fallback RPCs, then URLs from LiFi chain metadata so new
 * chains from quotes can still be broadcast without maintaining a giant map by hand.
 */
export function mergeLifiChainRpcs(chains: ExtendedChain[]): void {
  for (const chain of chains) {
    const urls =
      chain.chainType !== 'EVM'
        ? undefined
        : chain.metamask?.rpcUrls?.filter((u): u is string => Boolean(u));
    if (!urls?.length) continue;
    extraRpcsByChainId[chain.id] ??= [];
    const cur = extraRpcsByChainId[chain.id]!;
    for (const url of urls) {
      if (!cur.includes(url)) cur.push(url);
    }
  }
}

export function rpcUrlsFor(chainId: number): string[] {
  const preferred = preferredRpcFor(chainId);
  const fb = CHAIN_RPC_FALLBACK[chainId] ?? [];
  const catalog = catalogRpcs[chainId] ?? customChainRpcs[chainId] ?? [];
  const custom = customRpcByChainId[chainId] ?? [];
  const extra = extraRpcsByChainId[chainId] ?? [];
  const userOrder = rpcOrderByChainId[chainId] ?? [];
  const merged: string[] = [];
  const seen = new Set<string>();
  const pushAll = (urls: string[]) => {
    for (const u of urls) {
      const t = u.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      merged.push(t);
    }
  };
  if (userOrder.length) {
    pushAll(applyOrder([...userOrder, ...custom, ...catalog, ...fb, ...extra], userOrder));
    return merged;
  }
  const ordered = preferred
    ? [preferred, ...custom, ...catalog, ...fb, ...extra]
    : [...custom, ...catalog, ...fb, ...extra];
  pushAll(ordered);
  return merged;
}

/** Ranked list for Networks manage (user order, no health shuffle). */
export function rpcListForManage(chainId: number, max = 20): string[] {
  return rpcUrlsFor(chainId).slice(0, max);
}

/** Health-ordered RPC list for failover (session demotions applied). */
export function healthyRpcUrlsFor(chainId: number): string[] {
  const urls = rpcUrlsFor(chainId);
  if ((rpcOrderByChainId[chainId] ?? []).length) {
    return sortUrlsStableDemoteUnhealthy(chainId, urls);
  }
  return sortUrlsByHealth(chainId, urls);
}

/** All known RPC endpoints for a chain (for dropdown UI). Capped at {@link MAX_RPC_OPTIONS}. */
export function allRpcOptionsFor(chainId: number, max = MAX_RPC_OPTIONS): string[] {
  return healthyRpcUrlsFor(chainId).slice(0, max);
}
