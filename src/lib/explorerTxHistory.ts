import { formatUnits, getAddress, isAddress } from 'viem';
import { chainById } from './chainCatalog';
import { etherscanV2Get } from './etherscanV2';
import {
  blockscoutApiOrigin,
  blockscoutGet,
  catalogExplorerOrigin,
  etherscanCommunityAccess,
  explorerErrorMessage,
  isBlockscoutOrigin,
  isEtherscanCoverageError,
} from './explorerApis';

export { needsExplorerApiKey } from './explorerApis';

export const TX_HISTORY_PAGE_SIZE = 50;

export type TxHistoryRow = {
  hash: `0x${string}`;
  from: `0x${string}`;
  to: `0x${string}` | null;
  value: bigint;
  timestamp: number;
  success: boolean;
  direction: 'in' | 'out' | 'self';
  blockNumber?: number;
  nonce?: number;
  gasUsed?: bigint;
  gasLimit?: bigint;
  gasPrice?: bigint;
  methodId?: string;
  functionName?: string;
  /** Calldata — kept for failed txs to help debugging. */
  input?: string;
};

export type TxHistoryPageResult = {
  rows: TxHistoryRow[];
  hasMore: boolean;
};

type RawExplorerTx = {
  hash?: string;
  from?: string;
  to?: string;
  value?: string;
  timeStamp?: string;
  isError?: string;
  txreceipt_status?: string;
  blockNumber?: string;
  nonce?: string;
  gas?: string;
  gasUsed?: string;
  gasPrice?: string;
  methodId?: string;
  functionName?: string;
  input?: string;
};

function parseOptionalBigInt(v: string | undefined): bigint | undefined {
  if (!v?.trim()) return undefined;
  try {
    return BigInt(v.trim());
  } catch {
    return undefined;
  }
}

function parseOptionalInt(v: string | undefined): number | undefined {
  if (!v?.trim()) return undefined;
  const n = Number.parseInt(v.trim(), 10);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeRows(raw: RawExplorerTx[], wallet: string): TxHistoryRow[] {
  const me = getAddress(wallet).toLowerCase();
  const out: TxHistoryRow[] = [];
  const seen = new Set<string>();

  for (const tx of raw) {
    if (!tx.hash || !/^0x[a-fA-F0-9]{64}$/.test(tx.hash)) continue;
    if (seen.has(tx.hash)) continue;
    seen.add(tx.hash);

    let from: `0x${string}`;
    let to: `0x${string}` | null = null;
    try {
      from = getAddress(tx.from ?? '');
    } catch {
      continue;
    }
    if (tx.to) {
      try {
        to = getAddress(tx.to);
      } catch {
        to = null;
      }
    }

    const fromLo = from.toLowerCase();
    const toLo = to?.toLowerCase() ?? '';
    let direction: TxHistoryRow['direction'] = 'out';
    if (fromLo === me && toLo === me) direction = 'self';
    else if (toLo === me) direction = 'in';
    else if (fromLo === me) direction = 'out';

    const success =
      tx.isError !== '1' && (tx.txreceipt_status == null || tx.txreceipt_status === '1');

    const methodId =
      tx.methodId?.trim() ||
      (tx.input && tx.input.length >= 10 ? tx.input.slice(0, 10).toLowerCase() : undefined);

    const row: TxHistoryRow = {
      hash: tx.hash as `0x${string}`,
      from,
      to,
      value: BigInt(tx.value?.trim() || '0'),
      timestamp: Number.parseInt(tx.timeStamp ?? '0', 10) * 1000,
      success,
      direction,
      blockNumber: parseOptionalInt(tx.blockNumber),
      nonce: parseOptionalInt(tx.nonce),
      gasUsed: parseOptionalBigInt(tx.gasUsed),
      gasLimit: parseOptionalBigInt(tx.gas),
      gasPrice: parseOptionalBigInt(tx.gasPrice),
      methodId,
      functionName: tx.functionName?.trim() || undefined,
    };

    // Keep calldata for failures (dev diagnostics); skip huge payloads on success.
    if (!success && tx.input && tx.input.length > 2) {
      row.input = tx.input.length > 20_000 ? `${tx.input.slice(0, 20_000)}…` : tx.input;
    }

    out.push(row);
  }

  out.sort((a, b) => b.timestamp - a.timestamp);
  return out;
}

async function fetchEtherscanV2Page(
  chainId: number,
  address: string,
  apiKey: string | undefined,
  page: number,
): Promise<RawExplorerTx[]> {
  const params = new URLSearchParams({
    chainid: String(chainId),
    module: 'account',
    action: 'txlist',
    address: getAddress(address),
    startblock: '0',
    endblock: '99999999',
    page: String(page),
    offset: String(TX_HISTORY_PAGE_SIZE),
    sort: 'desc',
  });
  if (apiKey?.trim()) params.set('apikey', apiKey.trim());

  const json = await etherscanV2Get(params);
  if (json.status !== '1' || !Array.isArray(json.result)) {
    const msg = explorerErrorMessage(json) || 'Explorer returned no transactions';
    if (/no transactions found/i.test(msg)) return [];
    throw new Error(msg);
  }
  return json.result as RawExplorerTx[];
}

async function fetchBlockscoutPage(
  origin: string,
  address: string,
  page: number,
): Promise<RawExplorerTx[]> {
  const params = new URLSearchParams({
    module: 'account',
    action: 'txlist',
    address: getAddress(address),
    page: String(page),
    offset: String(TX_HISTORY_PAGE_SIZE),
    sort: 'desc',
  });
  const json = await blockscoutGet(origin, params);
  if (json.status !== '1' || !Array.isArray(json.result)) {
    const msg = explorerErrorMessage(json);
    if (/no transactions found/i.test(msg)) return [];
    throw new Error(msg || 'Blockscout returned no transactions');
  }
  return json.result as RawExplorerTx[];
}

/**
 * Fetch one page of normal transactions (newest first). No RPC scanning.
 * Etherscan v2 when the free tier covers the chain; Blockscout when it does not
 * (or when the catalog explorer is already Blockscout).
 */
export async function fetchAddressTxHistoryPage(params: {
  chainId: number;
  address: string;
  explorerApiKey?: string;
  page: number;
}): Promise<TxHistoryPageResult> {
  if (!isAddress(params.address)) throw new Error('Invalid wallet address');
  if (!Number.isFinite(params.page) || params.page < 1) {
    throw new Error('Invalid history page');
  }

  const catalog = catalogExplorerOrigin(params.chainId);
  const scout = blockscoutApiOrigin(params.chainId);
  const key = params.explorerApiKey?.trim();
  const access = etherscanCommunityAccess(params.chainId);
  const catalogIsScout = !!catalog && isBlockscoutOrigin(catalog);

  let raw: RawExplorerTx[];
  if (catalogIsScout && catalog) {
    raw = await fetchBlockscoutPage(catalog, params.address, params.page);
  } else if (key && access !== 'none') {
    try {
      raw = await fetchEtherscanV2Page(params.chainId, params.address, key, params.page);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (scout && isEtherscanCoverageError(msg)) {
        raw = await fetchBlockscoutPage(scout, params.address, params.page);
      } else {
        throw e;
      }
    }
  } else if (scout) {
    raw = await fetchBlockscoutPage(scout, params.address, params.page);
  } else if (!catalog) {
    throw new Error(`No block explorer configured for chain ${params.chainId}.`);
  } else {
    throw new Error('Add an Etherscan API key in Settings to load transaction history.');
  }

  const rows = normalizeRows(raw, params.address);
  return {
    rows,
    hasMore: raw.length >= TX_HISTORY_PAGE_SIZE,
  };
}

export function formatTxValue(value: bigint, chainId: number): string {
  const sym = chainById(chainId)?.nativeCurrency.symbol ?? 'ETH';
  try {
    const n = Number(formatUnits(value, 18));
    if (n === 0) return `0 ${sym}`;
    if (n < 0.0001) return `<0.0001 ${sym}`;
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${sym}`;
  } catch {
    return `${value.toString()} wei`;
  }
}

export function txExplorerLink(chainId: number, hash: string): string | undefined {
  const origin = catalogExplorerOrigin(chainId);
  if (!origin || !/^0x[a-fA-F0-9]{64}$/.test(hash)) return undefined;
  return `${origin}/tx/${hash}`;
}

export function addressExplorerLink(chainId: number, address: string): string | undefined {
  const origin = catalogExplorerOrigin(chainId);
  if (!origin || !isAddress(address)) return undefined;
  return `${origin}/address/${getAddress(address)}`;
}

export function blockExplorerLink(chainId: number, blockNumber: number): string | undefined {
  const origin = catalogExplorerOrigin(chainId);
  if (!origin || !Number.isInteger(blockNumber) || blockNumber < 0) return undefined;
  return `${origin}/block/${blockNumber}`;
}
