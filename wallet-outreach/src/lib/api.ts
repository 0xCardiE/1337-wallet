import type { Draft, DraftStatus, JobState, Moment, Settings, Source, Topic } from '../../server/types';

export interface Health {
  ok: boolean;
  redditAuth: boolean;
  xSession: boolean;
  autopilot: boolean;
  autoApprove: boolean;
  dryRun: boolean;
  postedToday: number;
  maxPerDay: number;
  lastPostAt: string | null;
}

export interface State {
  topics: Topic[];
  drafts: Draft[];
  logs: Array<{ id: string; at: string; message: string }>;
  settings: Settings;
  job: JobState | null;
  queries: Array<{ id: string; label: string }>;
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body;
}

export function fetchHealth() {
  return json<Health>('/api/health');
}

export function fetchState() {
  return json<State>('/api/state');
}

export function startSearch(sources: Source[]) {
  return json<{ ok: boolean }>('/api/search', { method: 'POST', body: JSON.stringify({ sources }) });
}

export function draftComments(topicId?: string) {
  return json<{ drafted: number }>('/api/draft', { method: 'POST', body: JSON.stringify({ topicId }) });
}

export function saveSettings(patch: Partial<Settings>) {
  return json<Settings>('/api/settings', { method: 'PATCH', body: JSON.stringify(patch) });
}

export function saveAuth(body: {
  redditClientId?: string;
  redditClientSecret?: string;
  redditUsername?: string;
  redditPassword?: string;
  redditRefreshToken?: string;
}) {
  return json<{ redditAuth: boolean }>('/api/auth', { method: 'PUT', body: JSON.stringify(body) });
}

export function saveXSession(authToken: string, ct0: string) {
  return json<{ xSession: boolean }>('/api/x-session', { method: 'POST', body: JSON.stringify({ authToken, ct0 }) });
}

export function updateDraft(id: string, patch: { body?: string; status?: DraftStatus }) {
  return json<Draft>(`/api/drafts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function postDraft(id: string, force = false) {
  return json<Draft>(`/api/drafts/${id}/post`, { method: 'POST', body: JSON.stringify({ force }) });
}

export function runTick() {
  return json<{ ok: boolean }>('/api/loop/tick', { method: 'POST', body: '{}' });
}

export type { Draft, Moment, Settings, Source, Topic };
