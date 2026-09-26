import { randomUUID } from 'node:crypto';
import { postXReply } from './poster/x.js';
import { searchRedditTopics } from './search/reddit.js';
import { searchXTopics, xSessionPath } from './search/x.js';
import { loadStore, postsToday, updateStore, upsertTopic } from './storage.js';
import type { Draft, JobState, Moment, Store, Tone, Topic } from './types.js';
import { QUERIES, classifyThread, postBlockReason } from './voice.js';
import { writeWithCursor } from './writer.js';

let running = false;
let postTimer: NodeJS.Timeout | null = null;

function rollGapMinutes(min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function scheduleNextPost(store: Store): number {
  const gap = rollGapMinutes(store.settings.minGapMinutes, store.settings.maxGapMinutes ?? store.settings.minGapMinutes);
  store.nextPostAt = new Date(Date.now() + gap * 60_000).toISOString();
  return gap;
}

function gapStillOpen(store: Store): boolean {
  return Boolean(store.nextPostAt && Date.now() < new Date(store.nextPostAt).getTime());
}

function log(store: Store, message: string) {
  store.logs.unshift({ id: randomUUID(), at: new Date().toISOString(), message });
}

async function setJob(patch: Partial<JobState> & Pick<JobState, 'id' | 'kind' | 'status' | 'startedAt'>) {
  await updateStore((store) => {
    store.job = {
      found: 0,
      drafted: 0,
      posted: 0,
      errors: [],
      ...store.job,
      ...patch,
    };
  });
}

function avoidBodies(store: Store, topicId: string): string[] {
  return store.drafts.filter((d) => d.topicId !== topicId && d.status !== 'skipped').map((d) => d.body);
}

async function composeDraft(topic: Topic, avoid: string[]): Promise<{ angle: Moment; tone: Tone; body: string }> {
  const text = `${topic.title}\n${topic.snippet}`;
  const classified = classifyThread(text, topic.author, topic.engagement);
  const angle = topic.angle ?? classified.angle ?? 'share';
  const tone = topic.tone ?? classified.tone ?? 'note';
  const body = await writeWithCursor({
    title: topic.title,
    snippet: topic.snippet,
    source: topic.source,
    tone,
    angle,
    avoid,
  });
  return { angle, tone, body };
}

function saveDraft(store: Store, topic: Topic, built: { angle: Moment; tone: Tone; body: string }): Draft {
  const existing = store.drafts.find((d) => d.topicId === topic.id);
  const now = new Date().toISOString();
  const draft: Draft = {
    id: existing?.id ?? randomUUID(),
    topicId: topic.id,
    body: built.body,
    angle: built.angle,
    tone: built.tone,
    status: existing?.status === 'approved' ? 'approved' : 'suggested',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  if (existing) {
    const idx = store.drafts.findIndex((d) => d.id === existing.id);
    store.drafts[idx] = draft;
  } else {
    store.drafts.unshift(draft);
  }
  return draft;
}

/** Another reply for the same post. The current draft stays. */
export async function addDraftVersion(topicId: string): Promise<Draft> {
  const store = await loadStore();
  const topic = store.topics.find((t) => t.id === topicId);
  if (!topic) throw new Error('Thread not found');
  if (topic.fit !== 'reply') throw new Error(topic.skipReason || 'This thread is not one we reply on');
  const avoid = store.drafts.filter((d) => d.status !== 'skipped').map((d) => d.body);
  const built = await composeDraft(topic, avoid);
  return updateStore((s) => {
    const now = new Date().toISOString();
    const draft: Draft = {
      id: randomUUID(),
      topicId: topic.id,
      body: built.body,
      angle: built.angle,
      tone: built.tone,
      status: 'suggested',
      createdAt: now,
      updatedAt: now,
    };
    s.drafts.unshift(draft);
    log(s, `New reply version for ${topic.url}`);
    return draft;
  });
}

async function draftOne(topic: Topic, replace: boolean): Promise<Draft | null> {
  const store = await updateStore((s) => s);
  const existing = store.drafts.find((d) => d.topicId === topic.id);
  if (topic.fit !== 'reply') return null;
  if (existing?.status === 'posted') return null;
  if (existing && !replace && existing.status !== 'failed') return null;
  const built = await composeDraft(topic, avoidBodies(store, topic.id));
  return updateStore((s) => {
    const current = s.drafts.find((d) => d.topicId === topic.id);
    if (current?.status === 'posted') return null;
    return saveDraft(s, topic, built);
  });
}

export async function ingestTopics(topics: Topic[], replaceDrafts: boolean): Promise<{ found: number; drafted: number }> {
  const pending: Topic[] = [];
  const found = await updateStore((store) => {
    let replyWorthy = 0;
    for (const topic of topics) {
      const saved = upsertTopic(store, topic);
      if (saved.fit === 'reply') replyWorthy += 1;
      const existing = store.drafts.find((d) => d.topicId === saved.id);
      if (saved.fit !== 'reply') {
        if (existing && existing.status !== 'posted') {
          existing.status = 'skipped';
          existing.error = saved.skipReason;
          existing.updatedAt = new Date().toISOString();
        }
        continue;
      }
      if (existing?.status === 'posted') continue;
      if (existing && !replaceDrafts && existing.status !== 'failed') continue;
      pending.push(saved);
    }
    return replyWorthy;
  });
  let drafted = 0;
  for (const topic of pending) {
    try {
      if (await draftOne(topic, replaceDrafts)) drafted += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await updateStore((store) => {
        const existing = store.drafts.find((d) => d.topicId === topic.id);
        if (existing && existing.status !== 'posted') {
          existing.error = message;
          existing.updatedAt = new Date().toISOString();
        }
        log(store, `Draft failed: ${message}`);
      });
    }
  }
  return { found, drafted };
}

export async function runSearch(options?: { queryIds?: string[]; sources?: Array<'reddit' | 'x'> }): Promise<JobState> {
  if (running) {
    const store = await updateStore((s) => s);
    if (store.job) return store.job;
    throw new Error('A search is already running');
  }
  running = true;
  const jobId = randomUUID();
  const startedAt = new Date().toISOString();
  await setJob({ id: jobId, kind: 'search', status: 'running', startedAt, step: 'Starting', found: 0, drafted: 0, posted: 0, errors: [] });

  const store = await updateStore((s) => s);
  const sources = options?.sources ?? [
    ...(store.settings.includeReddit ? (['reddit'] as const) : []),
    ...(store.settings.includeX ? (['x'] as const) : []),
  ];
  const queries = QUERIES.filter((q) => !options?.queryIds?.length || options.queryIds.includes(q.id));
  const errors: string[] = [];
  let found = 0;
  let drafted = 0;

  try {
    if (sources.includes('reddit')) {
      for (const query of queries) {
        await setJob({ id: jobId, kind: 'search', status: 'running', startedAt, step: query.label, found, drafted, posted: 0, errors });
        const topics = await searchRedditTopics(query, (step) => {
          void setJob({ id: jobId, kind: 'search', status: 'running', startedAt, step, found, drafted, posted: 0, errors });
        });
        const saved = await ingestTopics(topics, false);
        found += saved.found;
        drafted += saved.drafted;
      }
    }
    if (sources.includes('x')) {
      if (!xSessionPath()) {
        errors.push('X skipped: paste auth_token and ct0, or use the wallet-research session');
      } else {
        await setJob({ id: jobId, kind: 'search', status: 'running', startedAt, step: 'X search', found, drafted, posted: 0, errors });
        try {
          const topics = await searchXTopics(queries, (step) => {
            void setJob({ id: jobId, kind: 'search', status: 'running', startedAt, step, found, drafted, posted: 0, errors });
          });
          const saved = await ingestTopics(topics, false);
          found += saved.found;
          drafted += saved.drafted;
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err));
        }
      }
    }
    const finished = await updateStore((s) => {
      log(s, `Search finished: ${found} reply-worthy threads, ${drafted} new drafts`);
      s.job = {
        id: jobId,
        kind: 'search',
        status: 'completed',
        startedAt,
        finishedAt: new Date().toISOString(),
        step: 'Done',
        found,
        drafted,
        posted: 0,
        errors,
      };
      return s.job;
    });
    return finished;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return updateStore((s) => {
      s.job = {
        id: jobId,
        kind: 'search',
        status: 'failed',
        startedAt,
        finishedAt: new Date().toISOString(),
        step: message,
        found,
        drafted,
        posted: 0,
        errors: [...errors, message],
      };
      return s.job;
    });
  } finally {
    running = false;
  }
}

export async function draftMissing(topicId?: string): Promise<number> {
  const store = await loadStore();
  const topics = store.topics.filter((t) => t.fit === 'reply' && (!topicId || t.id === topicId));
  let count = 0;
  for (const topic of topics) {
    try {
      if (await draftOne(topic, Boolean(topicId))) count += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await updateStore((s) => {
        const existing = s.drafts.find((d) => d.topicId === topic.id);
        if (existing && existing.status !== 'posted') {
          existing.error = message;
          existing.updatedAt = new Date().toISOString();
        }
        log(s, `Draft failed: ${message}`);
      });
    }
  }
  if (count) {
    await updateStore((s) => {
      log(s, `Drafted ${count} comment${count === 1 ? '' : 's'}`);
    });
  }
  return count;
}

/** Replace open suggested replies with Cursor agent drafts. Posted replies stay. */
export async function rewriteSuggested(): Promise<number> {
  const store = await loadStore();
  const topics = store.drafts
    .filter((d) => d.status === 'suggested')
    .map((d) => store.topics.find((t) => t.id === d.topicId))
    .filter((t): t is Topic => Boolean(t && t.fit === 'reply'));
  let count = 0;
  const queue = [...topics];
  async function worker() {
    for (;;) {
      const topic = queue.shift();
      if (!topic) return;
      try {
        if (await draftOne(topic, true)) {
          count += 1;
          console.log(`Cursor reply ${count}/${topics.length}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Cursor reply failed: ${message}`);
        await updateStore((s) => {
          const existing = s.drafts.find((d) => d.topicId === topic.id);
          if (existing && existing.status === 'suggested') {
            existing.error = message;
            existing.updatedAt = new Date().toISOString();
          }
          log(s, `Draft failed: ${message}`);
        });
      }
    }
  }
  await Promise.all([worker(), worker()]);
  if (count) {
    await updateStore((s) => {
      log(s, `Cursor agent rewrote ${count} suggested repl${count === 1 ? 'y' : 'ies'}`);
    });
  }
  return count;
}

function eligibleDraft(store: Store): Draft | null {
  const open = store.drafts.filter((d) => d.status === 'approved' || (store.settings.autoApprove && d.status === 'suggested'));
  open.sort((a, b) => {
    const likes = (id: string) => store.topics.find((t) => t.id === id)?.engagement?.likes ?? 0;
    return likes(b.topicId) - likes(a.topicId) || a.createdAt.localeCompare(b.createdAt);
  });
  for (const draft of open) {
    const topic = store.topics.find((t) => t.id === draft.topicId);
    if (!topic || topic.fit !== 'reply') continue;
    if (topic.source === 'reddit') continue;
    if (postBlockReason(draft.body, topic.source)) continue;
    if (store.settings.dryRun && draft.rehearsedAt) continue;
    return draft;
  }
  return null;
}

export async function publishDraft(draftId: string, force = false): Promise<Draft> {
  const store = await updateStore((s) => s);
  const draft = store.drafts.find((d) => d.id === draftId);
  if (!draft) throw new Error('Draft not found');
  const topic = store.topics.find((t) => t.id === draft.topicId);
  if (!topic) throw new Error('Thread not found');
  const blocked = postBlockReason(draft.body, topic.source);
  if (blocked) throw new Error(blocked);
  if (topic.fit !== 'reply') throw new Error(topic.skipReason || 'This thread is not one we reply on');

  const settings = store.settings;
  if (!force) {
    if (postsToday(store.drafts) >= settings.maxPerDay) throw new Error(`Daily cap is ${settings.maxPerDay}`);
    if (gapStillOpen(store)) {
      const mins = Math.max(1, Math.ceil((new Date(store.nextPostAt!).getTime() - Date.now()) / 60_000));
      throw new Error(`Next reply in about ${mins} minutes`);
    }
  }

  if (settings.dryRun && !force) {
    return updateStore((s) => {
      const row = s.drafts.find((d) => d.id === draftId)!;
      row.rehearsedAt = new Date().toISOString();
      row.updatedAt = row.rehearsedAt;
      row.error = undefined;
      const gap = scheduleNextPost(s);
      log(s, `Dry run (${topic.source}): would reply on ${topic.url}. Next wait ${gap} min`);
      return row;
    });
  }

  try {
    let postUrl: string | undefined;
    if (topic.source === 'reddit') {
      throw new Error('Reddit replies are pasted by hand. Open the thread and paste the copied text.');
    } else {
      if (!xSessionPath()) throw new Error('X session is not set');
      await postXReply(topic.url, draft.body);
      postUrl = topic.url;
    }
    return updateStore((s) => {
      const row = s.drafts.find((d) => d.id === draftId)!;
      row.status = 'posted';
      row.postedAt = new Date().toISOString();
      row.updatedAt = row.postedAt;
      row.postUrl = postUrl;
      row.error = undefined;
      const gap = scheduleNextPost(s);
      log(s, `Posted on ${topic.source}: ${topic.url}. Next wait ${gap} min`);
      return row;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return updateStore((s) => {
      const row = s.drafts.find((d) => d.id === draftId)!;
      row.status = 'failed';
      row.error = message;
      row.updatedAt = new Date().toISOString();
      log(s, `Post failed (${topic.source}): ${message}`);
      return row;
    });
  }
}

/** Record a Reddit reply the user pasted themselves. Does not call Reddit. */
export async function markRedditPosted(draftId: string): Promise<Draft> {
  const store = await updateStore((s) => s);
  const draft = store.drafts.find((d) => d.id === draftId);
  if (!draft) throw new Error('Draft not found');
  const topic = store.topics.find((t) => t.id === draft.topicId);
  if (!topic || topic.source !== 'reddit') throw new Error('Only a Reddit draft can be marked posted by hand');
  return updateStore((s) => {
    const row = s.drafts.find((d) => d.id === draftId)!;
    row.status = 'posted';
    row.postedAt = new Date().toISOString();
    row.updatedAt = row.postedAt;
    row.postUrl = topic.url;
    row.error = undefined;
    log(s, `Marked Reddit reply as pasted: ${topic.url}`);
    return row;
  });
}

/** One agent step: search the next topic query, draft replies, maybe post one. */
export async function runTick(): Promise<JobState> {
  if (running) {
    const store = await updateStore((s) => s);
    if (store.job) return store.job;
    throw new Error('A loop tick is already running');
  }
  running = true;
  const jobId = randomUUID();
  const startedAt = new Date().toISOString();
  try {
    const snapshot = await updateStore((s) => s);
    const query = QUERIES[snapshot.cursor % QUERIES.length]!;
    await updateStore((s) => {
      s.cursor = (s.cursor + 1) % QUERIES.length;
    });
    await setJob({
      id: jobId,
      kind: 'tick',
      status: 'running',
      startedAt,
      step: query.label,
      found: 0,
      drafted: 0,
      posted: 0,
      errors: [],
    });

    const topics: Topic[] = [];
    const errors: string[] = [];
    if (snapshot.settings.includeReddit) {
      topics.push(...(await searchRedditTopics(query)));
    }
    if (snapshot.settings.includeX && xSessionPath()) {
      try {
        topics.push(...(await searchXTopics([query])));
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    } else if (snapshot.settings.includeX) {
      errors.push('X skipped: no session');
    }

    const saved = await ingestTopics(topics, false);
    let posted = 0;
    const after = await updateStore((s) => s);
    const next = eligibleDraft(after);
    if (next && after.settings.autopilot && !gapStillOpen(after)) {
      const result = await publishDraft(next.id);
      posted = result.status === 'posted' || result.rehearsedAt ? 1 : 0;
    }

    return updateStore((s) => {
      const mode = s.settings.autopilot ? (s.settings.dryRun ? 'autopilot dry-run' : 'autopilot') : 'draft only';
      log(
        s,
        `Tick “${query.label}” (${mode}): ${saved.found} threads, ${saved.drafted} drafts, ${posted} send${errors.length ? ` — ${errors[0]}` : ''}`,
      );
      s.job = {
        id: jobId,
        kind: 'tick',
        status: 'completed',
        startedAt,
        finishedAt: new Date().toISOString(),
        step: query.label,
        found: saved.found,
        drafted: saved.drafted,
        posted,
        errors,
      };
      return s.job;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return updateStore((s) => {
      s.job = {
        id: jobId,
        kind: 'tick',
        status: 'failed',
        startedAt,
        finishedAt: new Date().toISOString(),
        step: message,
        found: 0,
        drafted: 0,
        posted: 0,
        errors: [message],
      };
      log(s, `Tick failed: ${message}`);
      return s.job;
    });
  } finally {
    running = false;
  }
}

export async function rescoreStoredTopics(): Promise<number> {
  return updateStore((store) => {
    let changed = 0;
    for (const topic of store.topics) {
      const classified = classifyThread(`${topic.title}\n${topic.snippet}`, topic.author, topic.engagement);
      const fit = classified.fit;
      const skip = classified.skipReason;
      const angle = classified.angle;
      const tone = classified.tone;
      const changedThis = fit !== topic.fit || skip !== topic.skipReason || angle !== topic.angle || tone !== topic.tone;
      if (changedThis) {
        topic.fit = fit;
        topic.skipReason = skip;
        topic.angle = angle;
        topic.tone = tone;
        changed += 1;
      }
      const existing = store.drafts.find((d) => d.topicId === topic.id);
      if (existing && existing.status !== 'posted' && fit !== 'reply') {
        existing.status = 'skipped';
        existing.error = skip;
        existing.updatedAt = new Date().toISOString();
      }
    }
    if (changed) log(store, `Re-checked ${changed} threads. Replies have to be specific, and no two can match.`);
    return changed;
  });
}

let timer: NodeJS.Timeout | null = null;

/** Send one due reply without searching. The wait was chosen at random after the previous send. */
export async function maybePostOne(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const store = await loadStore();
    if (!store.settings.autopilot || gapStillOpen(store)) return;
    if (postsToday(store.drafts) >= store.settings.maxPerDay) return;
    const next = eligibleDraft(store);
    if (!next) return;
    await publishDraft(next.id);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
  } finally {
    running = false;
  }
}

export async function syncLoop(): Promise<void> {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (postTimer) {
    clearInterval(postTimer);
    postTimer = null;
  }
  const store = await updateStore((s) => s);
  if (!store.settings.autopilot) return;
  const minutes = Math.max(5, store.settings.loopMinutes || 10);
  timer = setInterval(() => {
    void runTick().catch(() => undefined);
  }, minutes * 60_000);
  postTimer = setInterval(() => {
    void maybePostOne().catch(() => undefined);
  }, 60_000);
}
