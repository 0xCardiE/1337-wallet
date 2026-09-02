/**
 * Holds an unlocked session across popup opens. Popup JS reloads when the
 * action popup closes; the service worker + chrome.storage.session survive.
 */
import {
  connectAddress,
  disconnectAddress,
  disconnectOrigin,
  faviconForTab,
  getConnectedOrigins,
  isAddressConnected,
  listConnectedSites,
  originFromUrl,
  queryActiveBrowserTab,
} from './lib/dappConnections';
import { addressFromPrivateKey } from './lib/backgroundSign';
import {
  handleProviderRpc,
  executeSignRequest,
  type ProviderRpcResult,
} from './lib/providerRpc';
import {
  INTERNAL_WALLET_ORIGIN,
  listPendingApprovals,
  queueApprovalRequest,
  rejectAllPendingApprovals,
  rejectPendingApproval,
  takePendingApproval,
} from './lib/pendingApprovals';
import {
  loadPersisted,
  WALLET_PERSIST_KEY,
  effectiveToolbarOpenMode,
  effectiveActiveChainId,
} from './lib/storageState';
import { resolveProviderInjectConfig } from './lib/dappCompat';
import { handleTrezorMessage, isTrezorMessage } from './lib/trezorBackground';
import type { ProviderRequest, ProviderResponse } from './provider/types';
import { toHexChainId } from './provider/types';
import { reportInternalFailure } from './lib/devErrorReport';
import { getAddress } from 'viem';

const POPUP_PATH = 'index.html';
const HW_CONFIRM_PATH = 'index.html?hwconfirm=1';
const INTERNAL_RESULT_PREFIX = '1337_internal_';
const INTERNAL_APPROVAL_TTL_MS = 10 * 60 * 1000;

let hwConfirmWindowId: number | undefined;

async function loadPersistedSettingsOnStart(): Promise<void> {
  try {
    await loadPersisted();
  } catch {
    /* ignore */
  }
}

async function syncToolbarOpenModeFromSettings(): Promise<void> {
  try {
    const { settings } = await loadPersisted();
    const mode = effectiveToolbarOpenMode(settings);
    const side = chrome.sidePanel;
    if (!side?.setPanelBehavior) {
      await chrome.action.setPopup({ popup: POPUP_PATH });
      return;
    }
    if (mode === 'side_panel') {
      await chrome.action.setPopup({ popup: '' });
      await side.setPanelBehavior({ openPanelOnActionClick: true });
    } else {
      await side.setPanelBehavior({ openPanelOnActionClick: false });
      await chrome.action.setPopup({ popup: POPUP_PATH });
    }
  } catch {
    /* ignore */
  }
}

/**
 * After reload/update, open tabs still hold dead content scripts. Reinject so
 * window.ethereum keep working without a manual page refresh.
 */
async function reinjectContentScripts(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    await Promise.all(
      tabs.map(async tab => {
        if (tab.id == null || tab.url == null) return;
        if (!/^https?:/.test(tab.url) && !tab.url.startsWith('file:')) return;
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            files: ['content.js'],
          });
        } catch {
          /* chrome://, store, etc. — ignore */
        }
      }),
    );
  } catch {
    /* ignore */
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void syncToolbarOpenModeFromSettings();
  void loadPersistedSettingsOnStart();
  void reinjectContentScripts();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[WALLET_PERSIST_KEY]) return;
  void syncToolbarOpenModeFromSettings();
});

void syncToolbarOpenModeFromSettings();
void loadPersistedSettingsOnStart();

const SESSION_KEY = '1337_session_pk';
const UNLOCK_PASSWORD_KEY = '1337_session_unlock';
const ACTIVITY_KEY = '1337_last_activity';
const HW_SESSION_KEY = '1337_session_hw';

let memoryPk: string | null = null;
let memoryUnlockPassword: string | null = null;
type HwSession = {
  kind: 'ledger' | 'trezor';
  accountId: string;
  address: string;
  derivationPath: string;
};
let memoryHw: HwSession | null = null;

async function emitToTab(
  tabId: number,
  event: { type: string; chainId?: string; accounts?: string[] },
): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PROVIDER_EMIT', event });
  } catch {
    /* content script may be unavailable — try MAIN-world inject below */
  }
  void chrome.runtime.lastError;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (ev: { type: string; chainId?: string; accounts?: string[] }) => {
        const channel = '1337-provider';
        window.postMessage({ channel, target: 'inpage', type: 'event', event: ev }, '*');
        const eth = (window as Window & { ethereum?: { request?: (a: unknown) => Promise<unknown> } })
          .ethereum;
        if (ev.type === 'accountsChanged' && eth?.request && Array.isArray(ev.accounts)) {
          /* nudge dapps that only poll eth_accounts after user gesture */
          void eth.request({ method: 'eth_accounts' }).catch(() => undefined);
        }
      },
      args: [event],
    });
  } catch {
    /* scripting may be blocked on this tab */
  }
  void chrome.runtime.lastError;
}

/** Push chainChanged to every tab whose origin is connected (and optionally one extra tab). */
async function broadcastChainChanged(
  chainId: number,
  extraTabId?: number,
): Promise<void> {
  const hex = toHexChainId(chainId);
  const origins = await getConnectedOrigins();
  const seen = new Set<number>();
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id == null) continue;
      const origin = originFromUrl(tab.url);
      if (!origin || !origins.has(origin)) continue;
      seen.add(tab.id);
      await emitToTab(tab.id, { type: 'chainChanged', chainId: hex });
    }
  } catch {
    /* ignore */
  }
  if (extraTabId != null && !seen.has(extraTabId)) {
    await emitToTab(extraTabId, { type: 'chainChanged', chainId: hex });
  }
}

async function openWalletUi(tabId?: number): Promise<void> {
  try {
    const side = chrome.sidePanel;
    if (side?.open) {
      if (tabId != null) {
        await side.open({ tabId });
        return;
      }
      const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
      if (win?.id != null) {
        await side.open({ windowId: win.id });
        return;
      }
    }
  } catch {
    /* ignore */
  }
  try {
    await chrome.action.openPopup();
  } catch {
    /* popup may already be open / not allowed */
  }
}

function notifyPendingApprovalsChanged(): void {
  try {
    chrome.runtime.sendMessage({ type: 'PENDING_APPROVALS_CHANGED' }, () => {
      void chrome.runtime.lastError;
    });
  } catch {
    /* no extension page listening */
  }
}

function cancelPendingApprovals(message: string): void {
  if (rejectAllPendingApprovals(message) > 0) {
    notifyPendingApprovalsChanged();
  }
}

/** Keep a surface alive while the user confirms on Ledger/Trezor (action popups close on blur). */
async function openHardwareConfirmUi(tabId?: number): Promise<void> {
  try {
    const { settings } = await loadPersisted();
    if (effectiveToolbarOpenMode(settings) === 'side_panel') {
      await openWalletUi(tabId);
      return;
    }
  } catch {
    /* fall through to a dedicated window */
  }

  if (hwConfirmWindowId != null) {
    try {
      await chrome.windows.update(hwConfirmWindowId, { focused: true });
      return;
    } catch {
      hwConfirmWindowId = undefined;
    }
  }

  try {
    const win = await chrome.windows.create({
      url: chrome.runtime.getURL(HW_CONFIRM_PATH),
      type: 'popup',
      focused: true,
      width: 400,
      height: 700,
    });
    hwConfirmWindowId = win?.id;
  } catch {
    await openWalletUi(tabId);
  }
}

chrome.windows.onRemoved.addListener((id: number) => {
  if (id === hwConfirmWindowId) hwConfirmWindowId = undefined;
});

async function setInternalResult(
  id: string,
  row: { ok: true; result: unknown } | { ok: false; error: string },
): Promise<void> {
  await chrome.storage.session.set({ [INTERNAL_RESULT_PREFIX + id]: row });
}

async function getInternalResult(
  id: string,
): Promise<{ ok: true; result: unknown } | { ok: false; error: string } | undefined> {
  const data = await chrome.storage.session.get(INTERNAL_RESULT_PREFIX + id);
  return data[INTERNAL_RESULT_PREFIX + id] as
    | { ok: true; result: unknown }
    | { ok: false; error: string }
    | undefined;
}

async function buildDappConnectionStatus(): Promise<{
  ok: true;
  tab: {
    tabId: number;
    url: string;
    title: string;
    origin: string;
    hostname: string;
    favIconUrl?: string;
  } | null;
  connected: boolean;
  connectedAddress: string | null;
  canConnect: boolean;
  reason?: string;
}> {
  const tab = await queryActiveBrowserTab();
  if (!tab?.id || !tab.url) {
    return {
      ok: true,
      tab: null,
      connected: false,
      connectedAddress: null,
      canConnect: false,
      reason: 'No active browser tab',
    };
  }
  const origin = originFromUrl(tab.url);
  if (!origin) {
    return {
      ok: true,
      tab: null,
      connected: false,
      connectedAddress: null,
      canConnect: false,
      reason: 'Open an http(s) dapp tab to connect',
    };
  }
  const hostname = new URL(tab.url).hostname;
  const addr = await sessionAddress();
  const connected = Boolean(addr && (await isAddressConnected(origin, addr)));
  return {
    ok: true,
    tab: {
      tabId: tab.id,
      url: tab.url,
      title: tab.title?.trim() || hostname,
      origin,
      hostname,
      favIconUrl: faviconForTab(tab),
    },
    connected,
    connectedAddress: connected && addr ? addr : null,
    canConnect: true,
  };
}

/** Push an event to every tab on this origin. */
async function emitToOrigin(
  origin: string,
  event: { type: string; chainId?: string; accounts?: string[] },
): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id == null) continue;
      if (originFromUrl(tab.url) !== origin) continue;
      await emitToTab(tab.id, event);
    }
  } catch {
    /* ignore */
  }
}

/** Tell connected dapp tabs which accounts the active wallet exposes for their origin. */
async function broadcastAccountsChanged(activeAddress: `0x${string}` | null): Promise<void> {
  try {
    const origins = await getConnectedOrigins();
    if (origins.size === 0) return;
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id == null) continue;
      const origin = originFromUrl(tab.url);
      if (!origin || !origins.has(origin)) continue;
      const authorized =
        Boolean(activeAddress) && (await isAddressConnected(origin, activeAddress!));
      await emitToTab(tab.id, {
        type: 'accountsChanged',
        accounts: authorized && activeAddress ? [activeAddress] : [],
      });
    }
  } catch {
    /* ignore */
  }
}

type Msg =
  | { type: 'GET_SESSION' }
  | {
      type: 'SET_SESSION';
      privateKeyHex?: string;
      unlockPassword?: string;
      session?: HwSession;
    }
  | { type: 'CLEAR_SESSION' }
  | {
      type: 'COMPLETE_PENDING_APPROVAL';
      id: string;
      result?: unknown;
      error?: string;
    }
  | { type: 'TREZOR_INIT' }
  | { type: 'TREZOR_ETHEREUM_GET_ADDRESS'; path?: string }
  | {
      type: 'TREZOR_ETHEREUM_SIGN_TRANSACTION';
      path?: string;
      transaction?: Record<string, unknown>;
    }
  | {
      type: 'TREZOR_ETHEREUM_SIGN_MESSAGE';
      path?: string;
      message?: string;
      hex?: boolean;
    }
  | {
      type: 'TREZOR_ETHEREUM_SIGN_TYPED_DATA';
      path?: string;
      data?: Record<string, unknown>;
      metamask_v4_compat?: boolean;
    }
  | { type: 'PING' }
  | { type: 'SYNC_TOOLBAR_OPEN_MODE' }
  | { type: 'PROVIDER_GET_CONFIG'; origin?: string }
  | { type: 'PROVIDER_RPC'; request: ProviderRequest; origin?: string; pageUrl?: string }
  | { type: 'BROADCAST_CHAIN_CHANGED'; chainId: number }
  | { type: 'GET_DAPP_CONNECTION' }
  | { type: 'CONNECT_ACTIVE_TAB' }
  | { type: 'DISCONNECT_ACTIVE_TAB' }
  | { type: 'LIST_CONNECTED_SITES' }
  | { type: 'DISCONNECT_ORIGIN'; origin: string }
  | { type: 'GET_PENDING_APPROVALS' }
  | { type: 'PENDING_APPROVALS_CHANGED' }
  | { type: 'OPEN_HARDWARE_CONFIRM_UI' }
  | {
      type: 'QUEUE_INTERNAL_APPROVAL';
      chainId: number;
      tx: Record<string, unknown>;
    }
  | { type: 'GET_INTERNAL_RESULT'; id: string }
  | { type: 'RESOLVE_PENDING_APPROVAL'; id: string; approved: boolean; gasOverrides?: import('./lib/gasOverrides').GasOverrideInput };

async function sessionUnlockPassword(): Promise<string | null> {
  await maybeAutoLockExpired();
  if (memoryUnlockPassword) return memoryUnlockPassword;
  const data = await chrome.storage.session.get([UNLOCK_PASSWORD_KEY]);
  const pwd = data[UNLOCK_PASSWORD_KEY];
  if (typeof pwd === 'string' && pwd.length > 0) {
    memoryUnlockPassword = pwd;
    return pwd;
  }
  return null;
}

async function sessionPrivateKey(): Promise<`0x${string}` | null> {
  await maybeAutoLockExpired();
  if (memoryPk && isValidPkHex(memoryPk)) return memoryPk as `0x${string}`;
  const data = await chrome.storage.session.get([SESSION_KEY]);
  const hex = data[SESSION_KEY];
  if (typeof hex === 'string' && isValidPkHex(hex)) {
    memoryPk = hex;
    memoryHw = null;
    return memoryPk as `0x${string}`;
  }
  return null;
}

async function sessionHardware(): Promise<HwSession | null> {
  await maybeAutoLockExpired();
  if (memoryHw?.address) return memoryHw;
  const data = await chrome.storage.session.get([HW_SESSION_KEY]);
  const row = data[HW_SESSION_KEY] as HwSession | undefined;
  if (
    row &&
    (row.kind === 'ledger' || row.kind === 'trezor') &&
    typeof row.address === 'string' &&
    /^0x[0-9a-fA-F]{40}$/.test(row.address)
  ) {
    memoryHw = row;
    return memoryHw;
  }
  return null;
}

async function sessionAddress(): Promise<`0x${string}` | null> {
  const pk = await sessionPrivateKey();
  if (pk) return addressFromPrivateKey(pk);
  const hw = await sessionHardware();
  if (hw) return getAddress(hw.address);
  return null;
}

function isValidPkHex(s: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(s);
}

async function touchActivity(): Promise<void> {
  await chrome.storage.session.set({ [ACTIVITY_KEY]: Date.now() });
}

async function maybeAutoLockExpired(): Promise<void> {
  try {
    const { settings } = await loadPersisted();
    const mins = settings.autoLockMinutes ?? 0;
    if (!Number.isFinite(mins) || mins <= 0) return;
    const data = await chrome.storage.session.get([ACTIVITY_KEY]);
    const last = typeof data[ACTIVITY_KEY] === 'number' ? data[ACTIVITY_KEY] : 0;
    if (!last) return;
    if (Date.now() - last > mins * 60 * 1000) {
      memoryPk = null;
      memoryHw = null;
      memoryUnlockPassword = null;
      await chrome.storage.session.remove([
        SESSION_KEY,
        UNLOCK_PASSWORD_KEY,
        HW_SESSION_KEY,
        ACTIVITY_KEY,
      ]);
      cancelPendingApprovals('Wallet locked; pending request cancelled');
      void broadcastAccountsChanged(null);
    }
  } catch {
    /* ignore */
  }
}

chrome.runtime.onMessage.addListener(
  (message: Msg, sender, sendResponse: (r: unknown) => void) => {
    if (!message || typeof message !== 'object') return;

    if (isTrezorMessage(message)) {
      void handleTrezorMessage(
        message as unknown as {
          type: string;
          path?: string;
          transaction?: Record<string, unknown>;
        },
      ).then(result => sendResponse(result));
      return true;
    }

    if (message.type === 'PING') {
      void (async () => {
        try {
          await touchActivity();
          sendResponse({ ok: true });
        } catch {
          sendResponse({ ok: false });
        }
      })();
      return true;
    }

    if (message.type === 'SYNC_TOOLBAR_OPEN_MODE') {
      void (async () => {
        try {
          await syncToolbarOpenModeFromSettings();
          sendResponse({ ok: true });
        } catch {
          sendResponse({ ok: false });
        }
      })();
      return true;
    }

    if (message.type === 'PROVIDER_GET_CONFIG') {
      void (async () => {
        try {
          const { settings } = await loadPersisted();
          const origin =
            message.origin ??
            (sender.tab?.url ? originFromUrl(sender.tab.url) ?? undefined : undefined);
          sendResponse({ ok: true, ...resolveProviderInjectConfig(settings, origin) });
        } catch {
          sendResponse({
            ok: true,
            replaceMetaMask: true,
            is1337: true,
            isMetaMask: true,
            announceAs1337: true,
            announceAsMetaMask: true,
          });
        }
      })();
      return true;
    }

    if (message.type === 'BROADCAST_CHAIN_CHANGED') {
      void (async () => {
        try {
          const chainId =
            typeof message.chainId === 'number' && Number.isFinite(message.chainId)
              ? Math.floor(message.chainId)
              : null;
          if (chainId == null || chainId <= 0) {
            sendResponse({ ok: false, error: 'Invalid chainId' });
            return;
          }
          await broadcastChainChanged(chainId);
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      })();
      return true;
    }

    if (message.type === 'PROVIDER_RPC' && message.request) {
      void (async () => {
        try {
          const pk = await sessionPrivateKey();
          const hw = pk ? null : await sessionHardware();
          const origin =
            message.origin ??
            (sender.url ? originFromUrl(sender.url) ?? undefined : undefined);
          const pageUrl =
            typeof message.pageUrl === 'string' && message.pageUrl
              ? message.pageUrl
              : sender.tab?.url;
          const res: ProviderRpcResult = await handleProviderRpc(
            pk,
            message.request,
            origin,
            {
              tabId: sender.tab?.id,
              pageUrl,
              onApprovalQueued: () => {
                notifyPendingApprovalsChanged();
                if (hw) void openHardwareConfirmUi(sender.tab?.id);
                else void openWalletUi(sender.tab?.id);
              },
              onApprovalExpired: notifyPendingApprovalsChanged,
              sessionAddress: hw
                ? (getAddress(hw.address) as `0x${string}`)
                : undefined,
              hardware: Boolean(hw),
            },
          );
          if (
            !pk &&
            !hw &&
            message.request.method === 'eth_requestAccounts' &&
            !res.ok
          ) {
            void openWalletUi(sender.tab?.id);
          }
          if (res.ok && res.switchedChainId != null) {
            void broadcastChainChanged(res.switchedChainId, sender.tab?.id);
          }
          if (res.ok && res.disconnected && sender.tab?.id != null) {
            await emitToTab(sender.tab.id, { type: 'disconnect' });
            await emitToTab(sender.tab.id, { type: 'accountsChanged', accounts: [] });
          }
          const { switchedChainId: _switched, disconnected: _disconnected, ...response } = res;
          sendResponse(response);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          reportInternalFailure({
            source: 'provider',
            title: 'Provider handler crashed',
            err: e,
            context: { method: message.request.method, origin: message.origin },
          });
          sendResponse({
            id: message.request.id,
            ok: false,
            error: { code: 4001, message: msg },
          } satisfies ProviderResponse);
        }
      })();
      return true;
    }

    if (message.type === 'GET_PENDING_APPROVALS') {
      sendResponse({ ok: true, pending: listPendingApprovals() });
      return;
    }

    if (message.type === 'PENDING_APPROVALS_CHANGED') {
      return;
    }

    if (message.type === 'OPEN_HARDWARE_CONFIRM_UI') {
      void openHardwareConfirmUi();
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'GET_INTERNAL_RESULT') {
      void (async () => {
        try {
          const row = await getInternalResult(message.id);
          if (!row) {
            sendResponse({ status: 'pending' });
            return;
          }
          if (row.ok) sendResponse({ status: 'ok', result: row.result });
          else sendResponse({ status: 'error', error: row.error });
        } catch (e) {
          sendResponse({
            status: 'error',
            error: e instanceof Error ? e.message : String(e),
          });
        }
      })();
      return true;
    }

    if (message.type === 'QUEUE_INTERNAL_APPROVAL') {
      const chainId = message.chainId;
      const tx = message.tx;
      if (!tx || typeof tx !== 'object' || typeof chainId !== 'number' || !Number.isFinite(chainId)) {
        sendResponse({ ok: false, error: 'Invalid internal approval' });
        return;
      }
      const id = `internal-${Date.now().toString(16)}-${Math.random().toString(36).slice(2, 8)}`;
      sendResponse({ ok: true, id });
      void (async () => {
        try {
          const res = await queueApprovalRequest({
            request: { id, method: 'eth_sendTransaction', params: [tx] },
            origin: INTERNAL_WALLET_ORIGIN,
            chainId,
            onQueued: () => {
              notifyPendingApprovalsChanged();
              void openHardwareConfirmUi();
            },
            onExpired: notifyPendingApprovalsChanged,
            ttlMs: INTERNAL_APPROVAL_TTL_MS,
          });
          if (res.ok) {
            await setInternalResult(id, { ok: true, result: res.result });
          } else {
            await setInternalResult(id, {
              ok: false,
              error: res.error?.message || 'Request rejected.',
            });
          }
        } catch (e) {
          await setInternalResult(id, {
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
        notifyPendingApprovalsChanged();
      })();
      return;
    }

    if (message.type === 'RESOLVE_PENDING_APPROVAL') {
      void (async () => {
        try {
          const { id, approved } = message;
          if (!id) {
            sendResponse({ ok: false, error: 'Missing approval id' });
            return;
          }
          if (!approved) {
            rejectPendingApproval(id);
            notifyPendingApprovalsChanged();
            sendResponse({ ok: true });
            return;
          }
          const pk = await sessionPrivateKey();
          if (!pk) {
            sendResponse({ ok: false, error: 'Unlock 1337 first' });
            return;
          }
          const entry = takePendingApproval(id);
          if (!entry) {
            sendResponse({ ok: false, error: 'Request expired or already handled' });
            return;
          }
          try {
            const result = await executeSignRequest(
              pk,
              entry.chainId,
              entry.request.method,
              entry.request.params ?? [],
              message.gasOverrides,
            );
            entry.resolve({ id, ok: true, result });
            notifyPendingApprovalsChanged();
            sendResponse({ ok: true });
          } catch (e) {
            const err = e as Error & { code?: number };
            const msg = err.message ?? String(e);
            reportInternalFailure({
              source: 'background',
              title: 'Sign / send failed',
              err: e,
              context: {
                method: entry.request.method,
                chainId: entry.chainId,
                origin: entry.origin,
                gasOverrides: message.gasOverrides,
                params: entry.request.params,
              },
            });
            entry.resolve({
              id,
              ok: false,
              error: { code: err.code ?? 4001, message: msg },
            });
            sendResponse({ ok: false, error: msg });
          }
        } catch (e) {
          sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      })();
      return true;
    }

    if (message.type === 'GET_DAPP_CONNECTION') {
      void (async () => {
        try {
          sendResponse(await buildDappConnectionStatus());
        } catch {
          sendResponse({
            ok: false,
            tab: null,
            connected: false,
            connectedAddress: null,
            canConnect: false,
            reason: 'Could not read active tab',
          });
        }
      })();
      return true;
    }

    if (message.type === 'CONNECT_ACTIVE_TAB') {
      void (async () => {
        try {
          const addr = await sessionAddress();
          if (!addr) {
            void openWalletUi();
            sendResponse({ ok: false, error: 'Unlock 1337 first' });
            return;
          }
          const status = await buildDappConnectionStatus();
          if (!status.tab?.origin) {
            sendResponse({ ok: false, error: status.reason ?? 'No connectable tab' });
            return;
          }
          await connectAddress(status.tab.origin, addr);
          const { settings } = await loadPersisted();
          const chainId = toHexChainId(effectiveActiveChainId(settings));
          await emitToTab(status.tab.tabId, { type: 'connect', chainId });
          await emitToTab(status.tab.tabId, {
            type: 'accountsChanged',
            accounts: [addr],
          });
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      })();
      return true;
    }

    if (message.type === 'DISCONNECT_ACTIVE_TAB') {
      void (async () => {
        try {
          const status = await buildDappConnectionStatus();
          if (!status.tab?.origin) {
            sendResponse({ ok: false, error: status.reason ?? 'No active dapp tab' });
            return;
          }
          const addr = await sessionAddress();
          if (addr) await disconnectAddress(status.tab.origin, addr);
          else await disconnectOrigin(status.tab.origin);
          await emitToTab(status.tab.tabId, { type: 'disconnect' });
          await emitToTab(status.tab.tabId, { type: 'accountsChanged', accounts: [] });
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      })();
      return true;
    }

    if (message.type === 'LIST_CONNECTED_SITES') {
      void (async () => {
        try {
          sendResponse({ ok: true, sites: await listConnectedSites() });
        } catch (e) {
          sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e), sites: [] });
        }
      })();
      return true;
    }

    if (message.type === 'DISCONNECT_ORIGIN') {
      void (async () => {
        try {
          const origin = message.origin;
          if (!origin) {
            sendResponse({ ok: false, error: 'Missing origin' });
            return;
          }
          await disconnectOrigin(origin);
          await emitToOrigin(origin, { type: 'disconnect' });
          await emitToOrigin(origin, { type: 'accountsChanged', accounts: [] });
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      })();
      return true;
    }

    if (message.type === 'COMPLETE_PENDING_APPROVAL') {
      void (async () => {
        try {
          const entry = takePendingApproval(message.id);
          if (!entry) {
            sendResponse({ ok: false, error: 'Request expired or already handled' });
            return;
          }
          if (message.error) {
            entry.resolve({
              id: entry.request.id,
              ok: false,
              error: { code: 4001, message: message.error },
            });
            notifyPendingApprovalsChanged();
            sendResponse({ ok: true });
            return;
          }
          entry.resolve({ id: entry.request.id, ok: true, result: message.result });
          notifyPendingApprovalsChanged();
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      })();
      return true;
    }

    if (message.type === 'GET_SESSION') {
      void (async () => {
        try {
          const pk = await sessionPrivateKey();
          const unlockPassword = await sessionUnlockPassword();
          if (pk) {
            sendResponse({ ok: true, privateKeyHex: pk, unlockPassword: unlockPassword ?? undefined });
            return;
          }
          const hw = await sessionHardware();
          if (hw) {
            sendResponse({ ok: true, session: hw, unlockPassword: unlockPassword ?? undefined });
            return;
          }
          sendResponse({ ok: false });
        } catch {
          sendResponse({ ok: false });
        }
      })();
      return true;
    }

    if (message.type === 'SET_SESSION') {
      if (typeof message.privateKeyHex === 'string') {
        if (!isValidPkHex(message.privateKeyHex)) {
          sendResponse({ ok: false, error: 'invalid key' });
          return;
        }
        memoryPk = message.privateKeyHex;
        memoryHw = null;
        if (typeof message.unlockPassword === 'string' && message.unlockPassword.length > 0) {
          memoryUnlockPassword = message.unlockPassword;
          void chrome.storage.session.set({ [UNLOCK_PASSWORD_KEY]: memoryUnlockPassword });
        }
        void chrome.storage.session.set({ [SESSION_KEY]: memoryPk });
        void chrome.storage.session.remove([HW_SESSION_KEY]);
        void touchActivity();
        void broadcastAccountsChanged(addressFromPrivateKey(memoryPk as `0x${string}`));
        sendResponse({ ok: true });
        return;
      }
      if (message.session && (message.session.kind === 'ledger' || message.session.kind === 'trezor')) {
        memoryHw = message.session;
        memoryPk = null;
        void chrome.storage.session.set({ [HW_SESSION_KEY]: memoryHw });
        void chrome.storage.session.remove([SESSION_KEY]);
        void touchActivity();
        void broadcastAccountsChanged(getAddress(memoryHw.address));
        sendResponse({ ok: true });
        return;
      }
      if (typeof message.unlockPassword === 'string' && message.unlockPassword.length > 0) {
        memoryUnlockPassword = message.unlockPassword;
        void chrome.storage.session.set({ [UNLOCK_PASSWORD_KEY]: memoryUnlockPassword });
        void touchActivity();
        sendResponse({ ok: true });
        return;
      }
      sendResponse({ ok: false, error: 'invalid session' });
      return;
    }

    if (message.type === 'CLEAR_SESSION') {
      memoryPk = null;
      memoryHw = null;
      memoryUnlockPassword = null;
      void chrome.storage.session.remove([
        SESSION_KEY,
        UNLOCK_PASSWORD_KEY,
        HW_SESSION_KEY,
        ACTIVITY_KEY,
      ]);
      cancelPendingApprovals('Wallet locked; pending request cancelled');
      void broadcastAccountsChanged(null);
      sendResponse({ ok: true });
    }
  },
);
