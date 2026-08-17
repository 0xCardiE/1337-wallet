import { decodeFunctionResult, encodeFunctionData, getAddress, isAddress } from 'viem';
import { chainJsonRpcCall } from './ethereum';
import {
  fetchSourceRecord,
  flattenEtherscanSourceCode,
} from './explorerContractSource';

export type ContractHint = {
  name?: string;
  verified: boolean;
  proxy: boolean;
  implementation?: `0x${string}`;
  owner?: `0x${string}`;
  dangers: string[];
  sourceError?: string;
};

const OWNER_ABI = [
  {
    inputs: [],
    name: 'owner',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const DANGER_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\bfunction\s+mint\b/i, label: 'Can mint' },
  { re: /\bfunction\s+pause\b/i, label: 'Can pause' },
  { re: /\bfunction\s+(blacklist|addToBlacklist|addBlackList|freeze|freezeAccount)\b/i, label: 'Can blacklist or freeze' },
  { re: /\bfunction\s+(upgradeTo|upgradeToAndCall)\b/i, label: 'Can upgrade implementation' },
  { re: /\bfunction\s+(setFee|setFees|setTax|setTaxFee|setSwapAndLiquifyEnabled)\b/i, label: 'Can change fees' },
  { re: /\bfunction\s+(setImplementation|changeImplementation)\b/i, label: 'Can change implementation' },
];

async function tryOwner(chainId: number, address: string): Promise<`0x${string}` | undefined> {
  try {
    const data = encodeFunctionData({ abi: OWNER_ABI, functionName: 'owner' });
    const raw = await chainJsonRpcCall<string>(chainId, 'eth_call', [
      { to: address, data },
      'latest',
    ]);
    const owner = decodeFunctionResult({
      abi: OWNER_ABI,
      functionName: 'owner',
      data: raw as `0x${string}`,
    }) as `0x${string}`;
    if (isAddress(owner) && owner !== '0x0000000000000000000000000000000000000000') {
      return getAddress(owner);
    }
  } catch {
    /* no owner() */
  }
  return undefined;
}

function dangersFromSource(source: string): string[] {
  const out: string[] = [];
  for (const { re, label } of DANGER_PATTERNS) {
    if (re.test(source)) out.push(label);
  }
  return out;
}

export async function fetchContractHint(params: {
  chainId: number;
  address: string;
  explorerApiKey?: string;
}): Promise<ContractHint> {
  const address = getAddress(params.address);
  const owner = await tryOwner(params.chainId, address);

  if (!params.explorerApiKey?.trim()) {
    return {
      verified: false,
      proxy: false,
      owner,
      dangers: [],
      sourceError: 'Add an Etherscan API key to check verified source for admin powers.',
    };
  }

  try {
    let record = await fetchSourceRecord(params.chainId, address, params.explorerApiKey);
    if (!record) {
      return { verified: false, proxy: false, owner, dangers: [] };
    }

    const proxy = record.Proxy === '1';
    let implementation: `0x${string}` | undefined;
    if (proxy && isAddress(record.Implementation)) {
      implementation = getAddress(record.Implementation);
      const impl = await fetchSourceRecord(
        params.chainId,
        record.Implementation,
        params.explorerApiKey,
      );
      if (impl) record = impl;
    }

    const flat = flattenEtherscanSourceCode(record.SourceCode);
    const verified = !!flat.trim();
    return {
      name: record.ContractName || undefined,
      verified,
      proxy,
      implementation,
      owner,
      dangers: verified ? dangersFromSource(flat) : [],
      sourceError: verified ? undefined : 'Contract is not verified on the explorer.',
    };
  } catch (e) {
    return {
      verified: false,
      proxy: false,
      owner,
      dangers: [],
      sourceError: e instanceof Error ? e.message : String(e),
    };
  }
}
