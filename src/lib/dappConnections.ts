const CONNECTED_ACCOUNTS_KEY = '1337_connected_accounts';
/** @deprecated session-only legacy; migrated away on read */
const LEGACY_ORIGINS_KEY = '1337_connected_origins';

type ConnectedMap = Record<string, string[]>;

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

function sanitizeMap(raw: unknown): ConnectedMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: ConnectedMap = {};
  for (const [origin, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!origin || !Array.isArray(list)) continue;
    const addrs = [
      ...new Set(
        list
          .filter((a): a is string => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a))
          .map(normalizeAddress),
      ),
    ];
    if (addrs.length > 0) out[origin] = addrs;
  }
  return out;
}

async function getConnectedMap(): Promise<ConnectedMap> {
  try {
    const data = await chrome.storage.session.get([CONNECTED_ACCOUNTS_KEY, LEGACY_ORIGINS_KEY]);
    if (Array.isArray(data[LEGACY_ORIGINS_KEY])) {
      // Old model was origin-only; drop it so each address must reconnect explicitly.
      await chrome.storage.session.remove([LEGACY_ORIGINS_KEY]);
    }
    return sanitizeMap(data[CONNECTED_ACCOUNTS_KEY]);
  } catch {
    return {};
  }
}

async function setConnectedMap(map: ConnectedMap): Promise<void> {
  await chrome.storage.session.set({ [CONNECTED_ACCOUNTS_KEY]: map });
}

/** Origins that have at least one authorized address (for chainChanged broadcast). */
export async function getConnectedOrigins(): Promise<Set<string>> {
  const map = await getConnectedMap();
  return new Set(Object.keys(map));
}

export async function getConnectedAddresses(origin: string): Promise<string[]> {
  if (!origin) return [];
  const map = await getConnectedMap();
  return map[origin] ?? [];
}

export async function isOriginConnected(origin: string): Promise<boolean> {
  if (!origin) return false;
  return (await getConnectedAddresses(origin)).length > 0;
}

export async function isAddressConnected(origin: string, address: string): Promise<boolean> {
  if (!origin || !address) return false;
  const list = await getConnectedAddresses(origin);
  return list.includes(normalizeAddress(address));
}

export async function connectAddress(origin: string, address: string): Promise<void> {
  if (!origin || !address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return;
  const map = await getConnectedMap();
  const key = normalizeAddress(address);
  const existing = map[origin] ?? [];
  if (existing.includes(key)) return;
  map[origin] = [...existing, key];
  await setConnectedMap(map);
}

export async function disconnectAddress(origin: string, address: string): Promise<void> {
  if (!origin || !address) return;
  const map = await getConnectedMap();
  const list = map[origin];
  if (!list?.length) return;
  const next = list.filter(a => a !== normalizeAddress(address));
  if (next.length === 0) delete map[origin];
  else map[origin] = next;
  await setConnectedMap(map);
}

/** Revoke every address for an origin. */
export async function disconnectOrigin(origin: string): Promise<void> {
  if (!origin) return;
  const map = await getConnectedMap();
  if (!(origin in map)) return;
  delete map[origin];
  await setConnectedMap(map);
}

export type ConnectedSite = {
  origin: string;
  hostname: string;
  addresses: string[];
};

export async function listConnectedSites(): Promise<ConnectedSite[]> {
  const map = await getConnectedMap();
  return Object.entries(map)
    .map(([origin, addresses]) => ({
      origin,
      hostname: hostnameFromUrl(origin) ?? origin,
      addresses,
    }))
    .sort((a, b) => a.hostname.localeCompare(b.hostname));
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

/** Local/dev hosts rarely have a readable favicon on dark UI — prefer letter fallback. */
export function isLocalDevHost(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  const h = hostname.toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '[::1]' ||
    h === '0.0.0.0' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local')
  );
}

export function faviconForTab(tab: chrome.tabs.Tab | null | undefined): string | undefined {
  const host = hostnameFromUrl(tab?.url);
  if (isLocalDevHost(host)) return undefined;
  if (tab?.favIconUrl && !tab.favIconUrl.startsWith('chrome://')) return tab.favIconUrl;
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
