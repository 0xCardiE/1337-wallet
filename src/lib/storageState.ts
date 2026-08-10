import type { EncryptedVault } from './vault';
import {
  DEFAULT_CHAIN_ID,
  DEFAULT_SLIPPAGE_PERCENT,
} from './constants';
import {
  setCustomChains,
  type ChainDefinition,
  type ChainKind,
} from './chainCatalog';
import { setPreferredRpcMap, setCustomRpcMap, setCustomChainRpcCatalog } from './chainRpcRegistry';
import {
  normalizeAccounts,
  resolveActiveAccountId,
  type WalletAccount,
} from './accounts';

export type { WalletAccount } from './accounts';
export {
  accountKindLabel,
  DEFAULT_ETH_DERIVATION_PATH,
  getActiveAccount,
  isHardwareAccount,
  shortAddress,
} from './accounts';

export type ToolbarOpenMode = 'popup' | 'side_panel';
/** Speed = auto-confirm dapp requests when unlocked; normal = prompt each time. */
export type TxConfirmMode = 'speed' | 'normal';

export interface AppSettings {
  /** Relay / LiFi swap slippage tolerance in percent (e.g. 5 = 5%). */
  slippagePercent?: number;
  /** Lock after this many minutes with no interaction (0 = off). */
  autoLockMinutes?: number;
  /** Whether the toolbar icon opens the classic popup or the browser side panel. */
  toolbarOpenMode?: ToolbarOpenMode;
  /** Active EVM chain for dapp provider + default network UI. */
  activeChainId?: number;
  /** Preferred RPC URL per chain id (string keys in storage). */
  preferredRpcByChain?: Record<string, string>;
  /** Custom RPC URLs appended per chain id. */
  customRpcByChain?: Record<string, string[]>;
  /** User-added chains (not in the curated catalog). */
  customChains?: ChainDefinition[];
  /** When true, inject as window.ethereum (MetaMask drop-in). When false, use window.wallet1337. */
  replaceMetaMask?: boolean;
  /** Optional Etherscan API v2 key — one key covers most *scan explorers for tx history. */
  explorerApiKey?: string;
  /** Optional The Graph API key for ENS subgraph (100k free queries/mo). */
  theGraphApiKey?: string;
  /** Dapp signing mode — defaults to normal (confirm before sign). */
  txConfirmMode?: TxConfirmMode;
}

export interface PersistedState {
  vault: EncryptedVault | null;
  /** Public account metadata (local + hardware). Local keys live encrypted in vault. */
  accounts: WalletAccount[];
  activeAccountId?: string;
  settings: AppSettings;
}

/** Local storage key for the persisted vault + settings bundle. */
export const WALLET_PERSIST_KEY = '1337_wallet_v1' as const;
const KEY = WALLET_PERSIST_KEY;

const EMPTY: PersistedState = {
  vault: null,
  accounts: [],
  settings: {},
};

function area(): chrome.storage.LocalStorageArea {
  return chrome.storage.local;
}

function normalizeSlippagePercent(
  v: number | undefined | null,
): number | undefined {
  if (v == null || !Number.isFinite(v)) return undefined;
  const clamped = Math.min(50, Math.max(0.01, Math.round(v * 1000) / 1000));
  return clamped;
}

function normalizePreferredRpcMap(
  raw: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeCustomRpcMap(
  raw: Record<string, string[]> | undefined,
): Record<string, string[]> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, string[]> = {};
  for (const [k, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const urls = list.filter(u => typeof u === 'string' && u.trim()).map(u => u.trim());
    if (urls.length) out[k] = urls;
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeCustomChains(
  raw: ChainDefinition[] | undefined,
): ChainDefinition[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ChainDefinition[] = [];
  const seen = new Set<number>();
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const chainId = normalizeChainId(row.chainId);
    if (chainId == null || seen.has(chainId)) continue;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    const shortName = typeof row.shortName === 'string' ? row.shortName.trim() : '';
    const kind: ChainKind = row.kind === 'testnet' ? 'testnet' : 'mainnet';
    const symbol =
      typeof row.nativeCurrency?.symbol === 'string'
        ? row.nativeCurrency.symbol.trim()
        : '';
    const rpcUrls = Array.isArray(row.rpcUrls)
      ? row.rpcUrls.filter(u => typeof u === 'string' && u.trim()).map(u => u.trim())
      : [];
    if (!name || !shortName || !symbol || rpcUrls.length === 0) continue;
    const explorers = Array.isArray(row.blockExplorerUrls)
      ? row.blockExplorerUrls.filter(u => typeof u === 'string' && u.trim()).map(u => u.trim())
      : [];
    const decimals =
      typeof row.nativeCurrency?.decimals === 'number' && Number.isFinite(row.nativeCurrency.decimals)
        ? Math.floor(row.nativeCurrency.decimals)
        : 18;
    const currencyName =
      typeof row.nativeCurrency?.name === 'string' && row.nativeCurrency.name.trim()
        ? row.nativeCurrency.name.trim()
        : symbol;
    const def: ChainDefinition = {
      chainId,
      name,
      shortName,
      kind,
      nativeCurrency: { name: currencyName, symbol, decimals },
      rpcUrls,
      blockExplorerUrls: explorers,
    };
    if (typeof row.logoSlug === 'string' && row.logoSlug.trim()) {
      def.logoSlug = row.logoSlug.trim();
    }
    if (typeof row.logoURI === 'string' && row.logoURI.trim()) {
      def.logoURI = row.logoURI.trim();
    }
    seen.add(chainId);
    out.push(def);
  }
  return out.length ? out : undefined;
}

function applyRpcPreferences(settings: AppSettings): void {
  const preferred: Record<number, string> = {};
  const custom: Record<number, string[]> = {};
  for (const [k, v] of Object.entries(settings.preferredRpcByChain ?? {})) {
    const id = Number(k);
    if (Number.isFinite(id) && v) preferred[id] = v;
  }
  for (const [k, list] of Object.entries(settings.customRpcByChain ?? {})) {
    const id = Number(k);
    if (Number.isFinite(id) && list?.length) custom[id] = list;
  }
  const customChains = settings.customChains ?? [];
  setCustomChains(customChains);
  setCustomChainRpcCatalog(customChains);
  setPreferredRpcMap(preferred);
  setCustomRpcMap(custom);
}

export async function loadPersisted(): Promise<PersistedState> {
  return new Promise((resolve, reject) => {
    area().get([KEY], (r) => {
      const err = chrome.runtime?.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      const row = r[KEY] as PersistedState | undefined;
      if (!row) {
        resolve({ ...EMPTY });
        return;
      }
      const tm = normalizeToolbarOpenMode(row.settings?.toolbarOpenMode);
      const accounts = normalizeAccounts(
        (row as PersistedState).accounts ?? (row as { accounts?: unknown }).accounts,
      );
      const next: PersistedState = {
        vault: row.vault ?? null,
        accounts,
        activeAccountId: resolveActiveAccountId(
          accounts,
          (row as PersistedState).activeAccountId,
        ),
        settings: {
          slippagePercent: normalizeSlippagePercent(row.settings?.slippagePercent),
          autoLockMinutes: normalizeAutoLockMinutes(row.settings?.autoLockMinutes),
          activeChainId: normalizeChainId(row.settings?.activeChainId),
          preferredRpcByChain: normalizePreferredRpcMap(row.settings?.preferredRpcByChain),
          customRpcByChain: normalizeCustomRpcMap(row.settings?.customRpcByChain),
          customChains: normalizeCustomChains(row.settings?.customChains),
          replaceMetaMask: row.settings?.replaceMetaMask !== false,
          explorerApiKey:
            typeof row.settings?.explorerApiKey === 'string' && row.settings.explorerApiKey.trim()
              ? row.settings.explorerApiKey.trim()
              : undefined,
          theGraphApiKey:
            typeof row.settings?.theGraphApiKey === 'string' && row.settings.theGraphApiKey.trim()
              ? row.settings.theGraphApiKey.trim()
              : undefined,
          txConfirmMode: normalizeTxConfirmMode(row.settings?.txConfirmMode),
          ...(tm ? { toolbarOpenMode: tm } : {}),
        },
      };
      applyRpcPreferences(next.settings);
      resolve(next);
    });
  });
}

export async function savePersisted(next: PersistedState): Promise<void> {
  return new Promise((resolve, reject) => {
    area().set({ [KEY]: next }, () => {
      const e = chrome.runtime?.lastError;
      if (e) reject(new Error(e.message));
      else resolve();
    });
  });
}

export async function setVault(vault: EncryptedVault | null): Promise<void> {
  const cur = await loadPersisted();
  if (vault == null) {
    await savePersisted({
      ...cur,
      vault: null,
      accounts: [],
      activeAccountId: undefined,
    });
    return;
  }
  await savePersisted({ ...cur, vault });
}

export async function saveAccountsState(patch: {
  vault?: EncryptedVault | null;
  accounts: WalletAccount[];
  activeAccountId?: string;
}): Promise<void> {
  const cur = await loadPersisted();
  const accounts = normalizeAccounts(patch.accounts);
  await savePersisted({
    ...cur,
    vault: patch.vault !== undefined ? patch.vault : cur.vault,
    accounts,
    activeAccountId: resolveActiveAccountId(accounts, patch.activeAccountId),
  });
}

export async function setActiveAccountId(accountId: string): Promise<void> {
  const cur = await loadPersisted();
  if (!cur.accounts.some(a => a.id === accountId)) {
    throw new Error('Account not found.');
  }
  await savePersisted({ ...cur, activeAccountId: accountId });
}

export async function patchSettings(patch: AppSettings): Promise<void> {
  const cur = await loadPersisted();
  const merged: AppSettings = { ...cur.settings, ...patch };
  if (patch.txConfirmMode !== undefined) {
    merged.txConfirmMode = normalizeTxConfirmMode(patch.txConfirmMode);
  }
  applyRpcPreferences(merged);
  await savePersisted({
    ...cur,
    settings: merged,
  });
}

function normalizeChainId(v: number | undefined | null): number | undefined {
  if (v == null || !Number.isFinite(v) || v <= 0) return undefined;
  return Math.floor(v);
}

function normalizeAutoLockMinutes(
  v: number | undefined | null,
): number | undefined {
  if (v == null || !Number.isFinite(v) || v === 0) return undefined;
  const allowed = [5, 15, 30, 60];
  return allowed.includes(v) ? v : undefined;
}

function normalizeToolbarOpenMode(
  v: string | undefined | null,
): ToolbarOpenMode | undefined {
  if (v === 'side_panel' || v === 'popup') return v;
  return undefined;
}

function normalizeTxConfirmMode(
  v: string | undefined | null,
): TxConfirmMode {
  return v === 'speed' ? 'speed' : 'normal';
}

export function effectiveSlippagePercent(settings: AppSettings): number {
  const n = normalizeSlippagePercent(settings.slippagePercent);
  return n ?? DEFAULT_SLIPPAGE_PERCENT;
}

/** LiFi `slippage` query param: `0.05` means 5%. */
export function effectiveSlippageRatio(settings: AppSettings): number {
  return effectiveSlippagePercent(settings) / 100;
}

export function parseSlippageInput(raw: string): number | null {
  const n = Number(raw.trim().replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return normalizeSlippagePercent(n) ?? null;
}

export function effectiveAutoLockMinutes(settings: AppSettings): number {
  return normalizeAutoLockMinutes(settings.autoLockMinutes) ?? 0;
}

export function effectiveToolbarOpenMode(settings: AppSettings): ToolbarOpenMode {
  return normalizeToolbarOpenMode(settings.toolbarOpenMode) ?? 'side_panel';
}

export function effectiveActiveChainId(settings: AppSettings): number {
  return normalizeChainId(settings.activeChainId) ?? DEFAULT_CHAIN_ID;
}

export function effectiveReplaceMetaMask(settings: AppSettings): boolean {
  return settings.replaceMetaMask !== false;
}

export function effectiveTxConfirmMode(settings: AppSettings): TxConfirmMode {
  return normalizeTxConfirmMode(settings.txConfirmMode);
}
