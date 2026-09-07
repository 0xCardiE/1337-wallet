import { isKeyBackedKind, type AccountKind } from './accounts';

/** Single chrome.storage.session blob so PK / hardware / password cannot drift apart. */
export const UNLOCKED_SESSION_BLOB_KEY = '1337_unlocked_session';

/** Legacy keys — read once to migrate, then removed. */
export const LEGACY_SESSION_PK_KEY = '1337_session_pk';
export const LEGACY_UNLOCK_PASSWORD_KEY = '1337_session_unlock';
export const LEGACY_HW_SESSION_KEY = '1337_session_hw';
export const LEGACY_ACTIVITY_KEY = '1337_last_activity';

export type HardwareSessionBlob = {
  kind: 'ledger' | 'trezor';
  accountId: string;
  address: string;
  derivationPath: string;
};

export type UnlockedSessionBlob = {
  privateKeyHex?: string;
  unlockPassword?: string;
  hardware?: HardwareSessionBlob;
  lastActivity?: number;
};

export type SessionPatch = {
  clear?: boolean;
  privateKeyHex?: string;
  unlockPassword?: string;
  hardware?: HardwareSessionBlob;
  lastActivity?: number;
};

export function applySessionPatch(
  current: UnlockedSessionBlob,
  patch: SessionPatch,
  now = Date.now(),
): UnlockedSessionBlob {
  if (patch.clear) return { lastActivity: now };

  const next: UnlockedSessionBlob = {
    ...current,
    lastActivity: patch.lastActivity ?? now,
  };

  if (typeof patch.unlockPassword === 'string' && patch.unlockPassword.length > 0) {
    next.unlockPassword = patch.unlockPassword;
  }

  if (typeof patch.privateKeyHex === 'string' && patch.privateKeyHex.length > 0) {
    next.privateKeyHex = patch.privateKeyHex;
    delete next.hardware;
  }

  if (patch.hardware) {
    next.hardware = patch.hardware;
    delete next.privateKeyHex;
  }

  return next;
}

export function sessionHasSigningMaterial(blob: UnlockedSessionBlob): boolean {
  return Boolean(blob.privateKeyHex) || blob.hardware != null;
}

/**
 * Unlocked means the vault can be opened again (all seed keys), not merely that
 * the last active private key is still in memory.
 */
export function isUnlockedSessionConsistent(blob: UnlockedSessionBlob): boolean {
  return sessionHasSigningMaterial(blob) && Boolean(blob.unlockPassword);
}

export function sessionBlobFromLegacy(parts: {
  privateKeyHex?: unknown;
  unlockPassword?: unknown;
  hardware?: unknown;
  lastActivity?: unknown;
}): UnlockedSessionBlob {
  const blob: UnlockedSessionBlob = {};
  if (typeof parts.privateKeyHex === 'string' && parts.privateKeyHex.length > 0) {
    blob.privateKeyHex = parts.privateKeyHex;
  }
  if (typeof parts.unlockPassword === 'string' && parts.unlockPassword.length > 0) {
    blob.unlockPassword = parts.unlockPassword;
  }
  if (parts.hardware && typeof parts.hardware === 'object') {
    const row = parts.hardware as HardwareSessionBlob;
    if (row.kind === 'ledger' || row.kind === 'trezor') {
      blob.hardware = row;
    }
  }
  if (typeof parts.lastActivity === 'number' && Number.isFinite(parts.lastActivity)) {
    blob.lastActivity = parts.lastActivity;
  }
  return blob;
}

export function sessionNeedsVaultHydrate(
  accounts: Array<{ id: string; kind: AccountKind; derivationPath?: string }>,
  localKeyIds: Iterable<string>,
  hasMnemonic: boolean,
): boolean {
  const ids = localKeyIds instanceof Set ? localKeyIds : new Set(localKeyIds);
  for (const account of accounts) {
    if (!isKeyBackedKind(account.kind)) continue;
    if (!ids.has(account.id)) return true;
    if (account.derivationPath && !hasMnemonic) return true;
  }
  return false;
}

/**
 * Decide how UI and background should converge. `uiPassword` is the in-page
 * unlock password, if the panel is still alive.
 */
export function planSessionReconcile(input: {
  backgroundHasMaterial: boolean;
  backgroundPassword: string | undefined;
  uiPassword: string | null;
  needsVaultHydrate: boolean;
}): 'lock' | 'repair' | 'hydrate' | 'keep' {
  if (!input.backgroundHasMaterial) return 'lock';
  const password = input.backgroundPassword || input.uiPassword;
  if (!password) return 'lock';
  if (!input.backgroundPassword && input.uiPassword) {
    return input.needsVaultHydrate ? 'hydrate' : 'repair';
  }
  if (input.needsVaultHydrate) return 'hydrate';
  return 'keep';
}
