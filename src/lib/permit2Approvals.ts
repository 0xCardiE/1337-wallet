import { decodeFunctionResult, encodeFunctionData, getAddress, isAddress, keccak256, toBytes } from 'viem';
import { PERMIT2_ABI, PERMIT2_ADDRESS } from './abis';
import { chainJsonRpcCall } from './ethereum';
import { fetchErc20Meta } from './txRisk';
import {
  fetchExplorerLogs,
  padTopicAddress,
  recentApprovalFromBlock,
} from './tokenApprovals';

export const PERMIT2_APPROVAL_TOPIC = keccak256(
  toBytes('Approval(address,address,address,uint160,uint48)'),
);
export const PERMIT2_PERMIT_TOPIC = keccak256(
  toBytes('Permit(address,address,address,uint160,uint48,uint48)'),
);

const MAX_UINT160 = (1n << 160n) - 1n;

export type Permit2ApprovalRow = {
  token: `0x${string}`;
  tokenSymbol: string;
  tokenDecimals: number;
  spender: `0x${string}`;
  amount: bigint;
  expiration: number;
  nonce: number;
  unlimited: boolean;
  lastApprovalTx?: `0x${string}`;
};

async function permit2Deployed(chainId: number): Promise<boolean> {
  try {
    const code = await chainJsonRpcCall<string>(chainId, 'eth_getCode', [
      PERMIT2_ADDRESS,
      'latest',
    ]);
    return !!code && code !== '0x' && code !== '0x0';
  } catch {
    return false;
  }
}

async function liveAllowance(
  chainId: number,
  owner: string,
  token: `0x${string}`,
  spender: `0x${string}`,
): Promise<{ amount: bigint; expiration: number; nonce: number } | null> {
  const data = encodeFunctionData({
    abi: PERMIT2_ABI,
    functionName: 'allowance',
    args: [owner as `0x${string}`, token, spender],
  });
  try {
    const raw = await chainJsonRpcCall<string>(chainId, 'eth_call', [
      { to: PERMIT2_ADDRESS, data },
      'latest',
    ]);
    const decoded = decodeFunctionResult({
      abi: PERMIT2_ABI,
      functionName: 'allowance',
      data: raw as `0x${string}`,
    }) as readonly [bigint, number | bigint, number | bigint];
    return {
      amount: decoded[0],
      expiration: Number(decoded[1]),
      nonce: Number(decoded[2]),
    };
  } catch {
    return null;
  }
}

function parseIndexedAddress(topic: string | undefined): `0x${string}` | undefined {
  if (!topic || topic.length < 66) return undefined;
  try {
    return getAddress(`0x${topic.slice(-40)}`);
  } catch {
    return undefined;
  }
}

export async function scanPermit2Approvals(params: {
  chainId: number;
  owner: string;
  explorerApiKey?: string;
}): Promise<{ rows: Permit2ApprovalRow[]; available: boolean }> {
  if (!isAddress(params.owner)) throw new Error('Invalid wallet address');
  const owner = getAddress(params.owner);
  const available = await permit2Deployed(params.chainId);
  if (!available) return { rows: [], available: false };

  const fromBlock = await recentApprovalFromBlock(params.chainId);
  const ownerTopic = padTopicAddress(owner);
  const [approvalLogs, permitLogs] = await Promise.all([
    fetchExplorerLogs({
      chainId: params.chainId,
      address: PERMIT2_ADDRESS,
      fromBlock,
      topic0: PERMIT2_APPROVAL_TOPIC,
      topic1: ownerTopic,
      explorerApiKey: params.explorerApiKey,
    }),
    fetchExplorerLogs({
      chainId: params.chainId,
      address: PERMIT2_ADDRESS,
      fromBlock,
      topic0: PERMIT2_PERMIT_TOPIC,
      topic1: ownerTopic,
      explorerApiKey: params.explorerApiKey,
    }),
  ]);

  const latest = new Map<
    string,
    { token: `0x${string}`; spender: `0x${string}`; tx?: `0x${string}` }
  >();
  for (const log of [...approvalLogs, ...permitLogs]) {
    const token = parseIndexedAddress(log.topics?.[2]);
    const spender = parseIndexedAddress(log.topics?.[3]);
    if (!token || !spender) continue;
    const key = `${token.toLowerCase()}:${spender.toLowerCase()}`;
    const tx =
      log.transactionHash && /^0x[a-fA-F0-9]{64}$/.test(log.transactionHash)
        ? (log.transactionHash as `0x${string}`)
        : undefined;
    latest.set(key, { token, spender, tx });
  }

  const now = Math.floor(Date.now() / 1000);
  const rows: Permit2ApprovalRow[] = [];
  for (const item of latest.values()) {
    const live = await liveAllowance(params.chainId, owner, item.token, item.spender);
    if (!live || live.amount <= 0n) continue;
    if (live.expiration !== 0 && live.expiration < now) continue;
    const meta = await fetchErc20Meta(params.chainId, item.token);
    rows.push({
      token: item.token,
      tokenSymbol: meta.symbol ?? item.token.slice(0, 6),
      tokenDecimals: meta.decimals,
      spender: item.spender,
      amount: live.amount,
      expiration: live.expiration,
      nonce: live.nonce,
      unlimited: live.amount >= MAX_UINT160,
      lastApprovalTx: item.tx,
    });
  }

  rows.sort((a, b) => a.tokenSymbol.localeCompare(b.tokenSymbol));
  return { rows, available: true };
}

export function formatPermit2Expiration(expiration: number): string {
  if (!expiration) return 'No expiry';
  const d = new Date(expiration * 1000);
  if (Number.isNaN(d.getTime())) return String(expiration);
  return d.toLocaleString();
}
