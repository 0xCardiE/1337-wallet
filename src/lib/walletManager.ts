import { getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createAccountId,
  defaultAccountLabel,
  DEFAULT_ETH_DERIVATION_PATH,
  isKeyBackedKind,
  type AccountKind,
  type WalletAccount,
} from './accounts';
import {
  activateAccount,
  clearAccountSession,
  getAccountsMeta,
  getActiveAccountId,
  getLocalKeys,
  getSessionMnemonic,
  getSessionPassword,
  setAccountsMeta,
  setLocalKeys,
  setSessionMnemonic,
  setSessionPassword,
  setUnlockedAccount,
} from './accountSession';
import {
  loadPersisted,
  saveAccountsState,
  setActiveAccountId as persistActiveAccountId,
} from './storageState';
import { decryptVaultSecrets, encryptVaultSecrets } from './vault';
import {
  accountFromPrivateKey,
  ethDerivationPath,
  generateNewMnemonic,
  generateNewPrivateKey,
  looksLikeMnemonic,
  parseImportMnemonic,
  parseImportPrivateKey,
  privateKeyFromMnemonic,
} from './walletCore';
import {
  persistSessionPrivateKey,
  persistUnlockPassword,
  clearSessionInBackground,
} from './sessionBridge';

function normalizeAddress(address: string): `0x${string}` {
  return getAddress(address).toLowerCase() as `0x${string}`;
}

function nextSeedAddressIndex(accounts: WalletAccount[]): number {
  let max = -1;
  for (const account of accounts) {
    const match = account.derivationPath?.match(/^m\/44'\/60'\/0'\/0\/(\d+)$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

async function persistLocalVault(
  keys: Record<string, `0x${string}`>,
  accounts: WalletAccount[],
  activeAccountId: string | undefined,
  mnemonic?: string | null,
): Promise<void> {
  const password = getSessionPassword();
  if (!password) throw new Error('Unlock the wallet to update local keys.');
  const vault = await encryptVaultSecrets(
    {
      keys,
      mnemonic: mnemonic === null ? undefined : mnemonic ?? getSessionMnemonic() ?? undefined,
    },
    password,
  );
  await saveAccountsState({ vault, accounts, activeAccountId });
}

/** Align vault key map with account metadata (id mismatches, HD re-derive). */
function reconcileVaultKeys(
  keys: Record<string, `0x${string}`>,
  accounts: WalletAccount[],
  mnemonic?: string,
): Record<string, `0x${string}`> {
  const out = { ...keys };
  const byAddress = new Map<string, `0x${string}`>();
  for (const pk of Object.values(out)) {
    try {
      byAddress.set(normalizeAddress(privateKeyToAccount(pk).address), pk);
    } catch {
      /* skip malformed */
    }
  }

  for (const account of accounts) {
    if (!isKeyBackedKind(account.kind) || out[account.id]) continue;

    const byAddr = byAddress.get(account.address);
    if (byAddr) {
      out[account.id] = byAddr;
      continue;
    }

    if (mnemonic && account.derivationPath) {
      const match = account.derivationPath.match(/^m\/44'\/60'\/0'\/0\/(\d+)$/);
      if (match) {
        out[account.id] = privateKeyFromMnemonic(mnemonic, Number(match[1]));
      }
    }
  }
  return out;
}

function resolveUnlockableActiveId(
  accounts: WalletAccount[],
  preferredId: string | undefined,
  keys: Record<string, `0x${string}`>,
): string {
  const preferred = accounts.find(a => a.id === preferredId);
  if (preferred && isKeyBackedKind(preferred.kind)) {
    if (keys[preferred.id]) return preferred.id;
  } else if (preferred) {
    return preferred.id;
  }

  const firstLocal = accounts.find(a => isKeyBackedKind(a.kind) && keys[a.id]);
  if (firstLocal) return firstLocal.id;

  const firstAny = accounts[0];
  if (!firstAny) throw new Error('No accounts in vault.');
  if (isKeyBackedKind(firstAny.kind) && !keys[firstAny.id]) {
    throw new Error(
      'Local key missing for this account. Switch back to an account you fully unlocked, or restore from backup.',
    );
  }
  return firstAny.id;
}

async function loadAllLocalKeysFromVault(
  password: string,
): Promise<Record<string, `0x${string}`>> {
  const state = await loadPersisted();
  if (!state.vault) throw new Error('No vault found.');
  const secrets = await decryptVaultSecrets(state.vault, password);
  const keys = reconcileVaultKeys(secrets.keys, state.accounts, secrets.mnemonic);
  setSessionPassword(password);
  setSessionMnemonic(secrets.mnemonic ?? null);
  setLocalKeys(keys);
  setAccountsMeta(state.accounts, state.activeAccountId);
  return keys;
}

async function ensureLocalKeyForAccount(accountId: string): Promise<`0x${string}`> {
  const cached = getLocalKeys().get(accountId);
  if (cached) return cached;

  const meta = getAccountsMeta().find(a => a.id === accountId);
  if (!meta) throw new Error('Account not found.');
  if (!isKeyBackedKind(meta.kind)) throw new Error('Not a software account.');

  const password = getSessionPassword();
  if (password) {
    const keys = await loadAllLocalKeysFromVault(password);
    const pk = keys[accountId];
    if (pk) return pk;
  }

  const mnemonic = getSessionMnemonic();
  if (mnemonic && meta.derivationPath) {
    const match = meta.derivationPath.match(/^m\/44'\/60'\/0'\/0\/(\d+)$/);
    if (match) {
      const pk = privateKeyFromMnemonic(mnemonic, Number(match[1]));
      const merged = Object.fromEntries(getLocalKeys());
      merged[accountId] = pk;
      setLocalKeys(merged);
      return pk;
    }
  }

  throw new Error('Local key missing — unlock again.');
}

export async function hydrateLocalKeysFromVault(password: string): Promise<void> {
  await loadAllLocalKeysFromVault(password);
}

/** Unlock vault, migrate v1→v2 if needed, hydrate session. */
export async function unlockWallet(password: string): Promise<void> {
  const state = await loadPersisted();
  if (!state.vault) throw new Error('No vault found.');

  let secrets = await decryptVaultSecrets(state.vault, password);
  let keys = secrets.keys;
  let accounts = [...state.accounts];
  let activeAccountId = state.activeAccountId;
  let vault = state.vault;

  // Migrate legacy single-key vault into multi-account shape.
  if (vault.v === 1 || accounts.length === 0) {
    const legacyPk = keys.legacy ?? Object.values(keys)[0];
    if (!legacyPk) throw new Error('Vault has no keys');
    const address = normalizeAddress(privateKeyToAccount(legacyPk).address);
    const id = createAccountId('local', address);
    keys = { [id]: legacyPk };
    accounts = [
      {
        id,
        address,
        label: defaultAccountLabel('local', address),
        kind: 'local',
        createdAt: Date.now(),
      },
    ];
    activeAccountId = id;
    vault = await encryptVaultSecrets({ keys, mnemonic: secrets.mnemonic }, password);
    await saveAccountsState({ vault, accounts, activeAccountId });
  } else if (secrets.mnemonic || vault.v === 2) {
    // Ensure payload stays on secrets shape when re-saving later
    secrets = { keys, mnemonic: secrets.mnemonic };
  }

  setSessionPassword(password);
  setSessionMnemonic(secrets.mnemonic ?? null);
  keys = reconcileVaultKeys(keys, accounts, secrets.mnemonic);
  setLocalKeys(keys);

  const resolvedActiveId = resolveUnlockableActiveId(accounts, activeAccountId, keys);
  if (resolvedActiveId !== activeAccountId) {
    activeAccountId = resolvedActiveId;
    await saveAccountsState({ accounts, activeAccountId });
  }

  setAccountsMeta(accounts, activeAccountId);
  const active = activateAccount(activeAccountId ?? accounts[0]!.id);
  if (isKeyBackedKind(active.kind)) {
    const pk = getLocalKeys().get(active.id);
    if (pk) {
      await persistSessionPrivateKey(pk, password);
      await persistUnlockPassword(password);
    }
  } else {
    await persistHardwareSession(active);
  }
}

/** Create a new wallet from a fresh BIP-39 seed (account #0). */
export async function createInitialWallet(password: string): Promise<{
  mnemonic: string;
  privateKey: `0x${string}`;
  account: WalletAccount;
}> {
  const mnemonic = generateNewMnemonic();
  const pk = privateKeyFromMnemonic(mnemonic, 0);
  const address = normalizeAddress(accountFromPrivateKey(pk).address);
  const id = createAccountId('local', address);
  const account: WalletAccount = {
    id,
    address,
    label: 'Account 1',
    kind: 'local',
    derivationPath: ethDerivationPath(0),
    createdAt: Date.now(),
  };
  const vault = await encryptVaultSecrets({ keys: { [id]: pk }, mnemonic }, password);
  await saveAccountsState({ vault, accounts: [account], activeAccountId: id });
  setSessionPassword(password);
  setSessionMnemonic(mnemonic);
  setLocalKeys({ [id]: pk });
  setAccountsMeta([account], id);
  activateAccount(id);
  await persistSessionPrivateKey(pk);
  return { mnemonic, privateKey: pk, account };
}

/** Create a wallet from a single random private key (no seed phrase). */
export async function createInitialPrivateKeyWallet(password: string): Promise<{
  privateKey: `0x${string}`;
  account: WalletAccount;
}> {
  const pk = generateNewPrivateKey();
  const address = normalizeAddress(accountFromPrivateKey(pk).address);
  const id = createAccountId('local', address);
  const account: WalletAccount = {
    id,
    address,
    label: defaultAccountLabel('local', address),
    kind: 'local',
    createdAt: Date.now(),
  };
  const vault = await encryptVaultSecrets({ keys: { [id]: pk } }, password);
  await saveAccountsState({ vault, accounts: [account], activeAccountId: id });
  setSessionPassword(password);
  setSessionMnemonic(null);
  setLocalKeys({ [id]: pk });
  setAccountsMeta([account], id);
  activateAccount(id);
  await persistSessionPrivateKey(pk);
  return { privateKey: pk, account };
}

export async function importInitialWallet(
  password: string,
  secretInput: string,
): Promise<WalletAccount> {
  if (looksLikeMnemonic(secretInput)) {
    return importInitialMnemonicWallet(password, secretInput);
  }
  const pk = parseImportPrivateKey(secretInput);
  const address = normalizeAddress(accountFromPrivateKey(pk).address);
  const id = createAccountId('imported', address);
  const account: WalletAccount = {
    id,
    address,
    label: defaultAccountLabel('imported', address),
    kind: 'imported',
    createdAt: Date.now(),
  };
  const vault = await encryptVaultSecrets({ keys: { [id]: pk } }, password);
  await saveAccountsState({ vault, accounts: [account], activeAccountId: id });
  setSessionPassword(password);
  setSessionMnemonic(null);
  setLocalKeys({ [id]: pk });
  setAccountsMeta([account], id);
  activateAccount(id);
  await persistSessionPrivateKey(pk);
  return account;
}

export async function importInitialMnemonicWallet(
  password: string,
  mnemonicInput: string,
): Promise<WalletAccount> {
  const mnemonic = parseImportMnemonic(mnemonicInput);
  const pk = privateKeyFromMnemonic(mnemonic, 0);
  const address = normalizeAddress(accountFromPrivateKey(pk).address);
  const id = createAccountId('local', address);
  const account: WalletAccount = {
    id,
    address,
    label: 'Account 1',
    kind: 'local',
    derivationPath: ethDerivationPath(0),
    createdAt: Date.now(),
  };
  const vault = await encryptVaultSecrets({ keys: { [id]: pk }, mnemonic }, password);
  await saveAccountsState({ vault, accounts: [account], activeAccountId: id });
  setSessionPassword(password);
  setSessionMnemonic(mnemonic);
  setLocalKeys({ [id]: pk });
  setAccountsMeta([account], id);
  activateAccount(id);
  await persistSessionPrivateKey(pk);
  return account;
}

export async function addLocalAccount(opts: {
  privateKeyInput?: string;
  mnemonicInput?: string;
  label?: string;
}): Promise<WalletAccount> {
  const password = getSessionPassword();
  if (!password) throw new Error('Unlock the wallet to add an account.');

  if (opts.mnemonicInput?.trim()) {
    return importMnemonicIntoVault(opts.mnemonicInput, opts.label);
  }

  const pk = opts.privateKeyInput
    ? parseImportPrivateKey(opts.privateKeyInput)
    : generateNewPrivateKey();
  const imported = Boolean(opts.privateKeyInput);
  const kind: AccountKind = imported ? 'imported' : 'local';
  const address = normalizeAddress(accountFromPrivateKey(pk).address);
  const id = createAccountId(kind, address);
  const existing = getAccountsMeta();
  if (existing.some(a => a.address === address || a.id === id)) {
    throw new Error('That account is already imported.');
  }

  const account: WalletAccount = {
    id,
    address,
    label: opts.label?.trim() || defaultAccountLabel(kind, address),
    kind,
    createdAt: Date.now(),
  };

  const nextKeys: Record<string, `0x${string}`> = Object.fromEntries(getLocalKeys());
  nextKeys[id] = pk;
  const accounts = [...existing, account];
  await persistLocalVault(nextKeys, accounts, id);
  setLocalKeys(nextKeys);
  setAccountsMeta(accounts, id);
  activateAccount(id);
  await persistSessionPrivateKey(pk);
  return account;
}

/** Derive the next HD account from the vault seed (MetaMask-style Account N). */
export async function addDerivedSeedAccount(label?: string): Promise<WalletAccount> {
  const mnemonic = getSessionMnemonic();
  if (!mnemonic) {
    throw new Error('No seed phrase in this vault. Import a seed or create a new seed wallet.');
  }
  const password = getSessionPassword();
  if (!password) throw new Error('Unlock the wallet to add an account.');

  const existing = getAccountsMeta();
  const index = nextSeedAddressIndex(existing);
  const pk = privateKeyFromMnemonic(mnemonic, index);
  const address = normalizeAddress(accountFromPrivateKey(pk).address);
  const id = createAccountId('local', address);
  if (existing.some(a => a.address === address || a.id === id)) {
    throw new Error('That derived account is already present.');
  }

  const account: WalletAccount = {
    id,
    address,
    label: label?.trim() || `Account ${index + 1}`,
    kind: 'local',
    derivationPath: ethDerivationPath(index),
    createdAt: Date.now(),
  };
  const nextKeys: Record<string, `0x${string}`> = Object.fromEntries(getLocalKeys());
  nextKeys[id] = pk;
  const accounts = [...existing, account];
  await persistLocalVault(nextKeys, accounts, id, mnemonic);
  setLocalKeys(nextKeys);
  setAccountsMeta(accounts, id);
  activateAccount(id);
  await persistSessionPrivateKey(pk);
  return account;
}

async function importMnemonicIntoVault(
  mnemonicInput: string,
  label?: string,
): Promise<WalletAccount> {
  const mnemonic = parseImportMnemonic(mnemonicInput);
  const existing = getAccountsMeta();
  if (getSessionMnemonic()) {
    throw new Error(
      'This vault already has a seed phrase. Use “Add from seed” to derive another account.',
    );
  }

  const pk = privateKeyFromMnemonic(mnemonic, 0);
  const address = normalizeAddress(accountFromPrivateKey(pk).address);
  const id = createAccountId('local', address);
  if (existing.some(a => a.address === address || a.id === id)) {
    throw new Error('That account is already imported.');
  }

  const account: WalletAccount = {
    id,
    address,
    label: label?.trim() || 'Account 1',
    kind: 'local',
    derivationPath: ethDerivationPath(0),
    createdAt: Date.now(),
  };
  const nextKeys: Record<string, `0x${string}`> = Object.fromEntries(getLocalKeys());
  nextKeys[id] = pk;
  const accounts = [...existing, account];
  await persistLocalVault(nextKeys, accounts, id, mnemonic);
  setSessionMnemonic(mnemonic);
  setLocalKeys(nextKeys);
  setAccountsMeta(accounts, id);
  activateAccount(id);
  await persistSessionPrivateKey(pk);
  return account;
}

export async function addHardwareAccount(opts: {
  kind: 'ledger' | 'trezor';
  address: string;
  derivationPath?: string;
  label?: string;
}): Promise<WalletAccount> {
  const address = normalizeAddress(opts.address);
  const id = createAccountId(opts.kind, address);
  const existing = getAccountsMeta();
  if (existing.some(a => a.address === address || a.id === id)) {
    throw new Error('That account is already imported.');
  }
  const account: WalletAccount = {
    id,
    address,
    label: opts.label?.trim() || defaultAccountLabel(opts.kind, address),
    kind: opts.kind,
    derivationPath: opts.derivationPath || DEFAULT_ETH_DERIVATION_PATH,
    createdAt: Date.now(),
  };
  const accounts = [...existing, account];
  await saveAccountsState({
    accounts,
    activeAccountId: id,
  });
  setAccountsMeta(accounts, id);
  activateAccount(id);
  await persistHardwareSession(account);
  return account;
}

export async function switchActiveAccount(accountId: string): Promise<WalletAccount> {
  const previousId = getActiveAccountId();
  const meta = getAccountsMeta().find(a => a.id === accountId);
  if (!meta) throw new Error('Account not found.');

  try {
    if (isKeyBackedKind(meta.kind)) {
      await ensureLocalKeyForAccount(accountId);
    }
    await persistActiveAccountId(accountId);
    const activated = activateAccount(accountId);
    setAccountsMeta(getAccountsMeta(), accountId);
    if (isKeyBackedKind(activated.kind)) {
      const pk = getLocalKeys().get(activated.id);
      if (!pk) throw new Error('Local key missing — unlock again.');
      const pwd = getSessionPassword();
      await persistSessionPrivateKey(pk, pwd ?? undefined);
      if (pwd) await persistUnlockPassword(pwd);
    } else {
      await persistHardwareSession(activated);
    }
    return activated;
  } catch (e) {
    if (previousId && previousId !== accountId) {
      try {
        await persistActiveAccountId(previousId);
        activateAccount(previousId);
        setAccountsMeta(getAccountsMeta(), previousId);
      } catch {
        /* best-effort rollback */
      }
    }
    throw e;
  }
}

export async function removeAccount(accountId: string): Promise<void> {
  const password = getSessionPassword();
  const existing = getAccountsMeta();
  const target = existing.find(a => a.id === accountId);
  if (!target) throw new Error('Account not found.');
  if (existing.length === 1) {
    throw new Error('Cannot remove the last account. Wipe the wallet instead.');
  }

  const accounts = existing.filter(a => a.id !== accountId);
  const nextActive = accounts[0]!.id;

  if (isKeyBackedKind(target.kind)) {
    if (!password) throw new Error('Unlock the wallet to remove a software account.');
    const nextKeys: Record<string, `0x${string}`> = Object.fromEntries(getLocalKeys());
    delete nextKeys[accountId];
    await persistLocalVault(nextKeys, accounts, nextActive);
    setLocalKeys(nextKeys);
  } else {
    await saveAccountsState({ accounts, activeAccountId: nextActive });
  }

  setAccountsMeta(accounts, nextActive);
  await switchActiveAccount(nextActive);
}

export async function renameAccount(accountId: string, label: string): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error('Label required.');
  const accounts = getAccountsMeta().map(a =>
    a.id === accountId ? { ...a, label: trimmed } : a,
  );
  await saveAccountsState({
    accounts,
    activeAccountId: getActiveAccountId(),
  });
  setAccountsMeta(accounts, getActiveAccountId());
}

export async function lockManagedWallet(): Promise<void> {
  await clearSessionInBackground();
  clearAccountSession();
  setUnlockedAccount(null, null);
}

async function persistHardwareSession(account: WalletAccount): Promise<void> {
  await chrome.runtime.sendMessage({
    type: 'SET_SESSION',
    session: {
      kind: account.kind,
      accountId: account.id,
      address: account.address,
      derivationPath: account.derivationPath || DEFAULT_ETH_DERIVATION_PATH,
    },
  });
}

export type { AccountKind, WalletAccount };
