import { encodeFunctionData, type Hex } from 'viem';
import { ensureErc20Allowance, chainJsonRpcCall, sendTransactionRequest } from './ethereum';

/** Canonical Disperse.app helper — same address on every chain that has it. */
export const DISPERSE_ADDRESS = '0xD152f549545093347A162Dce210e7293f1452150' as const;

export const DISPERSE_ABI = [
  {
    name: 'disperseEther',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    name: 'disperseToken',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'recipients', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
    ],
    outputs: [],
  },
] as const;

const codeCache = new Map<number, boolean>();

/** True when the canonical Disperse bytecode is deployed on this chain. */
export async function isDisperseDeployed(chainId: number): Promise<boolean> {
  const cached = codeCache.get(chainId);
  if (cached != null) return cached;
  try {
    const code = await chainJsonRpcCall<string>(chainId, 'eth_getCode', [
      DISPERSE_ADDRESS,
      'latest',
    ]);
    const ok = typeof code === 'string' && code !== '0x' && code.length > 4;
    codeCache.set(chainId, ok);
    return ok;
  } catch {
    codeCache.set(chainId, false);
    return false;
  }
}

export async function disperseNative(params: {
  chainId: number;
  recipients: `0x${string}`[];
  amountPerRecipient: bigint;
}): Promise<Hex> {
  const values = params.recipients.map(() => params.amountPerRecipient);
  const total = params.amountPerRecipient * BigInt(params.recipients.length);
  const data = encodeFunctionData({
    abi: DISPERSE_ABI,
    functionName: 'disperseEther',
    args: [params.recipients, values],
  });
  return sendTransactionRequest(params.chainId, {
    to: DISPERSE_ADDRESS,
    data,
    value: `0x${total.toString(16)}`,
  }) as Promise<Hex>;
}

export async function disperseErc20(params: {
  chainId: number;
  token: `0x${string}`;
  recipients: `0x${string}`[];
  amountPerRecipient: bigint;
}): Promise<{ approveHash: string | null; hash: Hex }> {
  const total = params.amountPerRecipient * BigInt(params.recipients.length);
  const approveHash = await ensureErc20Allowance({
    chainId: params.chainId,
    tokenAddress: params.token,
    spender: DISPERSE_ADDRESS,
    minAmount: total,
  });
  const values = params.recipients.map(() => params.amountPerRecipient);
  const data = encodeFunctionData({
    abi: DISPERSE_ABI,
    functionName: 'disperseToken',
    args: [params.token, params.recipients, values],
  });
  const hash = (await sendTransactionRequest(params.chainId, {
    to: DISPERSE_ADDRESS,
    data,
    value: '0x0',
  })) as Hex;
  return { approveHash, hash };
}
