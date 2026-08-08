import type { PrivateKeyAccount } from 'viem/accounts';
import { privateKeyToAccount } from 'viem/accounts';
import {
  getActiveAccount,
  isHardwareAccount,
  isKeyBackedKind,
  type WalletAccount,
} from './accounts';

let unlocked: PrivateKeyAccount | null = null;
let sessionPrivateKey: `0x${string}` | null = null;
let sessionPassword: string | null = null;
let sessionMnemonic: string | null = null;
let localKeys = new Map<string, `0x${string}`>();
let accounts: WalletAccount[] = [];
let activeAccountId: string | undefined;

export function setSessionPassword(password: string | null): void {
  sessionPassword = password;
}

export function getSessionPassword(): string | null {
  return sessionPassword;
}

export function setSessionMnemonic(mnemonic: string | null): void {
  sessionMnemonic = mnemonic;
}

export function getSessionMnemonic(): string | null {
  return sessionMnemonic;
}

export function hasSessionMnemonic(): boolean {
  return Boolean(sessionMnemonic);
}

export function setAccountsMeta(
  next: WalletAccount[],
  nextActiveId?: string,
): void {
  accounts = next;
  activeAccountId = nextActiveId;
  syncActiveFromMeta();
}

export function getAccountsMeta(): WalletAccount[] {
  return accounts;
}

export function getActiveAccountMeta(): WalletAccount | undefined {
  return getActiveAccount(accounts, activeAccountId);
}

export function getActiveAccountId(): string | undefined {
  return activeAccountId;
}

export function setLocalKeys(keys: Record<string, `0x${string}`>): void {
  localKeys = new Map(Object.entries(keys));
}

export function getLocalKeys(): Map<string, `0x${string}`> {
  return localKeys;
}

export function setUnlockedAccount(
  account: PrivateKeyAccount | null,
  privateKey?: `0x${string}` | null,
): void {
  unlocked = account;
  if (privateKey !== undefined) {
    sessionPrivateKey = privateKey;
  } else if (account === null) {
    sessionPrivateKey = null;
  }
}

/** Activate a local or hardware account already present in session meta. */
export function activateAccount(accountId: string): WalletAccount {
  const meta = accounts.find(a => a.id === accountId);
  if (!meta) throw new Error('Account not found.');
  activeAccountId = accountId;
  if (isKeyBackedKind(meta.kind)) {
    const pk = localKeys.get(accountId);
    if (!pk) throw new Error('Local key missing — unlock again.');
    setUnlockedAccount(privateKeyToAccount(pk), pk);
  } else {
    // Hardware: expose address via a read-only account stub for UI/provider.
    setUnlockedAccount(
      {
        address: meta.address,
        type: 'local',
        source: 'custom',
        publicKey: '0x',
        signMessage: async () => {
          throw new Error('Use hardware device to sign.');
        },
        signTransaction: async () => {
          throw new Error('Use hardware device to sign.');
        },
        signTypedData: async () => {
          throw new Error('Use hardware device to sign.');
        },
      } as unknown as PrivateKeyAccount,
      null,
    );
  }
  return meta;
}

function syncActiveFromMeta(): void {
  const active = getActiveAccount(accounts, activeAccountId);
  if (!active) {
    setUnlockedAccount(null, null);
    return;
  }
  try {
    activateAccount(active.id);
  } catch {
    /* keys may not be loaded yet */
  }
}

export function getUnlockedAccount(): PrivateKeyAccount | null {
  return unlocked;
}

export function getSessionPrivateKey(): `0x${string}` | null {
  const active = getActiveAccountMeta();
  if (active && isHardwareAccount(active)) return null;
  return sessionPrivateKey;
}

export function isUnlocked(): boolean {
  return accounts.length > 0 && getActiveAccountMeta() != null && unlocked !== null;
}

export function clearAccountSession(): void {
  unlocked = null;
  sessionPrivateKey = null;
  sessionPassword = null;
  sessionMnemonic = null;
  localKeys = new Map();
  accounts = [];
  activeAccountId = undefined;
}
