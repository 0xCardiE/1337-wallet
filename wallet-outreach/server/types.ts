export type Source = 'reddit' | 'x';

/** What the post is about. */
export type Moment = 'privacy' | 'rpc' | 'signing' | 'approvals' | 'account' | 'wallet' | 'security' | 'transaction' | 'share';

/** Plug names 1337 when they are choosing a wallet. A note is just the useful point. */
export type Tone = 'plug' | 'note';

export type DraftStatus = 'suggested' | 'approved' | 'posted' | 'skipped' | 'failed';

export type Fit = 'reply' | 'skip';

export interface Topic {
  id: string;
  source: Source;
  title: string;
  snippet: string;
  url: string;
  /** Tweet id, or Reddit fullname like t3_abc */
  externalId?: string;
  author?: string;
  community?: string;
  postedAt?: string;
  queryId: string;
  engagement?: {
    score?: number;
    comments?: number;
    likes?: number;
  };
  fit: Fit;
  skipReason?: string;
  angle?: Moment;
  tone?: Tone;
  fetchedAt: string;
}

export interface Draft {
  id: string;
  topicId: string;
  body: string;
  angle: Moment;
  tone: Tone;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
  postedAt?: string;
  rehearsedAt?: string;
  error?: string;
  postUrl?: string;
}

export interface LoopLog {
  id: string;
  at: string;
  message: string;
}

export interface Settings {
  autopilot: boolean;
  /** When autopilot is on, post suggested drafts without a separate Approve click. */
  autoApprove: boolean;
  /** Log the comment that would be posted and do not call Reddit or X. */
  dryRun: boolean;
  maxPerDay: number;
  minGapMinutes: number;
  loopMinutes: number;
  includeX: boolean;
  includeReddit: boolean;
}

export interface AuthSecrets {
  redditClientId?: string;
  redditClientSecret?: string;
  redditUsername?: string;
  redditPassword?: string;
  redditRefreshToken?: string;
  xAuthToken?: string;
  xCt0?: string;
}

export interface OutreachQuery {
  id: string;
  label: string;
  seeds: string[];
  subs: string[];
  xQuery: string;
}

export interface JobState {
  id: string;
  kind: 'search' | 'tick';
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  finishedAt?: string;
  step?: string;
  found: number;
  drafted: number;
  posted: number;
  errors: string[];
}

export interface Store {
  topics: Topic[];
  drafts: Draft[];
  logs: LoopLog[];
  settings: Settings;
  job: JobState | null;
  cursor: number;
}
