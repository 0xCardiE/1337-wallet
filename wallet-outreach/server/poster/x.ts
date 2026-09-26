import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SESSION_FILE } from '../storage.js';
import { xSessionPath } from '../search/x.js';

const ACCOUNT_FILE = fileURLToPath(new URL('../../data/x-account.json', import.meta.url));

export function buildXStorageState(authToken: string, ct0: string) {
  const baseCookie = {
    domain: '.x.com',
    path: '/',
    expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    httpOnly: true,
    secure: true,
    sameSite: 'None' as const,
  };
  return {
    cookies: [
      { ...baseCookie, name: 'auth_token', value: authToken },
      { ...baseCookie, name: 'ct0', value: ct0, httpOnly: false },
    ],
    origins: [],
  };
}

export async function saveXSession(authToken: string, ct0: string): Promise<void> {
  if (authToken.trim().length < 20 || ct0.trim().length < 20) {
    throw new Error('auth_token and ct0 both look too short');
  }
  await mkdir(dirname(SESSION_FILE), { recursive: true });
  await writeFile(SESSION_FILE, JSON.stringify(buildXStorageState(authToken.trim(), ct0.trim()), null, 2));
  await unlink(ACCOUNT_FILE).catch(() => undefined);
}

export async function readXAccount(): Promise<string | null> {
  if (!xSessionPath()) return null;
  try {
    const raw = JSON.parse(await readFile(ACCOUNT_FILE, 'utf8')) as { screenName?: string };
    const name = raw.screenName?.replace(/^@/, '').trim();
    return name || null;
  } catch {
    return null;
  }
}

let accountLookup: Promise<string | null> | null = null;

/** Open X once with the saved session and remember the signed-in handle. */
export function refreshXAccount(): Promise<string | null> {
  if (!xSessionPath()) return Promise.resolve(null);
  if (accountLookup) return accountLookup;
  accountLookup = lookupXAccount().finally(() => {
    accountLookup = null;
  });
  return accountLookup;
}

async function lookupXAccount(): Promise<string | null> {
  const session = xSessionPath();
  if (!session) return null;
  const playwright = await import('playwright');
  const browser = await playwright.chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ storageState: session });
    const page = await context.newPage();
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await sleep(2500);
    const href = await page
      .locator('a[data-testid="AppTabBar_Profile_Link"]')
      .first()
      .getAttribute('href')
      .catch(() => null);
    const screenName = href?.replace(/^\//, '').split('/')[0]?.trim();
    if (!screenName || screenName === 'i') return null;
    await writeFile(ACCOUNT_FILE, JSON.stringify({ screenName, checkedAt: new Date().toISOString() }));
    return screenName;
  } catch {
    return null;
  } finally {
    await browser.close();
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Reply on X with the saved browser session. X's web composer is unofficial and can fail. */
export async function postXReply(tweetUrl: string, text: string): Promise<void> {
  const session = xSessionPath();
  if (!session) throw new Error('No X session');
  const playwright = await import('playwright');
  const browser = await playwright.chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ storageState: session });
  const page = await context.newPage();
  try {
    await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await sleep(2000);
    const reply = page.locator('[data-testid="reply"]').first();
    if (await reply.count()) {
      await reply.click();
      await sleep(500);
    }
    const box = page.locator('[data-testid="tweetTextarea_0"]').first();
    await box.waitFor({ timeout: 15_000 });
    await box.fill(text);
    const button = page.locator('[data-testid="tweetButtonInline"], [data-testid="tweetButton"]').first();
    await button.click();
    await sleep(2500);
    const stillThere = await box.inputValue().catch(() => '');
    if (stillThere.trim() === text.trim()) {
      throw new Error('Reply composer still has the text — X did not send it');
    }
  } finally {
    await browser.close();
  }
}
