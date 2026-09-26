import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AuthSecrets, Draft, Settings, Store, Topic } from './types.js';

export const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));
export const STORE_FILE = fileURLToPath(new URL('../data/store.json', import.meta.url));
export const AUTH_FILE = fileURLToPath(new URL('../data/auth.json', import.meta.url));
export const SESSION_FILE = fileURLToPath(new URL('../data/x-session.json', import.meta.url));
export const RESEARCH_SESSION_FILE = fileURLToPath(
  new URL('../../wallet-research/data/x-session.json', import.meta.url),
);

export const DEFAULT_SETTINGS: Settings = {
  autopilot: false,
  autoApprove: true,
  dryRun: true,
  maxPerDay: 50,
  minGapMinutes: 4,
  maxGapMinutes: 16,
  loopMinutes: 10,
  includeReddit: false,
  includeX: true,
};

function emptyStore(): Store {
  return { topics: [], drafts: [], logs: [], settings: { ...DEFAULT_SETTINGS }, job: null, cursor: 0 };
}

let chain: Promise<unknown> = Promise.resolve();

function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function loadStore(): Promise<Store> {
  const stored = await readJson<Store>(STORE_FILE);
  if (!stored) return emptyStore();
  return {
    ...emptyStore(),
    ...stored,
    settings: { ...DEFAULT_SETTINGS, ...stored.settings },
    topics: stored.topics ?? [],
    drafts: stored.drafts ?? [],
    logs: stored.logs ?? [],
  };
}

export async function saveStore(store: Store): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  store.logs = store.logs.slice(0, 80);
  await writeFile(STORE_FILE, JSON.stringify(store, null, 2));
}

export async function updateStore<T>(fn: (store: Store) => Promise<T> | T): Promise<T> {
  return locked(async () => {
    const store = await loadStore();
    const result = await fn(store);
    await saveStore(store);
    return result;
  });
}

export async function loadAuth(): Promise<AuthSecrets> {
  return (await readJson<AuthSecrets>(AUTH_FILE)) ?? {};
}

export async function saveAuth(next: AuthSecrets): Promise<void> {
  await mkdir(dirname(AUTH_FILE), { recursive: true });
  const current = await loadAuth();
  const merged: AuthSecrets = { ...current };
  for (const [key, value] of Object.entries(next) as Array<[keyof AuthSecrets, string | undefined]>) {
    if (typeof value === 'string' && value.trim()) merged[key] = value.trim();
  }
  await writeFile(AUTH_FILE, JSON.stringify(merged, null, 2), { mode: 0o600 });
  await chmod(AUTH_FILE, 0o600).catch(() => undefined);
}

export function topicId(source: string, url: string): string {
  return createHash('sha1').update(`${source}:${url}`).digest('hex').slice(0, 16);
}

export function postsToday(drafts: Draft[], now = new Date()): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return drafts.filter((d) => d.status === 'posted' && d.postedAt && new Date(d.postedAt) >= start).length;
}

export function lastPostedAt(drafts: Draft[]): string | undefined {
  return drafts
    .filter((d) => d.status === 'posted' && d.postedAt)
    .map((d) => d.postedAt!)
    .sort()
    .at(-1);
}

export function upsertTopic(store: Store, topic: Topic): Topic {
  const idx = store.topics.findIndex((t) => t.id === topic.id);
  if (idx === -1) {
    store.topics.unshift(topic);
  } else {
    const prev = store.topics[idx]!;
    store.topics[idx] = { ...topic, fetchedAt: prev.fetchedAt };
    return store.topics[idx]!;
  }
  const replies = store.topics.filter((t) => t.fit === 'reply');
  const skips = store.topics.filter((t) => t.fit === 'skip').slice(0, 80);
  store.topics = [...replies, ...skips].slice(0, 400);
  return store.topics.find((t) => t.id === topic.id) ?? topic;
}
