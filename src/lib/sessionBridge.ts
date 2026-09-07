import {
  activateAccount,
  clearAccountSession,
  getAccountsMeta,
  getLocalKeys,
  getSessionPassword,
  hasSessionMnemonic,
  isUnlocked,
  setAccountsMeta,
  setLocalKeys,
  setSessionPassword,
  setUnlockedAccount,
} from './accountSession';
import type { AccountKind } from './accounts';
import { isKeyBackedKind } from './accounts';
import { planSessionReconcile, sessionNeedsVaultHydrate } from './sessionIntegrity';
import { loadPersisted, type ToolbarOpenMode } from './storageState';
import { accountFromPrivateKey } from './walletCore';

export type HardwareSession = {
  kind: 'ledger' | 'trezor';
  accountId: string;
  address: string;
  derivationPath: string;
};

type SessionResponse =
  | {
      ok: true;
      privateKeyHex: string;
      unlockPassword?: string;
      session?: undefined;
    }
  | {
      ok: true;
      privateKeyHex?: undefined;
      unlockPassword?: string;
      session: HardwareSession;
    }
  | { ok: false; error?: string };

type PingResponse = { ok: boolean };

function sendMessage<T>(msg: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response: T) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(response);
    });
  });
}

function notifySessionChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('1337-session-changed'));
}

function backgroundHasSigningMaterial(res: SessionResponse | undefined): boolean {
  if (!res?.ok) return false;
  if (res.session && (res.session.kind === 'ledger' || res.session.kind === 'trezor')) {
    return true;
  }
  return Boolean(res.privateKeyHex);
}

async function hydrateVaultKeys(password: string): Promise<boolean> {
  setSessionPassword(password);
  try {
    const { hydrateLocalKeysFromVault } = await import('./walletManager');
    await hydrateLocalKeysFromVault(password);
    return true;
  } catch {
    return false;
  }
}

async function activateFromBackgroundSession(
  res: Extract<SessionResponse, { ok: true }>,
): Promise<boolean> {
  const persisted = await loadPersisted();
  setAccountsMeta(persisted.accounts, persisted.activeAccountId);

  if (res.session && (res.session.kind === 'ledger' || res.session.kind === 'trezor')) {
    const id = res.session.accountId;
    if (persisted.accounts.some(a => a.id === id)) {
      activateAccount(id);
      return isUnlocked();
    }
    return false;
  }

  if (!res.privateKeyHex) return false;
  const hex = res.privateKeyHex as `0x${string}`;
  const account = accountFromPrivateKey(hex);
  const match = persisted.accounts.find(
    a => isKeyBackedKind(a.kind) && a.address.toLowerCase() === account.address.toLowerCase(),
  );
  if (match) {
    const merged = Object.fromEntries(getLocalKeys());
    if (!merged[match.id]) merged[match.id] = hex;
    setLocalKeys(merged);
    setAccountsMeta(persisted.accounts, persisted.activeAccountId);
    try {
      activateAccount(persisted.activeAccountId ?? match.id);
    } catch {
      activateAccount(match.id);
    }
  } else {
    setUnlockedAccount(account, hex);
  }
  return isUnlocked();
}

/** Restore popup memory from the background session (survives popup close). */
export async function hydrateAccountFromBackground(): Promise<boolean> {
  try {
    const res = (await sendMessage<SessionResponse>({
      type: 'GET_SESSION',
    })) as SessionResponse;
    const uiPassword = getSessionPassword();
    const plan = planSessionReconcile({
      backgroundHasMaterial: backgroundHasSigningMaterial(res),
      backgroundPassword: res?.ok ? res.unlockPassword : undefined,
      uiPassword,
      needsVaultHydrate: true,
    });

    if (plan === 'lock') {
      if (backgroundHasSigningMaterial(res)) {
        await clearSessionInBackground();
      }
      clearAccountSession();
      return false;
    }

    const password =
      (res && res.ok ? res.unlockPassword : undefined) || uiPassword;
    if (!password) {
      clearAccountSession();
      return false;
    }

    if (plan === 'repair' || (res.ok && !res.unlockPassword && uiPassword)) {
      await persistUnlockPassword(password);
    }

    const vaultOk = await hydrateVaultKeys(password);
    if (!vaultOk && getLocalKeys().size === 0) {
      await clearSessionInBackground();
      clearAccountSession();
      return false;
    }

    if (!res.ok) return false;
    const ok = await activateFromBackgroundSession(res);
    if (ok) notifySessionChanged();
    return ok;
  } catch {
    return false;
  }
}

export async function persistSessionPrivateKey(
  pk: `0x${string}`,
  unlockPassword?: string,
): Promise<void> {
  await sendMessage({
    type: 'SET_SESSION',
    privateKeyHex: pk,
    unlockPassword: unlockPassword ?? getSessionPassword() ?? undefined,
  });
}

export async function persistUnlockPassword(password: string): Promise<void> {
  await sendMessage({
    type: 'SET_SESSION',
    unlockPassword: password,
  });
}

/** Set local account and persist so reopening the popup stays unlocked. */
export async function unlockWithPersistedSession(pk: `0x${string}`): Promise<void> {
  setUnlockedAccount(accountFromPrivateKey(pk), pk);
  await persistSessionPrivateKey(pk);
}

export async function clearSessionInBackground(): Promise<void> {
  try {
    await sendMessage({ type: 'CLEAR_SESSION' });
  } catch {
    /* ignore — popup may run before background is ready */
  }
}

export async function persistHardwareSession(session: HardwareSession): Promise<void> {
  await sendMessage({
    type: 'SET_SESSION',
    session,
    unlockPassword: getSessionPassword() ?? undefined,
  });
}

/** Clear background session and local unlocked account (explicit Lock). */
export async function lockWallet(): Promise<void> {
  await clearSessionInBackground();
  clearAccountSession();
  setUnlockedAccount(null, null);
  notifySessionChanged();
}

/** Apply toolbar open mode (popup vs side panel) from saved settings. */
export async function syncToolbarOpenModeNow(): Promise<void> {
  try {
    await sendMessage<{ ok: boolean }>({ type: 'SYNC_TOOLBAR_OPEN_MODE' });
  } catch {
    /* ignore — worker may not be up yet */
  }
}

async function browserWindowIdForSidePanel(): Promise<number | undefined> {
  const windowTypes: chrome.windows.WindowType[] = ['normal'];
  try {
    const w = await chrome.windows.getLastFocused({ windowTypes });
    if (w.id != null) return w.id;
  } catch {
    /* ignore */
  }
  try {
    const wins = await chrome.windows.getAll({ windowTypes });
    const focused = wins.find(x => x.focused && x.id != null);
    if (focused?.id != null) return focused.id;
    return wins[0]?.id;
  } catch {
    return undefined;
  }
}

/**
 * After the user changes toolbar open mode, move to the new surface and close this page.
 * Must run from a direct user gesture (e.g. Save).
 */
export async function reopenWalletSurfaceAfterModeChange(
  newMode: ToolbarOpenMode,
): Promise<void> {
  try {
    if (newMode === 'side_panel') {
      const windowId = await browserWindowIdForSidePanel();
      if (windowId != null && chrome.sidePanel?.open) {
        await chrome.sidePanel.open({ windowId });
      }
    } else if (typeof chrome.action?.openPopup === 'function') {
      await chrome.action.openPopup();
    }
  } catch {
    /* user can still use the toolbar */
  }
  const delayMs = newMode === 'popup' ? 120 : 0;
  window.setTimeout(() => {
    window.close();
  }, delayMs);
}

/** Tell the service worker the user is active (resets auto-lock idle timer). */
export async function pingSessionActivity(): Promise<void> {
  try {
    await sendMessage<PingResponse>({ type: 'PING' });
  } catch {
    /* ignore */
  }
}

/**
 * Re-check background session (e.g. after auto-lock). Clears in-memory account if locked out.
 * Does not replace a full in-page key map with the single active session key.
 * @returns whether the wallet is still unlocked in the service worker.
 */
export async function verifyBackgroundSessionStillUnlocked(): Promise<boolean> {
  try {
    const res = (await sendMessage<SessionResponse>({
      type: 'GET_SESSION',
    })) as SessionResponse;
    const uiPassword = getSessionPassword();
    const needsVault = sessionNeedsVaultHydrate(
      getAccountsMeta(),
      getLocalKeys().keys(),
      hasSessionMnemonic(),
    );
    const plan = planSessionReconcile({
      backgroundHasMaterial: backgroundHasSigningMaterial(res),
      backgroundPassword: res?.ok ? res.unlockPassword : undefined,
      uiPassword,
      needsVaultHydrate: needsVault || !isUnlocked(),
    });

    if (plan === 'lock') {
      await lockWallet();
      return false;
    }

    const password = (res && res.ok ? res.unlockPassword : undefined) || uiPassword;
    if (plan === 'repair' && password) {
      await persistUnlockPassword(password);
      if (isUnlocked()) {
        notifySessionChanged();
        return true;
      }
    }
    if ((plan === 'hydrate' || plan === 'repair') && password) {
      if (!(res && res.ok && res.unlockPassword)) await persistUnlockPassword(password);
      const vaultOk = await hydrateVaultKeys(password);
      if (!vaultOk && getLocalKeys().size === 0) {
        await lockWallet();
        return false;
      }
      if (!isUnlocked()) return hydrateAccountFromBackground();
      notifySessionChanged();
      return true;
    }
    if (isUnlocked()) return true;
    return hydrateAccountFromBackground();
  } catch {
    clearAccountSession();
    setUnlockedAccount(null, null);
    notifySessionChanged();
    return false;
  }
}

export type { AccountKind };
