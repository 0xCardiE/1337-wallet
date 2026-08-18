import { encodeFunctionData, type Hex } from 'viem';
import {
  ensureErc20Allowance,
  chainJsonRpcCall,
  sendTransactionRequest,
  waitForChainReceipt,
} from './ethereum';
import {
  CREATEX_ADDRESS,
  DISPERSE_CREATE2_ADDRESS,
  DISPERSE_CREATEX_CALLDATA,
} from './disperseCreate2';

export {
  CREATEX_ADDRESS,
  DISPERSE_CREATE2_ADDRESS,
  DISPERSE_CREATE2_SALT,
  DISPERSE_CREATEX_CALLDATA,
} from './disperseCreate2';

/** Canonical Disperse.app helper — 2018 CREATE on Ethereum and many L2s. */
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

export type DisperseSource = 'legacy' | 'create2';

export type DisperseResolution = {
  address: `0x${string}` | null;
  source: DisperseSource | null;
  createXDeployed: boolean;
  canDeploy: boolean;
};

const resolveCache = new Map<number, DisperseResolution>();

function hasOnchainCode(code: unknown): boolean {
  return typeof code === 'string' && code !== '0x' && code.length > 4;
}

async function codeAt(chainId: number, address: `0x${string}`): Promise<boolean> {
  try {
    const code = await chainJsonRpcCall<string>(chainId, 'eth_getCode', [address, 'latest']);
    return hasOnchainCode(code);
  } catch {
    return false;
  }
}

export function invalidateDisperseResolution(chainId: number): void {
  resolveCache.delete(chainId);
}

/** Prefer the 2018 address, then the CreateX CREATE2 address. */
export async function resolveDisperse(
  chainId: number,
  opts?: { refresh?: boolean },
): Promise<DisperseResolution> {
  if (!opts?.refresh) {
    const cached = resolveCache.get(chainId);
    if (cached) return cached;
  }

  const [legacy, create2, createX] = await Promise.all([
    codeAt(chainId, DISPERSE_ADDRESS),
    codeAt(chainId, DISPERSE_CREATE2_ADDRESS),
    codeAt(chainId, CREATEX_ADDRESS),
  ]);

  const resolved: DisperseResolution = legacy
    ? {
        address: DISPERSE_ADDRESS,
        source: 'legacy',
        createXDeployed: createX,
        canDeploy: false,
      }
    : create2
      ? {
          address: DISPERSE_CREATE2_ADDRESS,
          source: 'create2',
          createXDeployed: createX,
          canDeploy: false,
        }
      : {
          address: null,
          source: null,
          createXDeployed: createX,
          canDeploy: createX,
        };

  resolveCache.set(chainId, resolved);
  return resolved;
}

/** True when either known Disperse address has bytecode on this chain. */
export async function isDisperseDeployed(chainId: number): Promise<boolean> {
  const resolved = await resolveDisperse(chainId);
  return resolved.address != null;
}

async function requireDisperse(chainId: number): Promise<`0x${string}`> {
  const resolved = await resolveDisperse(chainId);
  if (!resolved.address) {
    throw new Error('Disperse.app is not on this network.');
  }
  return resolved.address;
}

export async function deployDisperseViaCreateX(
  chainId: number,
): Promise<{ hash: Hex | null; alreadyPresent: boolean }> {
  let resolved = await resolveDisperse(chainId, { refresh: true });
  if (resolved.address) return { hash: null, alreadyPresent: true };
  if (!resolved.createXDeployed) {
    throw new Error('CreateX is not on this network, so Disperse cannot be deployed here.');
  }

  let hash: Hex;
  try {
    hash = (await sendTransactionRequest(chainId, {
      to: CREATEX_ADDRESS,
      data: DISPERSE_CREATEX_CALLDATA,
      value: '0x0',
    })) as Hex;
  } catch (err) {
    invalidateDisperseResolution(chainId);
    resolved = await resolveDisperse(chainId, { refresh: true });
    if (resolved.address) return { hash: null, alreadyPresent: true };
    throw err;
  }

  const receipt = await waitForChainReceipt(hash, chainId);
  invalidateDisperseResolution(chainId);
  resolved = await resolveDisperse(chainId, { refresh: true });
  if (resolved.address) return { hash, alreadyPresent: false };
  if (receipt.status === 'reverted') {
    throw new Error(
      'Deploy reverted. If someone else deployed first, Disperse should appear after a refresh.',
    );
  }
  throw new Error('Deploy confirmed but Disperse was not found at the expected address.');
}

export async function disperseNative(params: {
  chainId: number;
  recipients: `0x${string}`[];
  amountPerRecipient: bigint;
}): Promise<Hex> {
  const to = await requireDisperse(params.chainId);
  const values = params.recipients.map(() => params.amountPerRecipient);
  const total = params.amountPerRecipient * BigInt(params.recipients.length);
  const data = encodeFunctionData({
    abi: DISPERSE_ABI,
    functionName: 'disperseEther',
    args: [params.recipients, values],
  });
  return sendTransactionRequest(params.chainId, {
    to,
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
  const spender = await requireDisperse(params.chainId);
  const total = params.amountPerRecipient * BigInt(params.recipients.length);
  const approveHash = await ensureErc20Allowance({
    chainId: params.chainId,
    tokenAddress: params.token,
    spender,
    minAmount: total,
  });
  const values = params.recipients.map(() => params.amountPerRecipient);
  const data = encodeFunctionData({
    abi: DISPERSE_ABI,
    functionName: 'disperseToken',
    args: [params.token, params.recipients, values],
  });
  const hash = (await sendTransactionRequest(params.chainId, {
    to: spender,
    data,
    value: '0x0',
  })) as Hex;
  return { approveHash, hash };
}
