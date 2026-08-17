import { decodeFunctionResult, encodeFunctionData, getAddress, isAddress } from 'viem';
import { ERC721_ENUM_ABI } from './abis';
import { chainJsonRpcCall } from './ethereum';
import {
  APPROVAL_LOG_LOOKBACK_DAYS,
  fetchExplorerLogs,
  padTopicAddress,
  recentApprovalFromBlock,
} from './tokenApprovals';

/** keccak256("ApprovalForAll(address,address,bool)") */
export const APPROVAL_FOR_ALL_TOPIC =
  '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31' as const;

export type NftApprovalRow = {
  contract: `0x${string}`;
  collectionName: string;
  symbol?: string;
  operator: `0x${string}`;
  lastApprovalTx?: `0x${string}`;
  lastApprovalBlock?: number;
};

function shortAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

async function isApprovedForAll(
  chainId: number,
  contract: `0x${string}`,
  owner: string,
  operator: `0x${string}`,
): Promise<boolean> {
  const data = encodeFunctionData({
    abi: ERC721_ENUM_ABI,
    functionName: 'isApprovedForAll',
    args: [owner as `0x${string}`, operator],
  });
  const raw = await chainJsonRpcCall<string>(chainId, 'eth_call', [
    { to: contract, data },
    'latest',
  ]);
  return decodeFunctionResult({
    abi: ERC721_ENUM_ABI,
    functionName: 'isApprovedForAll',
    data: raw as `0x${string}`,
  }) as boolean;
}

async function collectionMeta(
  chainId: number,
  contract: `0x${string}`,
): Promise<{ name: string; symbol?: string }> {
  let name: string | undefined;
  let symbol: string | undefined;
  try {
    const raw = await chainJsonRpcCall<string>(chainId, 'eth_call', [
      { to: contract, data: encodeFunctionData({ abi: ERC721_ENUM_ABI, functionName: 'name' }) },
      'latest',
    ]);
    name = decodeFunctionResult({
      abi: ERC721_ENUM_ABI,
      functionName: 'name',
      data: raw as `0x${string}`,
    }) as string;
  } catch {
    /* optional */
  }
  try {
    const raw = await chainJsonRpcCall<string>(chainId, 'eth_call', [
      { to: contract, data: encodeFunctionData({ abi: ERC721_ENUM_ABI, functionName: 'symbol' }) },
      'latest',
    ]);
    symbol = decodeFunctionResult({
      abi: ERC721_ENUM_ABI,
      functionName: 'symbol',
      data: raw as `0x${string}`,
    }) as string;
  } catch {
    /* optional */
  }
  return { name: name?.trim() || shortAddress(contract), symbol: symbol?.trim() || undefined };
}

export async function scanNftApprovals(params: {
  chainId: number;
  owner: string;
  explorerApiKey?: string;
}): Promise<NftApprovalRow[]> {
  if (!isAddress(params.owner)) throw new Error('Invalid wallet address');
  const owner = getAddress(params.owner);
  const fromBlock = await recentApprovalFromBlock(params.chainId);
  const logs = await fetchExplorerLogs({
    chainId: params.chainId,
    fromBlock,
    topic0: APPROVAL_FOR_ALL_TOPIC,
    topic1: padTopicAddress(owner),
    explorerApiKey: params.explorerApiKey,
  });

  const latest = new Map<
    string,
    { contract: `0x${string}`; operator: `0x${string}`; tx?: `0x${string}`; block: number }
  >();

  for (const log of logs) {
    if (!log.address || !isAddress(log.address)) continue;
    const operatorRaw = log.topics?.[2];
    if (!operatorRaw || operatorRaw.length < 66) continue;
    let contract: `0x${string}`;
    let operator: `0x${string}`;
    try {
      contract = getAddress(log.address);
      operator = getAddress(`0x${operatorRaw.slice(-40)}`);
    } catch {
      continue;
    }
    const block = Number.parseInt(log.blockNumber ?? '0', 16);
    const key = `${contract.toLowerCase()}:${operator.toLowerCase()}`;
    const prev = latest.get(key);
    if (prev && prev.block >= block) continue;
    const tx =
      log.transactionHash && /^0x[a-fA-F0-9]{64}$/.test(log.transactionHash)
        ? (log.transactionHash as `0x${string}`)
        : undefined;
    latest.set(key, { contract, operator, tx, block });
  }

  const rows: NftApprovalRow[] = [];
  for (const item of latest.values()) {
    try {
      const approved = await isApprovedForAll(
        params.chainId,
        item.contract,
        owner,
        item.operator,
      );
      if (!approved) continue;
      const meta = await collectionMeta(params.chainId, item.contract);
      rows.push({
        contract: item.contract,
        collectionName: meta.name,
        symbol: meta.symbol,
        operator: item.operator,
        lastApprovalTx: item.tx,
        lastApprovalBlock: item.block,
      });
    } catch {
      /* skip contracts that are not ERC-721/1155 */
    }
  }

  rows.sort((a, b) => a.collectionName.localeCompare(b.collectionName));
  return rows;
}

export { APPROVAL_LOG_LOOKBACK_DAYS };
