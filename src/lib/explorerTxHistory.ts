import { formatUnits, getAddress, isAddress } from 'viem';
import { chainById } from './chainCatalog';
import { etherscanV2Get } from './etherscanV2';

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

type ExplorerApiKind = 'etherscan-v2' | 'blockscout';

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

function explorerOrigin(chainId: number): string | undefined {
  const c = chainById(chainId);
  const url = c?.blockExplorerUrls[0]?.trim();
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

function apiKind(origin: string): ExplorerApiKind {
  if (/blockscout/i.test(origin)) return 'blockscout';
  return 'etherscan-v2';
}

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
    const msg =
      typeof json.result === 'string'
        ? json.result
        : json.message ?? 'Explorer returned no transactions';
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
  const res = await fetch(`${origin}/api?${params.toString()}`);
  if (!res.ok) throw new Error(`Blockscout API HTTP ${res.status}`);
  const json = (await res.json()) as {
    status?: string;
    message?: string;
    result?: RawExplorerTx[];
  };
  if (json.status !== '1' || !Array.isArray(json.result)) {
    if (/no transactions found/i.test(json.message ?? '')) return [];
    throw new Error(json.message ?? 'Blockscout returned no transactions');
  }
  return json.result;
}

/**
 * Fetch one page of normal transactions (newest first). No RPC scanning.
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

  const origin = explorerOrigin(params.chainId);
  if (!origin) {
    throw new Error(`No block explorer configured for chain ${params.chainId}.`);
  }

  const kind = apiKind(origin);
  const raw =
    kind === 'blockscout'
      ? await fetchBlockscoutPage(origin, params.address, params.page)
      : await fetchEtherscanV2Page(
          params.chainId,
          params.address,
          params.explorerApiKey,
          params.page,
        );

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
  const origin = explorerOrigin(chainId);
  if (!origin || !/^0x[a-fA-F0-9]{64}$/.test(hash)) return undefined;
  return `${origin}/tx/${hash}`;
}

export function needsExplorerApiKey(chainId: number): boolean {
  const origin = explorerOrigin(chainId);
  if (!origin) return true;
  return apiKind(origin) === 'etherscan-v2';
}
