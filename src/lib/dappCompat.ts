import type { ProviderInjectConfig } from '../provider/types';

export type DappCompatMode = 'default' | 'metamask' | '1337';

export function isDappCompatMode(v: unknown): v is DappCompatMode {
  return v === 'default' || v === 'metamask' || v === '1337';
}

export function normalizeDappCompatByOrigin(
  raw: unknown,
): Record<string, DappCompatMode> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, DappCompatMode> = {};
  for (const [origin, mode] of Object.entries(raw as Record<string, unknown>)) {
    if (!origin.startsWith('http://') && !origin.startsWith('https://')) continue;
    if (!isDappCompatMode(mode) || mode === 'default') continue;
    out[origin] = mode;
  }
  return Object.keys(out).length ? out : undefined;
}

export function dappCompatForOrigin(
  settings: { dappCompatByOrigin?: Record<string, DappCompatMode>; replaceMetaMask?: boolean },
  origin?: string,
): DappCompatMode {
  if (!origin) return 'default';
  return settings.dappCompatByOrigin?.[origin] ?? 'default';
}

/** EIP-6963 + provider flags for this page origin. */
export function resolveProviderInjectConfig(
  settings: { replaceMetaMask?: boolean; dappCompatByOrigin?: Record<string, DappCompatMode> },
  origin?: string,
): ProviderInjectConfig {
  const mode = dappCompatForOrigin(settings, origin);
  const globalReplace = settings.replaceMetaMask !== false;
  if (mode === 'metamask') {
    return {
      replaceMetaMask: true,
      is1337: false,
      isMetaMask: true,
      announceAs1337: false,
      announceAsMetaMask: true,
    };
  }
  if (mode === '1337') {
    return {
      replaceMetaMask: false,
      is1337: true,
      isMetaMask: false,
      announceAs1337: true,
      announceAsMetaMask: false,
    };
  }
  return {
    replaceMetaMask: globalReplace,
    is1337: true,
    isMetaMask: true,
    announceAs1337: true,
    announceAsMetaMask: globalReplace,
  };
}

export const DAPP_COMPAT_LABELS: Record<DappCompatMode, string> = {
  default: 'Follow Settings default',
  metamask: 'Announce as MetaMask',
  '1337': '1337 only',
};
