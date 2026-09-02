export type AccountKind = 'local' | 'imported' | 'ledger' | 'trezor';

export interface WalletAccount {
  id: string;
  address: `0x${string}`;
  label: string;
  kind: AccountKind;
  /** BIP-44 path for hardware wallets */
  derivationPath?: string;
  /**
   * Per-account Burner Mode. Only for local/imported keys.
   * `undefined` inherits the legacy global `txConfirmMode` until the user toggles.
   */
  instant?: boolean;
  createdAt: number;
}

export const DEFAULT_ETH_DERIVATION_PATH = "m/44'/60'/0'/0/0";

export function createAccountId(kind: AccountKind, address: string): string {
  return `${kind}:${address.toLowerCase()}`;
}

export function shortAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function isKeyBackedKind(kind: AccountKind): boolean {
  return kind === 'local' || kind === 'imported';
}

export function isKeyBackedAccount(account: WalletAccount | null | undefined): boolean {
  return account != null && isKeyBackedKind(account.kind);
}

export function defaultAccountLabel(kind: AccountKind, address: string): string {
  const short = shortAddress(address);
  if (kind === 'ledger') return `Ledger ${short}`;
  if (kind === 'trezor') return `Trezor ${short}`;
  if (kind === 'imported') return `Imported ${short}`;
  return short;
}

/**
 * Short origin for the switcher / account lists.
 * Hardware = device name. Seed-derived (`derivationPath`) = Seed.
 * Standalone generated or imported hex keys = Pvt key.
 */
export function accountKindLabel(
  accountOrKind: AccountKind | Pick<WalletAccount, 'kind' | 'derivationPath'>,
): string {
  const kind = typeof accountOrKind === 'string' ? accountOrKind : accountOrKind.kind;
  const derivationPath =
    typeof accountOrKind === 'string' ? undefined : accountOrKind.derivationPath;
  if (kind === 'ledger') return 'Ledger';
  if (kind === 'trezor') return 'Trezor';
  if (kind === 'imported') return 'Pvt key';
  return derivationPath ? 'Seed' : 'Pvt key';
}

export function isHardwareAccount(account: WalletAccount | null | undefined): boolean {
  return account?.kind === 'ledger' || account?.kind === 'trezor';
}

export function normalizeAccount(raw: unknown): WalletAccount | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Partial<WalletAccount>;
  if (typeof row.address !== 'string') return null;
  const address = row.address.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) return null;
  const kind: AccountKind =
    row.kind === 'ledger' || row.kind === 'trezor' || row.kind === 'local' || row.kind === 'imported'
      ? row.kind
      : 'local';
  const id =
    typeof row.id === 'string' && row.id.trim()
      ? row.id.trim()
      : createAccountId(kind, address);
  const label =
    typeof row.label === 'string' && row.label.trim()
      ? row.label.trim()
      : defaultAccountLabel(kind, address);
  const derivationPath =
    typeof row.derivationPath === 'string' && row.derivationPath.trim()
      ? row.derivationPath.trim()
      : isKeyBackedKind(kind)
        ? undefined
        : DEFAULT_ETH_DERIVATION_PATH;
  const createdAt =
    typeof row.createdAt === 'number' && Number.isFinite(row.createdAt)
      ? row.createdAt
      : Date.now();
  const instant =
    isKeyBackedKind(kind) && typeof row.instant === 'boolean' ? row.instant : undefined;
  return {
    id,
    address: address as `0x${string}`,
    label,
    kind,
    derivationPath,
    createdAt,
    ...(instant !== undefined ? { instant } : {}),
  };
}

export function normalizeAccounts(list: unknown): WalletAccount[] {
  if (!Array.isArray(list)) return [];
  const out: WalletAccount[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const account = normalizeAccount(item);
    if (!account) continue;
    if (seen.has(account.id) || seen.has(account.address)) continue;
    seen.add(account.id);
    seen.add(account.address);
    out.push(account);
  }
  return out;
}

export function resolveActiveAccountId(
  accounts: WalletAccount[],
  activeAccountId: string | undefined,
): string | undefined {
  if (accounts.length === 0) return undefined;
  if (activeAccountId && accounts.some(a => a.id === activeAccountId)) {
    return activeAccountId;
  }
  return accounts[0]?.id;
}

export function getActiveAccount(
  accounts: WalletAccount[],
  activeAccountId: string | undefined,
): WalletAccount | undefined {
  const id = resolveActiveAccountId(accounts, activeAccountId);
  return accounts.find(a => a.id === id);
}
