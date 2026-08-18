import type { ConnectedSite } from './dappConnections';

export type DappTabInfo = {
  tabId: number;
  url: string;
  title: string;
  origin: string;
  hostname: string;
  favIconUrl?: string;
};

export type DappConnectionStatus = {
  ok: boolean;
  tab: DappTabInfo | null;
  connected: boolean;
  /** Active account address when that account is connected to the tab origin. */
  connectedAddress?: string | null;
  canConnect: boolean;
  reason?: string;
};

export async function fetchDappConnectionStatus(): Promise<DappConnectionStatus> {
  try {
    const res = (await chrome.runtime.sendMessage({ type: 'GET_DAPP_CONNECTION' })) as DappConnectionStatus;
    if (res?.ok) return res;
  } catch {
    /* ignore */
  }
  return {
    ok: false,
    tab: null,
    connected: false,
    connectedAddress: null,
    canConnect: false,
    reason: 'Extension unavailable',
  };
}

export async function connectActiveTab(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = (await chrome.runtime.sendMessage({ type: 'CONNECT_ACTIVE_TAB' })) as {
      ok?: boolean;
      error?: string;
    };
    return { ok: res?.ok === true, error: res?.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function disconnectActiveTab(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = (await chrome.runtime.sendMessage({ type: 'DISCONNECT_ACTIVE_TAB' })) as {
      ok?: boolean;
      error?: string;
    };
    return { ok: res?.ok === true, error: res?.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchConnectedSites(): Promise<ConnectedSite[]> {
  try {
    const res = (await chrome.runtime.sendMessage({ type: 'LIST_CONNECTED_SITES' })) as {
      ok?: boolean;
      sites?: ConnectedSite[];
    };
    if (res?.ok && Array.isArray(res.sites)) return res.sites;
  } catch {
    /* ignore */
  }
  return [];
}

export async function disconnectConnectedOrigin(
  origin: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = (await chrome.runtime.sendMessage({
      type: 'DISCONNECT_ORIGIN',
      origin,
    })) as { ok?: boolean; error?: string };
    return { ok: res?.ok === true, error: res?.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
