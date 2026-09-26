import { topicId } from '../storage.js';
import type { Topic } from '../types.js';
import { classifyThread } from '../voice.js';

const USER_AGENT = 'wallet-outreach/1.0 (local research; 1337 wallet)';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface ArcticPost {
  id?: string;
  title?: string;
  selftext?: string;
  permalink?: string;
  url?: string;
  author?: string;
  subreddit?: string;
  created_utc?: number;
  score?: number;
  num_comments?: number;
}

function classify(
  title: string,
  snippet: string,
  author?: string,
  engagement?: { likes?: number; comments?: number },
): Pick<Topic, 'fit' | 'skipReason' | 'angle' | 'tone'> {
  return classifyThread(`${title}\n${snippet}`, author, engagement);
}

function mapPost(d: ArcticPost, queryId: string): Topic | null {
  if (!d.title || !d.subreddit) return null;
  const permalink = d.permalink?.startsWith('/')
    ? `https://www.reddit.com${d.permalink}`
    : d.permalink || d.url || '';
  const url = permalink.startsWith('http')
    ? permalink.split('?')[0]!
    : `https://www.reddit.com/r/${d.subreddit}/comments/${d.id}`;
  const snippet = (d.selftext || '').slice(0, 500);
  const classified = classify(d.title, snippet, d.author, { likes: d.score, comments: d.num_comments });
  const redditId = d.id?.replace(/^t3_/, '');
  return {
    id: topicId('reddit', url),
    source: 'reddit',
    title: d.title,
    snippet,
    url,
    externalId: redditId ? `t3_${redditId}` : undefined,
    author: d.author,
    community: `r/${d.subreddit}`,
    postedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : undefined,
    queryId,
    engagement: { score: d.score, comments: d.num_comments },
    fetchedAt: new Date().toISOString(),
    ...classified,
  };
}

async function arcticSearch(subreddit: string, query: string): Promise<ArcticPost[]> {
  const after = new Date();
  after.setMonth(after.getMonth() - 6);
  const qs = new URLSearchParams({
    subreddit: subreddit.toLowerCase(),
    query,
    after: after.toISOString().slice(0, 10),
    limit: '25',
    sort: 'desc',
  });
  const res = await fetch(`https://arctic-shift.photon-reddit.com/api/posts/search?${qs}`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: ArcticPost[] };
  return json.data ?? [];
}

export async function searchRedditTopics(
  spec: { id: string; seeds: string[]; subs: string[] },
  onStep?: (step: string) => void,
): Promise<Topic[]> {
  const seen = new Set<string>();
  const topics: Topic[] = [];
  for (const sub of spec.subs) {
    for (const seed of spec.seeds) {
      onStep?.(`Reddit r/${sub}: ${seed}`);
      try {
        const rows = await arcticSearch(sub, seed);
        for (const row of rows) {
          const topic = mapPost(row, spec.id);
          if (!topic || seen.has(topic.id)) continue;
          seen.add(topic.id);
          topics.push(topic);
        }
      } catch {
        // next seed
      }
      await sleep(450);
    }
  }
  return topics;
}

export function redditFullname(topic: Topic): string | null {
  if (topic.externalId?.startsWith('t3_')) return topic.externalId;
  const match = topic.url.match(/\/comments\/([a-z0-9]+)/i);
  return match ? `t3_${match[1]}` : null;
}
