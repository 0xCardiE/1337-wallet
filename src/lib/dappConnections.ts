const CONNECTED_ORIGINS_KEY = '1337_connected_origins';

export async function getConnectedOrigins(): Promise<Set<string>> {
  try {
    const data = await chrome.storage.session.get([CONNECTED_ORIGINS_KEY]);
    const list = data[CONNECTED_ORIGINS_KEY];
    if (!Array.isArray(list)) return new Set();
    return new Set(list.filter((o): o is string => typeof o === 'string' && o.length > 0));
  } catch {
    return new Set();
  }
}

export async function isOriginConnected(origin: string): Promise<boolean> {
  if (!origin) return false;
  return (await getConnectedOrigins()).has(origin);
}

export async function connectOrigin(origin: string): Promise<void> {
  if (!origin) return;
  const set = await getConnectedOrigins();
  set.add(origin);
  await chrome.storage.session.set({ [CONNECTED_ORIGINS_KEY]: [...set] });
}

export async function disconnectOrigin(origin: string): Promise<void> {
  if (!origin) return;
  const set = await getConnectedOrigins();
  set.delete(origin);
  await chrome.storage.session.set({ [CONNECTED_ORIGINS_KEY]: [...set] });
}

export function originFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function hostnameFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function faviconForTab(tab: chrome.tabs.Tab | null | undefined): string | undefined {
  if (tab?.favIconUrl && !tab.favIconUrl.startsWith('chrome://')) return tab.favIconUrl;
  const host = hostnameFromUrl(tab?.url);
  if (!host) return undefined;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
}

export async function queryActiveBrowserTab(): Promise<chrome.tabs.Tab | null> {
  try {
    const wins = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
    const ordered = [
      ...wins.filter(w => w.focused),
      ...wins.filter(w => !w.focused),
    ];
    for (const win of ordered) {
      const active = win.tabs?.find(t => t.active && t.id != null && originFromUrl(t.url));
      if (active) return active;
    }
    const tabs = await chrome.tabs.query({ active: true });
    for (const tab of tabs) {
      if (tab.id != null && originFromUrl(tab.url)) return tab;
    }
    return null;
  } catch {
    return null;
  }
}
