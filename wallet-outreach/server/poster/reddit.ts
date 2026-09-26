import { loadAuth } from '../storage.js';

const USER_AGENT = 'wallet-outreach/1.0 (1337 wallet; local outreach)';

interface TokenResponse {
  access_token?: string;
  error?: string;
  message?: string;
}

export async function redditUserToken(): Promise<string> {
  const auth = await loadAuth();
  const clientId = auth.redditClientId || process.env.REDDIT_CLIENT_ID;
  const clientSecret = auth.redditClientSecret || process.env.REDDIT_CLIENT_SECRET || '';
  if (!clientId) throw new Error('Reddit app client id is missing');

  const body = new URLSearchParams();
  if (auth.redditRefreshToken || process.env.REDDIT_REFRESH_TOKEN) {
    body.set('grant_type', 'refresh_token');
    body.set('refresh_token', (auth.redditRefreshToken || process.env.REDDIT_REFRESH_TOKEN)!);
  } else if (auth.redditUsername && auth.redditPassword) {
    body.set('grant_type', 'password');
    body.set('username', auth.redditUsername);
    body.set('password', auth.redditPassword);
  } else {
    throw new Error('Add a Reddit refresh token, or a script-app username and password');
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body,
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || !json.access_token) {
    throw new Error(json.message || json.error || `Reddit auth failed (${res.status})`);
  }
  return json.access_token;
}

export async function postRedditComment(fullname: string, text: string): Promise<string> {
  const token = await redditUserToken();
  const body = new URLSearchParams({
    api_type: 'json',
    thing_id: fullname,
    text,
  });
  const res = await fetch('https://oauth.reddit.com/api/comment', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body,
  });
  const json = (await res.json()) as {
    json?: { errors?: unknown[]; data?: { things?: Array<{ data?: { permalink?: string } }> } };
    message?: string;
  };
  const errors = json.json?.errors ?? [];
  if (!res.ok || errors.length) {
    throw new Error(errors.length ? JSON.stringify(errors) : json.message || `Reddit comment failed (${res.status})`);
  }
  const permalink = json.json?.data?.things?.[0]?.data?.permalink;
  return permalink ? `https://www.reddit.com${permalink}` : `https://www.reddit.com/comments/${fullname.replace(/^t3_/, '')}`;
}

export async function redditAuthReady(): Promise<boolean> {
  const auth = await loadAuth();
  const clientId = auth.redditClientId || process.env.REDDIT_CLIENT_ID;
  const hasUser =
    Boolean(auth.redditRefreshToken || process.env.REDDIT_REFRESH_TOKEN) ||
    Boolean(auth.redditUsername && auth.redditPassword);
  return Boolean(clientId && hasUser);
}
