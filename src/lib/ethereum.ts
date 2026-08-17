import { decodeFunctionResult, encodeFunctionData } from 'viem';
import type { TransactionRequest } from '@lifi/types';
import { healthyRpcUrlsFor } from './chainRpcRegistry';
import { getActiveAccountMeta, getUnlockedAccount } from './accountSession';
import { isHardwareAccount } from './accounts';
import { queueInternalHardwareTransaction } from './approvalBridge';
import {
  ERC20_ABI,
  ERC721_ENUM_ABI,
  MULTICALL3_ABI,
  MULTICALL3_ADDRESS,
  PERMIT2_ABI,
  PERMIT2_ADDRESS,
} from './abis';
import {
  classifyRpcFailure,
  recordRpcFailure,
  recordRpcSuccess,
  RpcExhaustedError,
} from './rpcHealth';
import { openNetworkDoctor } from './rpcDoctorBridge';

const ZERO = '0x0000000000000000000000000000000000000000';
const ETH_PLACEHOLDER = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

function rpcList(chainId: number): string[] {
  const list = healthyRpcUrlsFor(chainId);
  if (list.length === 0) {
    throw new Error(
      `No RPC URLs for chain ${chainId}. Open the extension again after LiFi chains load, or try another network.`,
    );
  }
  return list;
}

export async function waitForChainReceipt(
  txHash: string,
  chainId: number,
  timeoutMs = 5 * 60 * 1000,
  intervalMs = 4000,
): Promise<{ status: 'success' | 'reverted' }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rpcs = rpcList(chainId);
    for (const rpc of rpcs) {
      const t0 = performance.now();
      try {
        const res = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getTransactionReceipt',
            params: [txHash],
          }),
        });
        const latencyMs = Math.round(performance.now() - t0);
        if (!res.ok) {
          recordRpcFailure(chainId, rpc, `HTTP ${res.status}`, {
            hard: res.status >= 500 || res.status === 429,
            latencyMs,
          });
          continue;
        }
        const json = (await res.json()) as {
          result?: { status: string };
          error?: { message: string };
        };
        if (json.error?.message) {
          const cls = classifyRpcFailure(json.error.message);
          if (cls.demote) {
            recordRpcFailure(chainId, rpc, json.error.message, {
              hard: cls.hard,
              latencyMs,
            });
          }
          if (cls.retryOtherRpc) continue;
        }
        if (json.result?.status) {
          recordRpcSuccess(chainId, rpc, latencyMs);
          return {
            status: json.result.status === '0x1' ? 'success' : 'reverted',
          };
        }
      } catch (err) {
        const latencyMs = Math.round(performance.now() - t0);
        const msg = err instanceof Error ? err.message : String(err);
        recordRpcFailure(chainId, rpc, msg, { hard: true, latencyMs });
      }
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for receipt ${txHash} (chain ${chainId})`);
}

export async function chainJsonRpcCall<T>(
  chainId: number,
  method: string,
  params: unknown[],
): Promise<T> {
  let lastErr: unknown = null;
  const tried: string[] = [];

  for (const rpc of rpcList(chainId)) {
    type RpcJson = {
      result?: T;
      error?: { message: string; code?: number; data?: unknown };
    };
    const t0 = performance.now();
    tried.push(rpc);

    let res: Response;
    try {
      res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
    } catch (err) {
      const latencyMs = Math.round(performance.now() - t0);
      lastErr = err;
      recordRpcFailure(chainId, rpc, err instanceof Error ? err.message : String(err), {
        hard: true,
        latencyMs,
      });
      continue;
    }

    const latencyMs = Math.round(performance.now() - t0);

    if (!res.ok) {
      const msg = `HTTP ${res.status}`;
      lastErr = new Error(`${rpc} returned ${res.status}`);
      const cls = classifyRpcFailure(msg, res.status);
      if (cls.demote) {
        recordRpcFailure(chainId, rpc, msg, { hard: cls.hard, latencyMs });
      }
      continue;
    }

    let json: RpcJson;
    try {
      json = (await res.json()) as RpcJson;
    } catch (err) {
      lastErr = err;
      recordRpcFailure(chainId, rpc, 'Invalid JSON from RPC', {
        hard: true,
        latencyMs,
      });
      continue;
    }

    if (json.error) {
      const err = new Error(json.error.message) as Error & {
        code?: number;
        data?: unknown;
      };
      err.code = json.error.code;
      err.data = json.error.data;
      const cls = classifyRpcFailure(err);
      if (cls.retryOtherRpc) {
        lastErr = err;
        if (cls.demote) {
          recordRpcFailure(chainId, rpc, err.message, {
            hard: cls.hard,
            latencyMs,
          });
        }
        continue;
      }
      // Endpoint is fine — call-level failure (revert, bad params, etc.)
      recordRpcSuccess(chainId, rpc, latencyMs);
      throw err;
    }

    if (typeof json.result === 'undefined') {
      lastErr = new Error(`${method} returned no result`);
      recordRpcFailure(chainId, rpc, String(lastErr), {
        hard: false,
        latencyMs,
      });
      continue;
    }

    recordRpcSuccess(chainId, rpc, latencyMs);
    return json.result;
  }

  const lastMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  openNetworkDoctor({
    chainId,
    reason: 'exhausted',
    lastError: lastMsg,
    method,
  });
  throw new RpcExhaustedError(chainId, tried, lastMsg, method);
}

export async function getNativeBalance(
  address: string,
  chainId: number,
): Promise<bigint> {
  const hex = await chainJsonRpcCall<string>(chainId, 'eth_getBalance', [
    address,
    'latest',
  ]);
  return BigInt(hex);
}

async function getNonce(chainId: number, address: string): Promise<number> {
  const hex = await chainJsonRpcCall<string>(
    chainId,
    'eth_getTransactionCount',
    [address, 'pending'],
  );
  return Number.parseInt(hex, 16);
}

async function getGasPrice(chainId: number): Promise<bigint> {
  const hex = await chainJsonRpcCall<string>(chainId, 'eth_gasPrice', []);
  return BigInt(hex);
}

async function estimateGas(
  chainId: number,
  args: { from: string; to: string; data?: string; value?: string },
): Promise<bigint> {
  try {
    const hex = await chainJsonRpcCall<string>(chainId, 'eth_estimateGas', [
      {
        from: args.from,
        to: args.to,
        data: args.data ?? '0x',
        value: args.value ?? '0x0',
      },
    ]);
    return BigInt(hex);
  } catch (err) {
    const original = err instanceof Error ? err.message : String(err);
    throw new Error(
      `eth_estimateGas reverted for ${args.to}. Check native gas and that the call would succeed. ${original}`,
    );
  }
}

function toHexQty(n: bigint | number): `0x${string}` {
  return `0x${BigInt(n).toString(16)}`;
}

function bigIntish(v: string | number | undefined | null): bigint | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'number') return BigInt(v);
  const s = v.trim();
  if (!s) return undefined;
  if (s.startsWith('0x') || s.startsWith('0X')) return BigInt(s);
  return BigInt(s);
}

/**
 * Broadcast a {@link TransactionRequest} with the unlocked account.
 * Hardware accounts go through the confirm sheet, then the device.
 */
export async function sendTransactionRequest(
  chainId: number,
  tr: TransactionRequest,
): Promise<string> {
  const account = getUnlockedAccount();
  const meta = getActiveAccountMeta();
  if (!account) {
    throw new Error('Wallet is locked. Unlock to send a transaction.');
  }
  if (!tr.to) {
    throw new Error('Quote did not include transactionRequest.to');
  }

  const value = bigIntish(tr.value) ?? 0n;
  const gasFromQuote = bigIntish(tr.gasLimit);
  const gasLimit =
    gasFromQuote ??
    (await estimateGas(chainId, {
      from: account.address,
      to: tr.to,
      data: tr.data,
      value: tr.value ? `0x${value.toString(16)}` : '0x0',
    }));
  const gasBuffered = (gasLimit * 125n) / 100n;

  const nonce = await getNonce(chainId, account.address);
  const maxFee = bigIntish(tr.maxFeePerGas);
  const maxPrio = bigIntish(tr.maxPriorityFeePerGas);
  const legacyGas = bigIntish(tr.gasPrice);

  if (meta && isHardwareAccount(meta)) {
    const rpcTx: Record<string, unknown> = {
      from: account.address,
      to: tr.to,
      value: toHexQty(value),
      data: (tr.data as string) ?? '0x',
      gas: toHexQty(gasBuffered),
      nonce: toHexQty(nonce),
    };
    if (maxFee !== undefined) {
      rpcTx.maxFeePerGas = toHexQty(maxFee);
      rpcTx.maxPriorityFeePerGas = toHexQty(maxPrio ?? maxFee / 10n);
    } else if (legacyGas !== undefined) {
      rpcTx.gasPrice = toHexQty(legacyGas);
    } else {
      const gasPrice = await getGasPrice(chainId);
      rpcTx.maxFeePerGas = toHexQty((gasPrice * 150n) / 100n);
      rpcTx.maxPriorityFeePerGas = toHexQty(gasPrice / 10n);
    }
    return queueInternalHardwareTransaction({ chainId, tx: rpcTx });
  }

  let signed: `0x${string}`;

  if (maxFee !== undefined) {
    const prio = maxPrio ?? maxFee / 10n;
    signed = await account.signTransaction({
      chainId,
      type: 'eip1559',
      nonce,
      gas: gasBuffered,
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: prio,
      to: tr.to as `0x${string}`,
      value,
      data: (tr.data as `0x${string}`) ?? '0x',
    });
  } else if (legacyGas !== undefined) {
    signed = await account.signTransaction({
      chainId,
      type: 'legacy',
      nonce,
      gas: gasBuffered,
      gasPrice: legacyGas,
      to: tr.to as `0x${string}`,
      value,
      data: (tr.data as `0x${string}`) ?? '0x',
    });
  } else {
    const gasPrice = await getGasPrice(chainId);
    signed = await account.signTransaction({
      chainId,
      type: 'eip1559',
      nonce,
      gas: gasBuffered,
      maxFeePerGas: (gasPrice * 150n) / 100n,
      maxPriorityFeePerGas: gasPrice / 10n,
      to: tr.to as `0x${string}`,
      value,
      data: (tr.data as `0x${string}`) ?? '0x',
    });
  }

  const txHash = await chainJsonRpcCall<string>(
    chainId,
    'eth_sendRawTransaction',
    [signed],
  );
  return txHash;
}

async function erc20Allowance(
  chainId: number,
  token: string,
  owner: string,
  spender: string,
): Promise<bigint> {
  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [owner as `0x${string}`, spender as `0x${string}`],
  });
  const raw = await chainJsonRpcCall<string>(chainId, 'eth_call', [
    { to: token, data },
    'latest',
  ]);
  return decodeFunctionResult({
    abi: ERC20_ABI,
    functionName: 'allowance',
    data: raw as `0x${string}`,
  }) as bigint;
}

/** ERC-20 `balanceOf(holder)` via JSON-RPC. */
export async function erc20BalanceOf(
  chainId: number,
  tokenAddress: string,
  holder: string,
): Promise<bigint> {
  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [holder as `0x${string}`],
  });
  const raw = await chainJsonRpcCall<string>(chainId, 'eth_call', [
    { to: tokenAddress, data },
    'latest',
  ]);
  return decodeFunctionResult({
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    data: raw as `0x${string}`,
  }) as bigint;
}

export type OnChainBalanceProbe = {
  address: string;
  decimals: number;
  symbol: string;
  name: string;
  logoURI?: string;
  priceUSD?: string;
};

type Erc20BalanceMap = Map<string, bigint>;

/**
 * One eth_call to Multicall3: native balance via `getEthBalance(holder)` plus
 * `balanceOf(holder)` for every ERC-20 in `tokenAddresses`. Returns native bigint
 * and a lower-cased map. Throws on chain failure (caller falls back to per-token RPC).
 */
async function multicallNativeAndErc20Balances(
  chainId: number,
  holder: string,
  tokenAddresses: string[],
): Promise<{ native: bigint; erc20: Erc20BalanceMap }> {
  const calls: Array<{ target: `0x${string}`; allowFailure: boolean; callData: `0x${string}` }> = [
    {
      target: MULTICALL3_ADDRESS,
      allowFailure: true,
      callData: encodeFunctionData({
        abi: MULTICALL3_ABI,
        functionName: 'getEthBalance',
        args: [holder as `0x${string}`],
      }),
    },
  ];
  for (const a of tokenAddresses) {
    calls.push({
      target: a as `0x${string}`,
      allowFailure: true,
      callData: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [holder as `0x${string}`],
      }),
    });
  }

  const data = encodeFunctionData({
    abi: MULTICALL3_ABI,
    functionName: 'aggregate3',
    args: [calls],
  });
  const raw = await chainJsonRpcCall<string>(chainId, 'eth_call', [
    { to: MULTICALL3_ADDRESS, data },
    'latest',
  ]);
  const decoded = decodeFunctionResult({
    abi: MULTICALL3_ABI,
    functionName: 'aggregate3',
    data: raw as `0x${string}`,
  }) as readonly { success: boolean; returnData: `0x${string}` }[];

  let native = 0n;
  if (decoded[0]?.success) {
    try {
      native = decodeFunctionResult({
        abi: MULTICALL3_ABI,
        functionName: 'getEthBalance',
        data: decoded[0].returnData,
      }) as bigint;
    } catch {
      native = 0n;
    }
  }

  const erc20: Erc20BalanceMap = new Map();
  for (let i = 0; i < tokenAddresses.length; i += 1) {
    const slot = decoded[i + 1];
    const addr = tokenAddresses[i]!.toLowerCase();
    if (!slot?.success) continue;
    try {
      const bal = decodeFunctionResult({
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        data: slot.returnData,
      }) as bigint;
      erc20.set(addr, bal);
    } catch {
      /* malformed return — leave unset */
    }
  }
  return { native, erc20 };
}

/** Parallel fallback when Multicall3 isn't deployed at the canonical address on a chain. */
async function parallelNativeAndErc20Balances(
  chainId: number,
  holder: string,
  tokenAddresses: string[],
): Promise<{ native: bigint; erc20: Erc20BalanceMap }> {
  const erc20: Erc20BalanceMap = new Map();
  const native = await getNativeBalance(holder, chainId).catch(() => 0n);
  await Promise.all(
    tokenAddresses.map(async addr => {
      try {
        const bal = await erc20BalanceOf(chainId, addr, holder);
        erc20.set(addr.toLowerCase(), bal);
      } catch {
        /* skip */
      }
    }),
  );
  return { native, erc20 };
}

/** Rows with positive on-chain balance for the probed tokens (native + ERC-20). */
export async function snapshotHeldTokensOnChain(
  chainId: number,
  holder: string,
  probes: OnChainBalanceProbe[],
  maxChecks = 80,
): Promise<
  Array<
    OnChainBalanceProbe & {
      amount: string;
      chainId: number;
    }
  >
> {
  const seen = new Set<string>();
  const list: OnChainBalanceProbe[] = [];
  for (const p of probes) {
    const k = p.address.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    list.push(p);
    if (list.length >= maxChecks) break;
  }

  const tokenList = list.filter(p => {
    const a = p.address.toLowerCase();
    return a !== ZERO && a !== ETH_PLACEHOLDER;
  });
  const tokenAddresses = tokenList.map(p => p.address);
  const nativeTpl = list.find(p => {
    const a = p.address.toLowerCase();
    return a === ZERO || a === ETH_PLACEHOLDER;
  });

  let native = 0n;
  let erc20: Erc20BalanceMap = new Map();
  try {
    const r = await multicallNativeAndErc20Balances(chainId, holder, tokenAddresses);
    native = r.native;
    erc20 = r.erc20;
  } catch {
    const r = await parallelNativeAndErc20Balances(chainId, holder, tokenAddresses);
    native = r.native;
    erc20 = r.erc20;
  }

  const out: Array<OnChainBalanceProbe & { amount: string; chainId: number }> = [];
  if (nativeTpl && native > 0n) {
    out.push({ ...nativeTpl, chainId, amount: native.toString() });
  }
  for (const p of tokenList) {
    const bal = erc20.get(p.address.toLowerCase());
    if (bal == null || bal <= 0n) continue;
    out.push({ ...p, chainId, amount: bal.toString() });
  }

  out.sort((x, y) => {
    const bx = BigInt(x.amount);
    const by = BigInt(y.amount);
    if (bx !== by) return bx > by ? -1 : 1;
    return x.symbol.localeCompare(y.symbol);
  });
  return out;
}

/** Revoke ERC-20 approval by setting allowance to zero. Returns tx hash if broadcast. */
export async function revokeErc20Approval(params: {
  chainId: number;
  tokenAddress: string;
  spender: string;
}): Promise<string | null> {
  const account = getUnlockedAccount();
  if (!account) throw new Error('Wallet is locked.');
  const t = params.tokenAddress.toLowerCase();
  if (t === ZERO) return null;

  const cur = await erc20Allowance(
    params.chainId,
    params.tokenAddress,
    account.address,
    params.spender,
  );
  if (cur === 0n) return null;

  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [params.spender as `0x${string}`, 0n],
  });

  return sendTransactionRequest(params.chainId, {
    to: params.tokenAddress,
    data,
    value: '0x0',
    from: account.address,
    chainId: params.chainId,
  });
}

export async function revokeNftApprovalForAll(params: {
  chainId: number;
  contract: string;
  operator: string;
}): Promise<string | null> {
  const account = getUnlockedAccount();
  if (!account) throw new Error('Wallet is locked.');
  const data = encodeFunctionData({
    abi: ERC721_ENUM_ABI,
    functionName: 'setApprovalForAll',
    args: [params.operator as `0x${string}`, false],
  });
  return sendTransactionRequest(params.chainId, {
    to: params.contract,
    data,
    value: '0x0',
    from: account.address,
    chainId: params.chainId,
  });
}

export async function revokePermit2Allowance(params: {
  chainId: number;
  token: string;
  spender: string;
}): Promise<string | null> {
  const account = getUnlockedAccount();
  if (!account) throw new Error('Wallet is locked.');
  const data = encodeFunctionData({
    abi: PERMIT2_ABI,
    functionName: 'approve',
    args: [params.token as `0x${string}`, params.spender as `0x${string}`, 0n, 0],
  });
  return sendTransactionRequest(params.chainId, {
    to: PERMIT2_ADDRESS,
    data,
    value: '0x0',
    from: account.address,
    chainId: params.chainId,
  });
}

/** Approve spender unless token is native or allowance already suffices. Returns tx hash if a tx was broadcast. */
export async function ensureErc20Allowance(params: {
  chainId: number;
  tokenAddress: string;
  spender: string;
  minAmount: bigint;
}): Promise<string | null> {
  const account = getUnlockedAccount();
  if (!account) throw new Error('Wallet is locked.');
  const t = params.tokenAddress.toLowerCase();
  if (t === ZERO) return null;

  const cur = await erc20Allowance(
    params.chainId,
    params.tokenAddress,
    account.address,
    params.spender,
  );
  if (cur >= params.minAmount) return null;

  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [params.spender as `0x${string}`, params.minAmount],
  });

  return sendTransactionRequest(params.chainId, {
    to: params.tokenAddress,
    data,
    value: '0x0',
    from: account.address,
    chainId: params.chainId,
  });
}
