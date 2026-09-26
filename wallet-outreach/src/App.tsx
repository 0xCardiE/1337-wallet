import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  draftComments,
  fetchHealth,
  fetchState,
  postDraft,
  runTick,
  saveAuth,
  saveSettings,
  saveXSession,
  startSearch,
  updateDraft,
  type Draft,
  type Health,
  type Settings,
  type Source,
  type State,
  type Topic,
} from './lib/api';

function formatDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [filter, setFilter] = useState<'suggested' | 'approved' | 'posted' | 'held' | 'skipped' | 'all'>('suggested');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [reddit, setReddit] = useState({
    clientId: '',
    clientSecret: '',
    username: '',
    password: '',
    refreshToken: '',
  });
  const [xAuth, setXAuth] = useState('');
  const [xCt0, setXCt0] = useState('');
  const [bodies, setBodies] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const [h, s] = await Promise.all([fetchHealth(), fetchState()]);
    setHealth(h);
    setState(s);
    setBodies((prev) => {
      const next = { ...prev };
      for (const draft of s.drafts) {
        if (next[draft.id] === undefined) next[draft.id] = draft.body;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    void refresh().catch((err) => setNotice(err instanceof Error ? err.message : String(err)));
  }, [refresh]);

  useEffect(() => {
    if (state?.job?.status !== 'running') return;
    const timer = setInterval(() => {
      void refresh();
    }, 2000);
    return () => clearInterval(timer);
  }, [state?.job?.status, refresh]);

  const topicsById = useMemo(() => {
    const map = new Map<string, Topic>();
    for (const topic of state?.topics ?? []) map.set(topic.id, topic);
    return map;
  }, [state]);

  const rows = useMemo(() => {
    const drafts = state?.drafts ?? [];
    const filtered = drafts.filter((draft) => {
      if (filter === 'all') return true;
      if (filter === 'suggested') return draft.status === 'suggested' || draft.status === 'failed';
      return draft.status === filter;
    });
    if (filter === 'suggested') {
      filtered.sort((a, b) => {
        const likes = (id: string) => topicsById.get(id)?.engagement?.likes ?? 0;
        return likes(a.topicId) - likes(b.topicId);
      });
    }
    return filtered;
  }, [state, filter, topicsById]);

  const replyCount = (state?.topics ?? []).filter((t) => t.fit === 'reply').length;
  const held = (state?.topics ?? []).filter((t) => t.fit === 'skip');

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setNotice('');
    try {
      await fn();
      await refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('');
    }
  }

  async function saveVoice(patch: Partial<Settings>) {
    await act('save', () => saveSettings(patch));
  }

  const running = state?.job?.status === 'running';

  return (
    <div className="app-shell">
      <header className="header">
        <div>
          <h1>@1337wallet</h1>
          <p>
            Reply to people talking about crypto, chains, and wallets, especially posts with no likes yet. Each reply
            is about what they wrote. Nothing sends until you approve it. Dry-run stays on until you turn it off.
          </p>
        </div>
        <div className="pill-row">
          <span className={`pill ${health?.redditAuth ? 'ok' : 'warn'}`}>
            Reddit {health?.redditAuth ? 'ready' : 'no auth'}
          </span>
          <span className={`pill ${health?.xSession ? 'ok' : 'warn'}`}>X {health?.xSession ? 'ready' : 'no session'}</span>
          <span className="pill">
            {health?.postedToday ?? 0}/{health?.maxPerDay ?? 2} posted today
          </span>
        </div>
      </header>

      {running && (
        <div className="job-banner running">
          <strong>{state?.job?.kind === 'tick' ? 'Loop tick' : 'Search'} running</strong> — {state?.job?.step}
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            {state?.job?.found ?? 0} threads · {state?.job?.drafted ?? 0} new drafts
          </div>
        </div>
      )}

      {notice && <div className="job-banner">{notice}</div>}

      <div className="layout">
        <aside className="panel">
          <h2>What we watch</h2>
          <ul className="log-list">
            <li>Quiet posts about a wallet, a chain, or something they just tried</li>
            <li>People sharing a setup, with few or no likes</li>
            <li>Security, approvals, and what a transaction is asking</li>
          </ul>
          <p className="hint">
            Each reply uses their words, and no two replies are the same. A plug names 1337 only when they are choosing
            a wallet. Posts that already have a crowd stay held. The X session has to be @1337wallet.
          </p>

          <h2 style={{ marginTop: 22 }}>Find threads</h2>
          <div className="checkbox-row">
            <input
              type="checkbox"
              checked={state?.settings.includeReddit ?? false}
              onChange={(e) => void saveVoice({ includeReddit: e.target.checked })}
            />
            Reddit
          </div>
          <div className="checkbox-row">
            <input
              type="checkbox"
              checked={state?.settings.includeX ?? true}
              onChange={(e) => void saveVoice({ includeX: e.target.checked })}
            />
            X
          </div>
          <button
            className="btn primary"
            disabled={Boolean(busy) || running}
            onClick={() =>
              void act('search', () =>
                startSearch([
                  ...(state?.settings.includeReddit ? (['reddit'] as Source[]) : []),
                  ...(state?.settings.includeX ? (['x'] as Source[]) : []),
                ]),
              )
            }
          >
            Search topics
          </button>
          <button
            className="btn"
            style={{ marginLeft: 8 }}
            disabled={Boolean(busy) || running}
            onClick={() => void act('tick', () => runTick())}
          >
            One loop tick
          </button>
          <p className="hint" style={{ marginTop: 10 }}>
            {replyCount} threads worth a reply. {held.length} held. A tick searches the next topic and drafts when
            the post is about a wallet, its security, or a transaction. Nothing posts unless autopilot is on.
          </p>

          <h2 style={{ marginTop: 8 }}>Posting</h2>
          <div className="checkbox-row">
            <input
              type="checkbox"
              checked={state?.settings.dryRun ?? true}
              onChange={(e) => void saveVoice({ dryRun: e.target.checked })}
            />
            Dry run (log the reply, do not send)
          </div>
          <div className="checkbox-row">
            <input
              type="checkbox"
              checked={state?.settings.autopilot ?? false}
              onChange={(e) => void saveVoice({ autopilot: e.target.checked })}
            />
            Autopilot while this server is running
          </div>
          <div className="checkbox-row">
            <input
              type="checkbox"
              checked={state?.settings.autoApprove ?? false}
              onChange={(e) => void saveVoice({ autoApprove: e.target.checked })}
            />
            Also send suggested drafts, not only approved ones
          </div>
          <div className="field">
            <label>Max posts per day</label>
            <input
              type="number"
              min={1}
              max={12}
              value={state?.settings.maxPerDay ?? 2}
              onChange={(e) => void saveVoice({ maxPerDay: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>Minutes between posts</label>
            <input
              type="number"
              min={15}
              value={state?.settings.minGapMinutes ?? 180}
              onChange={(e) => void saveVoice({ minGapMinutes: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>Loop every (minutes)</label>
            <input
              type="number"
              min={10}
              value={state?.settings.loopMinutes ?? 30}
              onChange={(e) => void saveVoice({ loopMinutes: Number(e.target.value) })}
            />
          </div>
          <p className="hint">
            Leave the dev server open, or run <code>npm run loop</code> in wallet-outreach. The loop stops when that
            process stops.
          </p>

          <h2>Reddit auth</h2>
          <p className="hint">
            A script app: client id, secret, and either a refresh token or the account username and password. Stored in
            data/auth.json, not in git.
          </p>
          <div className="field">
            <label>Client id</label>
            <input value={reddit.clientId} onChange={(e) => setReddit({ ...reddit, clientId: e.target.value })} />
          </div>
          <div className="field">
            <label>Client secret</label>
            <input
              type="password"
              value={reddit.clientSecret}
              onChange={(e) => setReddit({ ...reddit, clientSecret: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Refresh token</label>
            <input
              type="password"
              value={reddit.refreshToken}
              onChange={(e) => setReddit({ ...reddit, refreshToken: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Username</label>
            <input value={reddit.username} onChange={(e) => setReddit({ ...reddit, username: e.target.value })} />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={reddit.password}
              onChange={(e) => setReddit({ ...reddit, password: e.target.value })}
            />
          </div>
          <button
            className="btn"
            disabled={Boolean(busy)}
            onClick={() =>
              void act('reddit', async () => {
                await saveAuth({
                  redditClientId: reddit.clientId,
                  redditClientSecret: reddit.clientSecret,
                  redditUsername: reddit.username,
                  redditPassword: reddit.password,
                  redditRefreshToken: reddit.refreshToken,
                });
                setReddit({ clientId: '', clientSecret: '', username: '', password: '', refreshToken: '' });
                setNotice('Reddit auth saved');
              })
            }
          >
            Save Reddit auth
          </button>

          <h2 style={{ marginTop: 22 }}>X session</h2>
          <p className="hint">
            Cookies named auth_token and ct0 from x.com while logged in as @1337wallet. If this folder has none, it
            reuses the wallet-research session file — that file has to be the same account.
          </p>
          <div className="field">
            <label>auth_token</label>
            <input type="password" value={xAuth} onChange={(e) => setXAuth(e.target.value)} />
          </div>
          <div className="field">
            <label>ct0</label>
            <input type="password" value={xCt0} onChange={(e) => setXCt0(e.target.value)} />
          </div>
          <button
            className="btn"
            disabled={Boolean(busy)}
            onClick={() =>
              void act('x', async () => {
                await saveXSession(xAuth.trim(), xCt0.trim());
                setXAuth('');
                setXCt0('');
                setNotice('X session saved');
              })
            }
          >
            Save X session
          </button>

          <h2 style={{ marginTop: 22 }}>Loop log</h2>
          <ul className="log-list">
            {(state?.logs ?? []).map((entry) => (
              <li key={entry.id}>
                {formatDate(entry.at)} — {entry.message}
              </li>
            ))}
          </ul>
        </aside>

        <section>
          <div className="filters">
            {(['suggested', 'approved', 'posted', 'held', 'skipped', 'all'] as const).map((key) => (
              <button key={key} className={`btn small ${filter === key ? 'primary' : ''}`} onClick={() => setFilter(key)}>
                {key}
              </button>
            ))}
          </div>

          <div className="post-list">
            {filter === 'held' &&
              held.map((topic) => (
                <article key={topic.id} className="post-card">
                  <div className="post-meta">
                    <span className={`badge ${topic.source}`}>{topic.source}</span>
                    <span className="badge">held</span>
                    {topic.community && <span className="badge">{topic.community}</span>}
                  </div>
                  <h3 className="post-title">
                    <a href={topic.url} target="_blank" rel="noreferrer">
                      {topic.title}
                    </a>
                  </h3>
                  {topic.snippet && <p className="post-snippet">{topic.snippet}</p>}
                  <p className="hint" style={{ marginBottom: 0 }}>
                    {topic.skipReason}
                  </p>
                </article>
              ))}
            {filter === 'held' && held.length === 0 && (
              <div className="empty">Nothing held yet. Search, and threads that are not a clean complaint land here.</div>
            )}
            {filter !== 'held' && rows.length === 0 && (
              <div className="empty">
                No drafts in this pile. Search looks for complaints. A draft appears only when one matches an insight.
              </div>
            )}
            {rows.map((draft) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                topic={topicsById.get(draft.topicId)}
                body={bodies[draft.id] ?? draft.body}
                busy={Boolean(busy)}
                onBody={(value) => setBodies((prev) => ({ ...prev, [draft.id]: value }))}
                onSave={() =>
                  void act('draft', () => updateDraft(draft.id, { body: bodies[draft.id] ?? draft.body }))
                }
                onStatus={(status) => void act('status', () => updateDraft(draft.id, { status }))}
                onRegen={() =>
                  void act('regen', async () => {
                    await draftComments(draft.topicId);
                    setBodies((prev) => {
                      const next = { ...prev };
                      delete next[draft.id];
                      return next;
                    });
                  })
                }
                dryRun={state?.settings.dryRun ?? true}
                onPost={(force) => void act('post', () => postDraft(draft.id, force))}
                onCopy={async () => {
                  await navigator.clipboard.writeText(bodies[draft.id] ?? draft.body);
                  setNotice('Copied comment');
                }}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function DraftCard({
  draft,
  topic,
  body,
  busy,
  onBody,
  onSave,
  onStatus,
  onRegen,
  dryRun,
  onPost,
  onCopy,
}: {
  draft: Draft;
  topic?: Topic;
  body: string;
  busy: boolean;
  dryRun: boolean;
  onBody: (value: string) => void;
  onSave: () => void;
  onStatus: (status: 'approved' | 'skipped' | 'suggested') => void;
  onRegen: () => void;
  onPost: (force: boolean) => void;
  onCopy: () => void;
}) {
  const over = topic?.source === 'x' && body.length > 280;
  return (
    <article className="post-card">
      <div className="post-meta">
        <span className={`badge ${topic?.source ?? ''}`}>{topic?.source ?? 'thread'}</span>
        <span className="badge">{draft.tone === 'plug' ? 'plug' : 'note'}</span>
        <span className="badge">{draft.angle}</span>
        <span className="badge">{draft.status}</span>
        {topic?.community && <span className="badge">{topic.community}</span>}
        {draft.rehearsedAt && <span className="badge">dry-run {formatDate(draft.rehearsedAt)}</span>}
      </div>
      <h3 className="post-title">
        {topic ? (
          <a href={topic.url} target="_blank" rel="noreferrer">
            {topic.title}
          </a>
        ) : (
          'Missing thread'
        )}
      </h3>
      {topic?.snippet && <p className="post-snippet">{topic.snippet}</p>}
      <textarea className="draft-box" value={body} onChange={(e) => onBody(e.target.value)} />
      <div className="post-actions">
        <span className={`hint ${over ? 'char-count warn' : ''}`} style={{ margin: 0 }}>
          {body.length}
          {topic?.source === 'x' ? '/280' : ''} chars
        </span>
        <button className="btn small" disabled={busy} onClick={onSave}>
          Save edit
        </button>
        <button className="btn small" disabled={busy} onClick={onCopy}>
          Copy
        </button>
        <button className="btn small" disabled={busy} onClick={onRegen}>
          Redraft
        </button>
        {draft.status !== 'approved' && draft.status !== 'posted' && (
          <button className="btn small useful" disabled={busy} onClick={() => onStatus('approved')}>
            Approve
          </button>
        )}
        {draft.status !== 'skipped' && draft.status !== 'posted' && (
          <button className="btn small not-useful" disabled={busy} onClick={() => onStatus('skipped')}>
            Skip
          </button>
        )}
        {draft.status === 'skipped' && (
          <button className="btn small" disabled={busy} onClick={() => onStatus('suggested')}>
            Restore
          </button>
        )}
        {draft.status !== 'posted' && (
          <button className="btn small primary" disabled={busy || over} onClick={() => onPost(false)}>
            {dryRun ? 'Rehearse' : 'Post now'}
          </button>
        )}
        {draft.status !== 'posted' && dryRun && (
          <button className="btn small" disabled={busy || over} onClick={() => onPost(true)}>
            Send for real
          </button>
        )}
        {draft.postUrl && (
          <a href={draft.postUrl} target="_blank" rel="noreferrer">
            Open post
          </a>
        )}
      </div>
      {draft.error && <p className="errors">{draft.error}</p>}
    </article>
  );
}
