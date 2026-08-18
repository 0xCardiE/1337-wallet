/** Message types for inpage ↔ content ↔ background provider bridge. */
export const PROVIDER_CHANNEL = '1337-provider' as const;

export type ProviderRequest = {
  id: string;
  method: string;
  params?: unknown[];
};

export type ProviderResponse =
  | { id: string; ok: true; result: unknown }
  | { id: string; ok: false; error: { code: number; message: string } };

export type WindowProviderEvent =
  | { type: 'chainChanged'; chainId: string }
  | { type: 'accountsChanged'; accounts: string[] }
  | { type: 'connect'; chainId: string }
  | { type: 'disconnect' };

/** Content → inpage inject flags (global Settings + per-origin override). */
export type ProviderInjectConfig = {
  replaceMetaMask: boolean;
  is1337: boolean;
  isMetaMask: boolean;
  announceAs1337: boolean;
  announceAsMetaMask: boolean;
};

export const PROVIDER_RPC_METHODS = [
  'eth_requestAccounts',
  'eth_accounts',
  'eth_chainId',
  'net_version',
  'wallet_getPermissions',
  'wallet_requestPermissions',
  'wallet_revokePermissions',
  'wallet_switchEthereumChain',
  'wallet_addEthereumChain',
  'eth_sendTransaction',
  'personal_sign',
  'eth_sign',
  'eth_signTypedData',
  'eth_signTypedData_v3',
  'eth_signTypedData_v4',
] as const;

export function providerError(code: number, message: string): ProviderResponse['error'] {
  return { code, message };
}

export function toHexChainId(chainId: number): string {
  return `0x${chainId.toString(16)}`;
}

export function parseChainIdParam(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.floor(raw);
  if (typeof raw === 'string') {
    const n = raw.startsWith('0x') ? Number.parseInt(raw, 16) : Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
