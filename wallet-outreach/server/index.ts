import cors from 'cors';
import express from 'express';
import {
  draftMissing,
  markRedditPosted,
  publishDraft,
  rescoreStoredTopics,
  rewriteSuggested,
  runSearch,
  runTick,
  syncLoop,
} from './agent.js';
import { redditAuthReady } from './poster/reddit.js';
import { readXAccount, refreshXAccount, saveXSession } from './poster/x.js';
import { xSessionPath } from './search/x.js';
import { lastPostedAt, loadStore, postsToday, saveAuth, updateStore } from './storage.js';
import type { DraftStatus, Settings } from './types.js';
import { QUERIES } from './voice.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3848);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  const store = await loadStore();
  res.json({
    ok: true,
    redditAuth: await redditAuthReady(),
    xSession: Boolean(xSessionPath()),
    xAccount: await readXAccount(),
    autopilot: store.settings.autopilot,
    autoApprove: store.settings.autoApprove,
    dryRun: store.settings.dryRun,
    postedToday: postsToday(store.drafts),
    maxPerDay: store.settings.maxPerDay,
    lastPostAt: lastPostedAt(store.drafts) ?? null,
  });
});

app.get('/api/state', async (_req, res) => {
  const store = await loadStore();
  res.json({
    topics: store.topics,
    drafts: store.drafts,
    logs: store.logs,
    settings: store.settings,
    job: store.job,
    queries: QUERIES.map((q) => ({ id: q.id, label: q.label })),
  });
});

app.patch('/api/settings', async (req, res) => {
  const patch = req.body as Partial<Settings>;
  const settings = await updateStore((store) => {
    store.settings = {
      ...store.settings,
      ...patch,
      maxPerDay: clamp(patch.maxPerDay ?? store.settings.maxPerDay, 1, 12),
      minGapMinutes: clamp(patch.minGapMinutes ?? store.settings.minGapMinutes, 15, 24 * 60),
      loopMinutes: clamp(patch.loopMinutes ?? store.settings.loopMinutes, 10, 24 * 60),
    };
    return store.settings;
  });
  await syncLoop();
  res.json(settings);
});

app.put('/api/auth', async (req, res) => {
  const body = req.body as {
    redditClientId?: string;
    redditClientSecret?: string;
    redditUsername?: string;
    redditPassword?: string;
    redditRefreshToken?: string;
  };
  await saveAuth(body);
  res.json({ redditAuth: await redditAuthReady() });
});

app.post('/api/x-session', async (req, res) => {
  const { authToken, ct0 } = req.body as { authToken?: string; ct0?: string };
  if (!authToken || !ct0) {
    res.status(400).json({ error: 'Need auth_token and ct0' });
    return;
  }
  try {
    await saveXSession(authToken, ct0);
    void refreshXAccount();
    res.json({ xSession: true, xAccount: await readXAccount() });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/search', async (req, res) => {
  const { sources } = req.body as { sources?: Array<'reddit' | 'x'> };
  const started = runSearch({ sources });
  const job = await waitForRunning(started);
  res.status(202).json(job ?? { ok: true });
});

app.post('/api/drafts/rewrite', async (_req, res) => {
  try {
    const drafted = await rewriteSuggested();
    res.json({ drafted });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/draft', async (req, res) => {
  const { topicId } = req.body as { topicId?: string };
  const drafted = await draftMissing(topicId);
  const store = await loadStore();
  res.json({ drafted, drafts: store.drafts });
});

app.patch('/api/drafts/:id', async (req, res) => {
  const { body, status } = req.body as { body?: string; status?: DraftStatus };
  const updated = await updateStore((store) => {
    const draft = store.drafts.find((d) => d.id === req.params.id);
    if (!draft) return null;
    if (typeof body === 'string') draft.body = body;
    if (status && ['suggested', 'approved', 'skipped'].includes(status)) draft.status = status;
    draft.updatedAt = new Date().toISOString();
    draft.error = undefined;
    if (status === 'suggested') draft.rehearsedAt = undefined;
    return draft;
  });
  if (!updated) {
    res.status(404).json({ error: 'Draft not found' });
    return;
  }
  res.json(updated);
});

app.post('/api/drafts/:id/mark-posted', async (req, res) => {
  try {
    const draft = await markRedditPosted(req.params.id);
    res.json(draft);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/drafts/:id/post', async (req, res) => {
  const { force } = req.body as { force?: boolean };
  try {
    const draft = await publishDraft(req.params.id, Boolean(force));
    res.json(draft);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/loop/tick', async (_req, res) => {
  const started = runTick();
  const job = await waitForRunning(started);
  res.status(202).json(job ?? { ok: true });
});

async function waitForRunning(started: Promise<unknown>) {
  for (let i = 0; i < 40; i++) {
    const store = await loadStore();
    if (store.job?.status === 'running') return store.job;
    await new Promise((r) => setTimeout(r, 25));
  }
  void started.catch(() => undefined);
  return null;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

app.listen(PORT, () => {
  console.log(`wallet-outreach API http://localhost:${PORT}`);
  void rescoreStoredTopics()
    .then(() => syncLoop())
    .catch((err) => console.error(err));
  void refreshXAccount().catch(() => undefined);
});
