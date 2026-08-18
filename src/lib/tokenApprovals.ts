import { decodeFunctionResult, encodeFunctionData, getAddress, isAddress } from 'viem';
import { ERC20_ABI, MULTICALL3_ABI, MULTICALL3_ADDRESS } from './abis';
import { chainJsonRpcCall } from './ethereum';
import { chainById } from './chainCatalog';
import { etherscanV2Get } from './etherscanV2';
import type { WalletBalEntry } from './walletBalances';
import { formatTokenAmount } from './walletBalances';

/** keccak256("Approval(address,address,uint256)") */
export const APPROVAL_EVENT_TOPIC =
  '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925' as const;

export const APPROVAL_LOG_LOOKBACK_DAYS = 180;

const MAX_UINT256 = (1n << 256n) - 1n;
const ZERO = '0x0000000000000000000000000000000000000000';
const ETH_PLACEHOLDER = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export type TokenApprovalRow = {
  token: `0x${string}`;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenLogo?: string;
  spender: `0x${string}`;
  allowance: bigint;
  unlimited: boolean;
  lastApprovalTx?: `0x${string}`;
  lastApprovalBlock?: number;
};

export type RawApprovalLog = {
  address?: string;
  topics?: string[];
  transactionHash?: string;
  blockNumber?: string;
};

type SpenderCandidate = {
  token: `0x${string}`;
  spender: `0x${string}`;
  lastApprovalTx?: `0x${string}`;
  lastApprovalBlock: number;
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

export function padTopicAddress(addr: string): string {
  const hex = addr.startsWith('0x') ? addr.slice(2) : addr;
  return `0x${hex.toLowerCase().padStart(64, '0')}`;
}

function blocksPerDay(chainId: number): number {
  if (chainId === 1) return 7200;
  if (chainId === 56) return 28_800;
  if (chainId === 137) return 40_000;
  if (chainId === 42161 || chainId === 10 || chainId === 8453) return 432_000;
  return 43_200;
}

export function isErc20WalletToken(entry: WalletBalEntry): boolean {
  const addr = entry.address.toLowerCase();
  return addr !== ZERO && addr !== ETH_PLACEHOLDER;
}

export function walletTokenKey(entry: WalletBalEntry): string {
  return entry.address.toLowerCase();
}

export function lookbackBlockSpan(chainId: number): number {
  return APPROVAL_LOG_LOOKBACK_DAYS * blocksPerDay(chainId);
}

export async function getLatestBlockNumber(chainId: number): Promise<number> {
  const latestHex = await chainJsonRpcCall<string>(chainId, 'eth_blockNumber', []);
  return Number.parseInt(latestHex, 16);
}

export type ApprovalLogWindow = {
  fromBlock: number;
  toBlock: number | 'latest';
};

/** Most recent 180-day window (default scan). */
export async function recentApprovalWindow(chainId: number): Promise<ApprovalLogWindow> {
  const latest = await getLatestBlockNumber(chainId);
  return {
    fromBlock: Math.max(0, latest - lookbackBlockSpan(chainId)),
    toBlock: 'latest',
  };
}

/** Next older 180-day slice before `scannedFromBlock`. Null at genesis. */
export function olderApprovalWindow(
  chainId: number,
  scannedFromBlock: number,
): ApprovalLogWindow | null {
  if (scannedFromBlock <= 0) return null;
  const toBlock = scannedFromBlock - 1;
  if (toBlock < 0) return null;
  const fromBlock = Math.max(0, scannedFromBlock - lookbackBlockSpan(chainId));
  if (fromBlock > toBlock) return null;
  return { fromBlock, toBlock };
}

export function scannedLookbackDays(
  chainId: number,
  latestBlock: number,
  scannedFromBlock: number,
): number {
  const span = Math.max(0, latestBlock - scannedFromBlock);
  return Math.max(APPROVAL_LOG_LOOKBACK_DAYS, Math.round(span / blocksPerDay(chainId)));
}

export async function recentApprovalFromBlock(chainId: number): Promise<number> {
  const w = await recentApprovalWindow(chainId);
  return w.fromBlock;
}

export async function fetchExplorerLogs(params: {
  chainId: number;
  fromBlock: number;
  toBlock?: number | 'latest';
  topic0: string;
  topic1?: string;
  address?: string;
  explorerApiKey?: string;
}): Promise<RawApprovalLog[]> {
  const toBlock = params.toBlock ?? 'latest';
  const query = new URLSearchParams({
    chainid: String(params.chainId),
    module: 'logs',
    action: 'getLogs',
    fromBlock: String(params.fromBlock),
    toBlock: toBlock === 'latest' ? 'latest' : String(toBlock),
    topic0: params.topic0,
  });
  if (params.address) query.set('address', getAddress(params.address));
  if (params.topic1) {
    query.set('topic1', params.topic1);
    query.set('topic0_1_opr', 'and');
  }
  if (params.explorerApiKey?.trim()) query.set('apikey', params.explorerApiKey.trim());

  const json = await etherscanV2Get(query);
  const result = json.result;

  if (json.status !== '1' || !Array.isArray(result)) {
    const msg =
      typeof result === 'string'
        ? result
        : json.message ?? 'Etherscan returned no approval logs';
    if (/no records found|no logs found/i.test(msg)) return [];
    if (/query timeout|timeout/i.test(msg)) {
      throw new Error(
        'Explorer log query timed out for this period. Try again — the range was not marked scanned.',
      );
    }
    if (/more than 10000|too many/i.test(msg)) {
      throw new Error(
        `Too many approval events in this ${APPROVAL_LOG_LOOKBACK_DAYS}-day period. Try a quieter token or revoke on the explorer.`,
      );
    }
    throw new Error(msg);
  }
  return result as RawApprovalLog[];
}

function parseSpenderCandidates(
  logs: RawApprovalLog[],
  token: `0x${string}`,
): SpenderCandidate[] {
  const bySpender = new Map<string, SpenderCandidate>();

  for (const log of logs) {
    const spenderRaw = log.topics?.[2];
    if (!spenderRaw || spenderRaw.length < 66) continue;
    let spender: `0x${string}`;
    try {
      spender = getAddress(`0x${spenderRaw.slice(-40)}`) as `0x${string}`;
    } catch {
      continue;
    }

    const block = Number.parseInt(log.blockNumber ?? '0', 16);
    const key = spender.toLowerCase();
    const prev = bySpender.get(key);
    if (prev && prev.lastApprovalBlock >= block) continue;

    const tx =
      log.transactionHash && /^0x[a-fA-F0-9]{64}$/.test(log.transactionHash)
        ? (log.transactionHash as `0x${string}`)
        : undefined;

    bySpender.set(key, {
      token,
      spender,
      lastApprovalTx: tx,
      lastApprovalBlock: block,
    });
  }

  return [...bySpender.values()];
}

async function multicallAllowances(
  chainId: number,
  owner: string,
  pairs: SpenderCandidate[],
): Promise<Map<string, bigint>> {
  if (pairs.length === 0) return new Map();

  const calls = pairs.map(pair => ({
    target: pair.token,
    allowFailure: true,
    callData: encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [owner as `0x${string}`, pair.spender],
    }),
  }));

  const data = encodeFunctionData({
    abi: MULTICALL3_ABI,
    functionName: 'aggregate3',
    args: [calls],
  });

  let decoded: readonly { success: boolean; returnData: `0x${string}` }[];
  try {
    const raw = await chainJsonRpcCall<string>(chainId, 'eth_call', [
      { to: MULTICALL3_ADDRESS, data },
      'latest',
    ]);
    decoded = decodeFunctionResult({
      abi: MULTICALL3_ABI,
      functionName: 'aggregate3',
      data: raw as `0x${string}`,
    }) as readonly { success: boolean; returnData: `0x${string}` }[];
  } catch {
    return parallelAllowances(chainId, owner, pairs);
  }

  const out = new Map<string, bigint>();
  for (let i = 0; i < pairs.length; i += 1) {
    const slot = decoded[i];
    const pair = pairs[i]!;
    const key = `${pair.token.toLowerCase()}:${pair.spender.toLowerCase()}`;
    if (!slot?.success) continue;
    try {
      const allowance = decodeFunctionResult({
        abi: ERC20_ABI,
        functionName: 'allowance',
        data: slot.returnData,
      }) as bigint;
      out.set(key, allowance);
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

async function parallelAllowances(
  chainId: number,
  owner: string,
  pairs: SpenderCandidate[],
): Promise<Map<string, bigint>> {
  const out = new Map<string, bigint>();
  await Promise.all(
    pairs.map(async pair => {
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [owner as `0x${string}`, pair.spender],
      });
      try {
        const raw = await chainJsonRpcCall<string>(chainId, 'eth_call', [
          { to: pair.token, data },
          'latest',
        ]);
        const allowance = decodeFunctionResult({
          abi: ERC20_ABI,
          functionName: 'allowance',
          data: raw as `0x${string}`,
        }) as bigint;
        out.set(`${pair.token.toLowerCase()}:${pair.spender.toLowerCase()}`, allowance);
      } catch {
        /* skip */
      }
    }),
  );
  return out;
}

function tokenMeta(tokens: WalletBalEntry[], token: string): Pick<WalletBalEntry, 'symbol' | 'decimals' | 'logoURI'> {
  const hit = tokens.find(t => t.address.toLowerCase() === token.toLowerCase());
  return {
    symbol: hit?.symbol ?? shortAddress(token),
    decimals: hit?.decimals ?? 18,
    logoURI: hit?.logoURI,
  };
}

function shortAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatAllowance(allowance: bigint, decimals: number, unlimited: boolean): string {
  if (unlimited) return 'Unlimited';
  return formatTokenAmount(allowance, decimals);
}

export function addressExplorerLink(chainId: number, address: string): string | undefined {
  const origin = explorerOrigin(chainId);
  if (!origin || !isAddress(address)) return undefined;
  return `${origin}/address/${getAddress(address)}`;
}

export function txExplorerLink(chainId: number, hash: string): string | undefined {
  const origin = explorerOrigin(chainId);
  if (!origin || !/^0x[a-fA-F0-9]{64}$/.test(hash)) return undefined;
  return `${origin}/tx/${hash}`;
}

/** Discover spenders from Etherscan logs, then verify live allowances on-chain. */
export async function scanTokenApprovals(params: {
  chainId: number;
  owner: string;
  tokens: WalletBalEntry[];
  fromBlock: number;
  toBlock?: number | 'latest';
  explorerApiKey?: string;
  onTokenScanned?: (token: string) => void;
}): Promise<TokenApprovalRow[]> {
  if (!isAddress(params.owner)) throw new Error('Invalid wallet address');
  const owner = getAddress(params.owner);
  const erc20Tokens = params.tokens.filter(isErc20WalletToken);
  const allCandidates: SpenderCandidate[] = [];

  for (const token of erc20Tokens) {
    let tokenAddr: `0x${string}`;
    try {
      tokenAddr = getAddress(token.address) as `0x${string}`;
    } catch {
      continue;
    }

    const logs = await fetchExplorerLogs({
      chainId: params.chainId,
      address: tokenAddr,
      fromBlock: params.fromBlock,
      toBlock: params.toBlock,
      topic0: APPROVAL_EVENT_TOPIC,
      topic1: padTopicAddress(owner),
      explorerApiKey: params.explorerApiKey,
    });
    allCandidates.push(...parseSpenderCandidates(logs, tokenAddr));
    params.onTokenScanned?.(tokenAddr);
  }

  const allowances = await multicallAllowances(params.chainId, owner, allCandidates);
  const rows: TokenApprovalRow[] = [];

  for (const candidate of allCandidates) {
    const key = `${candidate.token.toLowerCase()}:${candidate.spender.toLowerCase()}`;
    const allowance = allowances.get(key) ?? 0n;
    if (allowance <= 0n) continue;

    const meta = tokenMeta(erc20Tokens, candidate.token);
    rows.push({
      token: candidate.token,
      tokenSymbol: meta.symbol,
      tokenDecimals: meta.decimals,
      tokenLogo: meta.logoURI,
      spender: candidate.spender,
      allowance,
      unlimited: allowance === MAX_UINT256,
      lastApprovalTx: candidate.lastApprovalTx,
      lastApprovalBlock: candidate.lastApprovalBlock,
    });
  }

  rows.sort((a, b) => {
    const sym = a.tokenSymbol.localeCompare(b.tokenSymbol);
    if (sym !== 0) return sym;
    return a.spender.localeCompare(b.spender);
  });
  return rows;
}

/** Re-check live allowances for cached rows (no log re-scan). */
export async function refreshLiveAllowances(params: {
  chainId: number;
  owner: string;
  rows: TokenApprovalRow[];
}): Promise<TokenApprovalRow[]> {
  if (!isAddress(params.owner)) throw new Error('Invalid wallet address');
  const owner = getAddress(params.owner);
  const pairs: SpenderCandidate[] = params.rows.map(row => ({
    token: row.token,
    spender: row.spender,
    lastApprovalTx: row.lastApprovalTx,
    lastApprovalBlock: row.lastApprovalBlock ?? 0,
  }));
  const allowances = await multicallAllowances(params.chainId, owner, pairs);
  const out: TokenApprovalRow[] = [];

  for (const row of params.rows) {
    const key = `${row.token.toLowerCase()}:${row.spender.toLowerCase()}`;
    const allowance = allowances.get(key) ?? 0n;
    if (allowance <= 0n) continue;
    out.push({
      ...row,
      allowance,
      unlimited: allowance === MAX_UINT256,
    });
  }
  return out;
}

export function mergeApprovalRows(
  existing: TokenApprovalRow[],
  incoming: TokenApprovalRow[],
): TokenApprovalRow[] {
  const map = new Map<string, TokenApprovalRow>();
  for (const row of existing) {
    map.set(`${row.token.toLowerCase()}:${row.spender.toLowerCase()}`, row);
  }
  for (const row of incoming) {
    const key = `${row.token.toLowerCase()}:${row.spender.toLowerCase()}`;
    const prev = map.get(key);
    if (!prev || (row.lastApprovalBlock ?? 0) >= (prev.lastApprovalBlock ?? 0)) {
      map.set(key, row);
    }
  }
  return [...map.values()].sort((a, b) => {
    const sym = a.tokenSymbol.localeCompare(b.tokenSymbol);
    if (sym !== 0) return sym;
    return a.spender.localeCompare(b.spender);
  });
}

export function filterRowsForWalletTokens(
  rows: TokenApprovalRow[],
  tokens: WalletBalEntry[],
): TokenApprovalRow[] {
  const allowed = new Set(tokens.filter(isErc20WalletToken).map(walletTokenKey));
  return rows.filter(r => allowed.has(r.token.toLowerCase()));
}

export function findUnscannedTokens(
  walletTokens: WalletBalEntry[],
  scannedTokenAddresses: string[],
): WalletBalEntry[] {
  const scanned = new Set(scannedTokenAddresses.map(a => a.toLowerCase()));
  return walletTokens.filter(t => isErc20WalletToken(t) && !scanned.has(walletTokenKey(t)));
}
