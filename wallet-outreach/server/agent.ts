import { randomUUID } from 'node:crypto';
import { postRedditComment, redditAuthReady } from './poster/reddit.js';
import { postXReply } from './poster/x.js';
import { redditFullname, searchRedditTopics } from './search/reddit.js';
import { searchXTopics, xSessionPath } from './search/x.js';
import { lastPostedAt, postsToday, updateStore, upsertTopic } from './storage.js';
import type { Draft, JobState, Store, Topic } from './types.js';
import { QUERIES, buildComment, classifyThread, isMessyReply, isTemplateReply, postBlockReason } from './voice.js';

let running = false;

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

function draftTopic(store: Store, topic: Topic, replace: boolean): Draft | null {
  const existing = store.drafts.find((d) => d.topicId === topic.id);
  if (topic.fit !== 'reply') {
    if (existing && existing.status !== 'posted') {
      existing.status = 'skipped';
      existing.error = topic.skipReason;
      existing.updatedAt = new Date().toISOString();
    }
    return null;
  }
  if (existing?.status === 'posted') return null;
  if (existing && !replace && existing.status !== 'failed') return null;
  const avoid = store.drafts
    .filter((d) => d.topicId !== topic.id && d.status !== 'skipped')
    .map((d) => d.body);
  const built = buildComment(topic, topic.source, avoid);
  if (!built) {
    topic.fit = 'skip';
    topic.skipReason = topic.skipReason || 'Nothing specific to reply to, or it would repeat another reply';
    if (existing) {
      existing.status = 'skipped';
      existing.error = topic.skipReason;
      existing.updatedAt = new Date().toISOString();
    }
    return null;
  }
  const { angle, body, tone } = built;
  const now = new Date().toISOString();
  const draft: Draft = {
    id: existing?.id ?? randomUUID(),
    topicId: topic.id,
    body,
    angle,
    tone,
    status: 'suggested',
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

export async function ingestTopics(topics: Topic[], replaceDrafts: boolean): Promise<{ found: number; drafted: number }> {
  return updateStore((store) => {
    let drafted = 0;
    for (const topic of topics) {
      const saved = upsertTopic(store, topic);
      const draft = draftTopic(store, saved, replaceDrafts);
      if (draft) drafted += 1;
    }
    return { found: topics.filter((t) => t.fit === 'reply').length, drafted };
  });
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
  return updateStore((store) => {
    const topics = store.topics.filter((t) => t.fit === 'reply' && (!topicId || t.id === topicId));
    let count = 0;
    for (const topic of topics) {
      if (draftTopic(store, topic, Boolean(topicId))) count += 1;
    }
    if (count) log(store, `Drafted ${count} comment${count === 1 ? '' : 's'}`);
    return count;
  });
}

function eligibleDraft(store: Store): Draft | null {
  const open = store.drafts.filter((d) => d.status === 'approved' || (store.settings.autoApprove && d.status === 'suggested'));
  open.sort((a, b) => {
    const likes = (id: string) => store.topics.find((t) => t.id === id)?.engagement?.likes ?? 0;
    return likes(a.topicId) - likes(b.topicId) || a.createdAt.localeCompare(b.createdAt);
  });
  for (const draft of open) {
    const topic = store.topics.find((t) => t.id === draft.topicId);
    if (!topic || topic.fit !== 'reply') continue;
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
    const last = lastPostedAt(store.drafts);
    if (last && Date.now() - new Date(last).getTime() < settings.minGapMinutes * 60_000) {
      throw new Error(`Waiting ${settings.minGapMinutes} minutes between posts`);
    }
  }

  if (settings.dryRun && !force) {
    return updateStore((s) => {
      const row = s.drafts.find((d) => d.id === draftId)!;
      row.rehearsedAt = new Date().toISOString();
      row.updatedAt = row.rehearsedAt;
      row.error = undefined;
      log(s, `Dry run (${topic.source}): would reply on ${topic.url}`);
      return row;
    });
  }

  try {
    let postUrl: string | undefined;
    if (topic.source === 'reddit') {
      if (!(await redditAuthReady())) throw new Error('Reddit auth is not set');
      const fullname = redditFullname(topic);
      if (!fullname) throw new Error('Could not read the Reddit post id from the URL');
      postUrl = await postRedditComment(fullname, draft.body);
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
      log(s, `Posted on ${topic.source}: ${topic.url}`);
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
    if (next && after.settings.autopilot) {
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
      const repeated =
        existing &&
        store.drafts.some(
          (d) => d.id !== existing.id && d.status !== 'skipped' && d.body.trim() === existing.body.trim(),
        );
      const stale =
        existing &&
        existing.status !== 'posted' &&
        (changedThis ||
          repeated ||
          isTemplateReply(existing.body) ||
          isMessyReply(existing.body) ||
          Boolean(postBlockReason(existing.body, topic.source)));
      draftTopic(store, topic, Boolean(stale));
    }
    if (changed) log(store, `Re-checked ${changed} threads. Replies have to be specific, and no two can match.`);
    return changed;
  });
}

let timer: NodeJS.Timeout | null = null;

export async function syncLoop(): Promise<void> {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  const store = await updateStore((s) => s);
  if (!store.settings.autopilot) return;
  const minutes = Math.max(10, store.settings.loopMinutes || 30);
  timer = setInterval(() => {
    void runTick().catch(() => undefined);
  }, minutes * 60_000);
}
