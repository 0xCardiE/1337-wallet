import {
  decodeFunctionResult,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAddress,
  isAddress,
} from 'viem';
import { ERC20_ABI } from './abis';
import { getUnlockedAccount } from './accountSession';
import { chainById } from './chainCatalog';
import { chainJsonRpcCall } from './ethereum';
import { fetchEnsAddress, fetchEnsName } from './ens';
import { parseInspectInput, type ParsedInspectInput } from './inspectInput';
import { addressExplorerLink, txExplorerLink } from './tokenApprovals';
import { humanizeHistoryRow } from './txHumanize';
import { fetchErc20Meta } from './txRisk';

export type InspectAddressResult = {
  kind: 'address';
  address: `0x${string}`;
  isContract: boolean;
  nonce: number;
  nativeWei: bigint;
  nativeLabel: string;
  ensName: string | null;
  explorerUrl?: string;
  token?: {
    name?: string;
    symbol?: string;
    decimals: number;
    totalSupply?: string;
    userBalance?: string;
  };
};

export type InspectTxResult = {
  kind: 'tx';
  hash: `0x${string}`;
  found: boolean;
  from?: string;
  to?: string | null;
  valueLabel?: string;
  selector?: string;
  headline?: string;
  explorerUrl?: string;
};

export type InspectResult =
  | InspectAddressResult
  | InspectTxResult
  | { kind: 'ens'; name: string; address: `0x${string}` | null }
  | { kind: 'unknown'; raw: string };

const TOTAL_SUPPLY_ABI = [
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

async function tryTokenPeek(
  chainId: number,
  address: `0x${string}`,
): Promise<InspectAddressResult['token'] | undefined> {
  const meta = await fetchErc20Meta(chainId, address);
  if (!meta.symbol && !meta.name) return undefined;

  let totalSupply: string | undefined;
  try {
    const raw = await chainJsonRpcCall<string>(chainId, 'eth_call', [
      {
        to: address,
        data: encodeFunctionData({ abi: TOTAL_SUPPLY_ABI, functionName: 'totalSupply' }),
      },
      'latest',
    ]);
    const supply = decodeFunctionResult({
      abi: TOTAL_SUPPLY_ABI,
      functionName: 'totalSupply',
      data: raw as `0x${string}`,
    }) as bigint;
    totalSupply = formatUnits(supply, meta.decimals);
  } catch {
    /* not required */
  }

  let userBalance: string | undefined;
  const account = getUnlockedAccount();
  if (account) {
    try {
      const raw = await chainJsonRpcCall<string>(chainId, 'eth_call', [
        {
          to: address,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [account.address as `0x${string}`],
          }),
        },
        'latest',
      ]);
      const bal = decodeFunctionResult({
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        data: raw as `0x${string}`,
      }) as bigint;
      userBalance = formatUnits(bal, meta.decimals);
    } catch {
      /* optional */
    }
  }

  return {
    name: meta.name,
    symbol: meta.symbol,
    decimals: meta.decimals,
    totalSupply,
    userBalance,
  };
}

async function lookupAddress(
  chainId: number,
  address: `0x${string}`,
): Promise<InspectAddressResult> {
  const chain = chainById(chainId);
  const [code, nonceHex, balHex, ensName] = await Promise.all([
    chainJsonRpcCall<string>(chainId, 'eth_getCode', [address, 'latest']).catch(() => '0x'),
    chainJsonRpcCall<string>(chainId, 'eth_getTransactionCount', [address, 'latest']).catch(
      () => '0x0',
    ),
    chainJsonRpcCall<string>(chainId, 'eth_getBalance', [address, 'latest']).catch(() => '0x0'),
    fetchEnsName(address).catch(() => null),
  ]);
  const isContract = !!code && code !== '0x' && code !== '0x0';
  const nativeWei = BigInt(balHex);
  const symbol = chain?.nativeCurrency.symbol ?? 'ETH';
  const token = isContract ? await tryTokenPeek(chainId, address) : undefined;

  return {
    kind: 'address',
    address,
    isContract,
    nonce: Number.parseInt(nonceHex, 16) || 0,
    nativeWei,
    nativeLabel: `${formatEther(nativeWei)} ${symbol}`,
    ensName,
    explorerUrl: addressExplorerLink(chainId, address),
    token,
  };
}

async function lookupTx(chainId: number, hash: `0x${string}`): Promise<InspectTxResult> {
  const explorerUrl = txExplorerLink(chainId, hash);
  try {
    const tx = await chainJsonRpcCall<{
      from?: string;
      to?: string | null;
      value?: string;
      input?: string;
    } | null>(chainId, 'eth_getTransactionByHash', [hash]);
    if (!tx) return { kind: 'tx', hash, found: false, explorerUrl };

    const value = tx.value ? BigInt(tx.value) : 0n;
    const input = typeof tx.input === 'string' ? tx.input : '0x';
    const selector = input.length >= 10 && input !== '0x' ? input.slice(0, 10) : undefined;
    const to = tx.to && isAddress(tx.to) ? getAddress(tx.to) : tx.to ?? null;
    const from = tx.from && isAddress(tx.from) ? getAddress(tx.from) : tx.from;
    const { title } = humanizeHistoryRow(
      {
        hash,
        from: (from ?? '0x0000000000000000000000000000000000000000') as `0x${string}`,
        to: to && isAddress(to) ? (to as `0x${string}`) : null,
        value,
        timestamp: Date.now(),
        success: true,
        direction: 'out',
        methodId: selector,
      },
      chainId,
    );
    const symbol = chainById(chainId)?.nativeCurrency.symbol ?? 'ETH';
    return {
      kind: 'tx',
      hash,
      found: true,
      from,
      to,
      valueLabel: value > 0n ? `${formatEther(value)} ${symbol}` : undefined,
      selector,
      headline: title,
      explorerUrl,
    };
  } catch {
    return { kind: 'tx', hash, found: false, explorerUrl };
  }
}

export async function runInspect(
  raw: string,
  chainId: number,
): Promise<{ parsed: ParsedInspectInput; result: InspectResult }> {
  const parsed = parseInspectInput(raw);
  if (parsed.kind === 'unknown') {
    return { parsed, result: { kind: 'unknown', raw: parsed.raw } };
  }
  if (parsed.kind === 'ens') {
    const address = await fetchEnsAddress(parsed.name);
    return { parsed, result: { kind: 'ens', name: parsed.name, address } };
  }
  if (parsed.kind === 'tx') {
    return { parsed, result: await lookupTx(chainId, parsed.hash) };
  }
  return { parsed, result: await lookupAddress(chainId, parsed.address) };
}
