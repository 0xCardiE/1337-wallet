import { allCatalogChainIds, chainById } from './chainCatalog';
import { parseChainIdParam, toHexChainId } from '../provider/types';

/**
 * EIP-5792 `wallet_getCapabilities` result.
 * Empty per-chain objects mean this EOA signer has no atomic batch, paymaster,
 * or session-key features — dapps must use `eth_sendTransaction`.
 * Do not advertise `atomic.status: "unsupported"`: that still implies
 * `wallet_sendCalls` is implemented (sequential execution).
 */
export type WalletCapabilitiesResult = Record<string, Record<string, never>>;

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function parseWalletGetCapabilitiesParams(params: unknown[]): {
  address?: `0x${string}`;
  chainIds?: number[];
} {
  const address =
    typeof params[0] === 'string' && ADDRESS_RE.test(params[0])
      ? (params[0] as `0x${string}`)
      : undefined;

  if (params.length < 2 || params[1] == null) {
    return { address };
  }
  if (!Array.isArray(params[1])) {
    throw Object.assign(new Error('Invalid params'), { code: -32602 });
  }

  const chainIds: number[] = [];
  for (const raw of params[1]) {
    const id = parseChainIdParam(raw);
    if (id == null) continue;
    chainIds.push(id);
  }
  return { address, chainIds };
}

export function eip5792Capabilities(chainIds?: number[]): WalletCapabilitiesResult {
  const ids = chainIds ?? allCatalogChainIds();
  const out: WalletCapabilitiesResult = {};
  for (const id of ids) {
    if (!chainById(id)) continue;
    out[toHexChainId(id)] = {};
  }
  return out;
}
