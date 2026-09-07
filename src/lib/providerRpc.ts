import { getAddress } from 'viem';
import { allChains, chainById } from './chainCatalog';
import {
  addressFromPrivateKey,
  bytesToHexMessage,
  parseTypedDataParam,
  signAndSendTransaction,
  signEip712,
  signPersonalMessage,
} from './backgroundSign';
import { applyGasOverrides, type GasOverrideInput } from './gasOverrides';
import {
  effectiveActiveChainId,
  loadPersisted,
  patchSettings,
} from './storageState';
import { accountInstantEnabled, shouldQueueDappApproval } from './txConfirmMode';
import { getActiveAccount } from './accounts';
import {
  connectAddress,
  disconnectAddress,
  disconnectOrigin,
  isAddressConnected,
} from './dappConnections';
import { chainJsonRpcCall } from './ethereum';
import { reportDappSignSuccess, reportProviderRpcFailure } from './devErrorReport';
import { isSignMethod, queueApprovalRequest } from './pendingApprovals';
import { recordSuccessfulSigning } from './signingHistory';
import { parseChainIdParam, providerError, toHexChainId } from '../provider/types';
import type { ProviderRequest, ProviderResponse } from '../provider/types';
import {
  eip5792Capabilities,
  parseWalletGetCapabilitiesParams,
} from './walletCapabilities';

export async function executeSignRequest(
  pk: `0x${string}`,
  chainId: number,
  method: string,
  params: unknown[],
  gasOverrides?: GasOverrideInput,
): Promise<unknown> {
  if (method === 'eth_sendTransaction') {
    const tx = params[0] as Record<string, unknown>;
    if (!tx || typeof tx !== 'object') throw new Error('Invalid transaction');
    const { tx: merged, signOpts } = applyGasOverrides(tx, gasOverrides);
    return signAndSendTransaction(pk, chainId, merged as never, signOpts);
  }

  if (method === 'personal_sign') {
    const msgParam = params[0];
    const addrParam = params[1];
    const addr = addressFromPrivateKey(pk);
    if (typeof addrParam === 'string' && getAddress(addrParam) !== addr) {
      throw new Error('Signer address mismatch');
    }
    return signPersonalMessage(pk, bytesToHexMessage(msgParam as string));
  }

  if (
    method === 'eth_signTypedData' ||
    method === 'eth_signTypedData_v3' ||
    method === 'eth_signTypedData_v4'
  ) {
    let typedRaw = params[1] ?? params[0];
    if (method === 'eth_signTypedData_v3' || method === 'eth_signTypedData_v4') {
      typedRaw = params[1];
    }
    const typed = parseTypedDataParam(typedRaw);
    return signEip712(pk, typed);
  }

  throw Object.assign(new Error(`Unsupported method: ${method}`), { code: 4200 });
}

export type ProviderRpcResult = ProviderResponse & {
  /** Set when switch/add chain succeeded so background can emit chainChanged. */
  switchedChainId?: number;
  /** Set when wallet_revokePermissions disconnected the requesting origin. */
  disconnected?: boolean;
};

function ethAccountsPermission(sessionAddr: string): Record<string, unknown> {
  return {
    eth_accounts: {
      parentCapability: 'eth_accounts',
      date: Date.now(),
      caveats: [{ type: 'restrictReturnedAccounts', value: [sessionAddr] }],
    },
  };
}

/** Read / simulation RPC forwarded to the active chain's RPC (for dapp previews). */
const PROXY_RPC_METHODS = new Set([
  'eth_call',
  'eth_estimateGas',
  'eth_getBalance',
  'eth_getTransactionCount',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_blockNumber',
  'eth_gasPrice',
  'eth_maxPriorityFeePerGas',
  'eth_feeHistory',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'eth_getLogs',
]);

export async function handleProviderRpc(
  pk: `0x${string}` | null,
  request: ProviderRequest,
  origin?: string,
  opts?: {
    tabId?: number;
    pageUrl?: string;
    onApprovalQueued?: () => void;
    onApprovalExpired?: () => void;
    sessionAddress?: `0x${string}`;
    hardware?: boolean;
  },
): Promise<ProviderRpcResult> {
  const { id, method, params = [] } = request;
  let chainId = 1;
  try {
    const { settings, accounts, activeAccountId } = await loadPersisted();
    chainId = effectiveActiveChainId(settings);
    const sessionAddr = pk
      ? getAddress(addressFromPrivateKey(pk))
      : opts?.sessionAddress
        ? getAddress(opts.sessionAddress)
        : null;

    if (method === 'eth_chainId') {
      return { id, ok: true, result: toHexChainId(chainId) };
    }

    if (method === 'net_version') {
      return { id, ok: true, result: String(chainId) };
    }

    if (method === 'wallet_getPermissions') {
      if (!sessionAddr || !origin || !(await isAddressConnected(origin, sessionAddr))) {
        return { id, ok: true, result: [] };
      }
      return {
        id,
        ok: true,
        result: [
          {
            parentCapability: 'eth_accounts',
            caveats: [{ type: 'restrictReturnedAccounts', value: [sessionAddr] }],
          },
        ],
      };
    }

    if (method === 'wallet_requestPermissions') {
      if (!sessionAddr) {
        throw Object.assign(new Error('1337 is locked. Unlock the extension first.'), {
          code: 4100,
        });
      }
      const requested = params[0] as Record<string, unknown> | undefined;
      if (!requested || typeof requested !== 'object' || !('eth_accounts' in requested)) {
        throw Object.assign(new Error('Unsupported permission requested'), { code: 4200 });
      }
      if (origin) await connectAddress(origin, sessionAddr);
      return { id, ok: true, result: ethAccountsPermission(sessionAddr) };
    }

    if (method === 'wallet_revokePermissions') {
      const requested = params[0] as Record<string, unknown> | undefined;
      if (!requested || typeof requested !== 'object' || !('eth_accounts' in requested)) {
        throw Object.assign(new Error('Unsupported permission requested'), { code: 4200 });
      }
      if (origin && sessionAddr) await disconnectAddress(origin, sessionAddr);
      else if (origin) await disconnectOrigin(origin);
      return { id, ok: true, result: null, disconnected: true };
    }

    // Discovery only — always succeed. Uniswap calls this after Permit2/swap;
    // 4100/"unsupported" surfaces as a DEV error even when the swap worked.
    if (method === 'wallet_getCapabilities') {
      const parsed = parseWalletGetCapabilitiesParams(params);
      if (
        parsed.address &&
        sessionAddr &&
        parsed.address.toLowerCase() !== sessionAddr.toLowerCase()
      ) {
        return { id, ok: true, result: {} };
      }
      return { id, ok: true, result: eip5792Capabilities(parsed.chainIds) };
    }

    if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
      if (!sessionAddr) {
        if (method === 'eth_requestAccounts') {
          throw Object.assign(new Error('1337 is locked. Unlock the extension first.'), {
            code: 4100,
          });
        }
        return { id, ok: true, result: [] };
      }
      if (method === 'eth_requestAccounts') {
        if (origin) await connectAddress(origin, sessionAddr);
        return { id, ok: true, result: [sessionAddr] };
      }
      if (origin && !(await isAddressConnected(origin, sessionAddr))) {
        return { id, ok: true, result: [] };
      }
      return { id, ok: true, result: [sessionAddr] };
    }

    if (!sessionAddr) {
      throw Object.assign(new Error('1337 is locked. Unlock the extension first.'), {
        code: 4100,
      });
    }

    if (method === 'eth_sign') {
      throw Object.assign(
        new Error('eth_sign is disabled. Use personal_sign or eth_signTypedData_v4.'),
        { code: 4200 },
      );
    }

    if (method === 'wallet_switchEthereumChain') {
      const p = params[0] as { chainId?: string } | undefined;
      const next = parseChainIdParam(p?.chainId);
      if (next == null) throw new Error('Invalid chainId');
      if (!chainById(next)) {
        throw Object.assign(
          new Error(`Unrecognized chain ID ${next}. Add the chain first.`),
          { code: 4902 },
        );
      }
      await patchSettings({ activeChainId: next });
      return { id, ok: true, result: null, switchedChainId: next };
    }

    if (method === 'wallet_addEthereumChain') {
      const p = params[0] as { chainId?: string } | undefined;
      const next = parseChainIdParam(p?.chainId);
      if (next == null) throw new Error('Invalid chainId');
      /* Dapps may request a switch. They cannot plant or prefer an RPC — only
         Networks (user) and the catalog own endpoints. */
      if (!chainById(next)) {
        throw Object.assign(
          new Error(`Unrecognized chain ID ${next}. Add the chain in Networks first.`),
          { code: 4902 },
        );
      }
      await patchSettings({ activeChainId: next });
      return { id, ok: true, result: null, switchedChainId: next };
    }

    if (isSignMethod(method)) {
      const mustConfirm = shouldQueueDappApproval(settings, {
        hardware: opts?.hardware,
        hasLocalKey: Boolean(pk),
        instantOn: accountInstantEnabled(
          getActiveAccount(accounts, activeAccountId),
          settings,
        ),
        request,
        chainId,
        origin,
      });
      if (mustConfirm) {
        const approval = await queueApprovalRequest({
          request,
          origin,
          pageUrl: opts?.pageUrl,
          tabId: opts?.tabId,
          chainId,
          onQueued: opts?.onApprovalQueued,
          onExpired: opts?.onApprovalExpired,
        });
        if (!approval.ok && approval.error) {
          reportProviderRpcFailure({
            method,
            code: approval.error.code,
            message: approval.error.message,
            origin,
            chainId,
            params,
          });
        } else if (approval.ok) {
          reportDappSignSuccess(method);
        }
        return approval;
      }
      if (!pk) {
        throw Object.assign(new Error('1337 is locked. Unlock the extension first.'), {
          code: 4100,
        });
      }
      const result = await executeSignRequest(pk, chainId, method, params);
      reportDappSignSuccess(method);
      void recordSuccessfulSigning({
        account: addressFromPrivateKey(pk),
        chainId,
        request,
        origin,
        pageUrl: opts?.pageUrl,
        signature: typeof result === 'string' ? result : undefined,
        source: 'instant',
      });
      return { id, ok: true, result };
    }

    if (PROXY_RPC_METHODS.has(method)) {
      const result = await chainJsonRpcCall(chainId, method, params);
      return { id, ok: true, result };
    }

    throw Object.assign(new Error(`Unsupported method: ${method}`), { code: 4200 });
  } catch (err) {
    const e = err as Error & { code?: number; data?: unknown };
    const code = e.code ?? 4001;
    const message = e.message ?? String(err);
    reportProviderRpcFailure({
      method,
      code,
      message,
      origin,
      chainId,
      params,
      rpcData: e.data,
    });
    return {
      id,
      ok: false,
      error: providerError(code, message),
    };
  }
}

export function chainMetadataForProvider(chainId: number): unknown {
  const c = chainById(chainId);
  if (!c) return null;
  return {
    chainId: toHexChainId(c.chainId),
    chainName: c.name,
    rpcUrls: c.rpcUrls,
    nativeCurrency: c.nativeCurrency,
    blockExplorerUrls: c.blockExplorerUrls,
  };
}

export function allProviderChains(): unknown[] {
  return allChains().map(c => chainMetadataForProvider(c.chainId));
}
