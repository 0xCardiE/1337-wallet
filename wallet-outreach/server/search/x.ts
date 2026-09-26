import { existsSync } from 'node:fs';
import { RESEARCH_SESSION_FILE, SESSION_FILE, topicId } from '../storage.js';
import type { Topic } from '../types.js';
import { classifyThread } from '../voice.js';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function xSessionPath(): string | null {
  if (existsSync(SESSION_FILE)) return SESSION_FILE;
  if (existsSync(RESEARCH_SESSION_FILE)) return RESEARCH_SESSION_FILE;
  return null;
}

interface XTweet {
  id: string;
  text: string;
  createdAt?: string;
  user?: { screen_name?: string };
  favorite_count?: number;
  reply_count?: number;
}

function extractTweets(payload: unknown): XTweet[] {
  const tweets: XTweet[] = [];
  const seen = new Set<string>();

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (obj.__typename === 'Tweet' && obj.rest_id && typeof obj.legacy === 'object') {
      const legacy = obj.legacy as Record<string, unknown>;
      const id = String(obj.rest_id);
      if (seen.has(id)) return;
      seen.add(id);
      const userLegacy =
        typeof obj.core === 'object' &&
        obj.core &&
        typeof (obj.core as Record<string, unknown>).user_results === 'object'
          ? (((obj.core as Record<string, unknown>).user_results as Record<string, unknown>).result as Record<
              string,
              unknown
            >)?.legacy
          : undefined;
      tweets.push({
        id,
        text: String(legacy.full_text ?? legacy.text ?? ''),
        createdAt: legacy.created_at ? String(legacy.created_at) : undefined,
        user: userLegacy
          ? { screen_name: String((userLegacy as Record<string, unknown>).screen_name ?? '') }
          : undefined,
        favorite_count: Number(legacy.favorite_count ?? 0),
        reply_count: Number(legacy.reply_count ?? 0),
      });
      return;
    }
    for (const value of Object.values(obj)) walk(value);
  }

  walk(payload);
  return tweets;
}

function toTopic(tweet: XTweet, queryId: string): Topic {
  const text = tweet.text;
  const username = tweet.user?.screen_name;
  const url = username ? `https://x.com/${username}/status/${tweet.id}` : `https://x.com/i/web/status/${tweet.id}`;
  const classified = classifyThread(text, username, {
    likes: tweet.favorite_count,
    comments: tweet.reply_count,
  });
  return {
    id: topicId('x', url),
    source: 'x',
    title: text.slice(0, 180),
    snippet: text.slice(0, 500),
    url,
    externalId: tweet.id,
    author: username ? `@${username}` : undefined,
    postedAt: tweet.createdAt ? new Date(tweet.createdAt).toISOString() : undefined,
    queryId,
    engagement: { likes: tweet.favorite_count, comments: tweet.reply_count, score: tweet.favorite_count },
    fit: classified.fit,
    skipReason: classified.skipReason,
    angle: classified.angle,
    tone: classified.tone,
    fetchedAt: new Date().toISOString(),
  };
}

export async function searchXTopics(
  queries: Array<{ id: string; xQuery: string }>,
  onStep?: (step: string) => void,
): Promise<Topic[]> {
  const session = xSessionPath();
  if (!session) throw new Error('No X session. Paste auth_token and ct0, or log in via wallet-research.');

  const playwright = await import('playwright');
  const browser = await playwright.chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ storageState: session });
  const page = await context.newPage();
  const collected: Topic[] = [];
  const seen = new Set<string>();

  try {
    for (const query of queries) {
      onStep?.(`X: ${query.xQuery.slice(0, 80)}`);
      const batch = new Map<string, XTweet>();
      const onResponse = async (response: { url: () => string; json: () => Promise<unknown> }) => {
        const url = response.url();
        if (!url.includes('SearchTimeline') && !url.includes('SearchAdaptive')) return;
        try {
          const json = await response.json();
          for (const tweet of extractTweets(json)) batch.set(tweet.id, tweet);
        } catch {
          // ignore non-json
        }
      };
      page.on('response', onResponse);
      await page.goto(`https://x.com/search?q=${encodeURIComponent(query.xQuery)}&src=typed_query&f=live`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      await sleep(2500);
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await sleep(1500);
      page.off('response', onResponse);
      for (const tweet of batch.values()) {
        const key = `${query.id}:${tweet.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push(toTopic(tweet, query.id));
      }
    }
  } finally {
    await browser.close();
  }

  return collected;
}
