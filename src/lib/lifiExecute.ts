import type { LiFiStep, Token } from '@lifi/types';
import { getStatus } from '@lifi/sdk';
import {
  ensureErc20Allowance,
  sendTransactionRequest,
  waitForChainReceipt,
} from './ethereum';
import { isNativeToken } from './lifiHelpers';
import { describeRevertedTx } from './txFailureDetail';

export type LiFiExecCallbacks = {
  onLog: (msg: string) => void;
  onTx?: (tx: { chainId: number; hash: `0x${string}` } | null) => void;
};

export type LiFiExecuteResult = {
  step: LiFiStep;
  txHash: `0x${string}`;
  fromChainId: number;
  crossChain: boolean;
};

/**
 * Approve (if needed), broadcast, and wait for the source-chain receipt of a LiFi step.
 */
export async function executeLiFiStep(
  step: LiFiStep,
  options: {
    fromTokenBalance: bigint;
    refreshQuote: () => Promise<LiFiStep>;
    callbacks: LiFiExecCallbacks;
    hardware?: boolean;
  },
): Promise<LiFiExecuteResult> {
  const { callbacks, refreshQuote, hardware } = options;
  const onLog = callbacks.onLog;
  const onTx = callbacks.onTx;

  let current = step;
  const est = current.estimate;
  if (!current.transactionRequest || !est) {
    throw new Error('Quote has no execution payload.');
  }

  const fromC = current.action.fromChainId;
  const spend = BigInt(current.action.fromAmount);
  if (spend > options.fromTokenBalance) {
    throw new Error(
      'Amount exceeds wallet balance on the source chain. Lower the gas amount or pick another token.',
    );
  }

  const approvalAddr = est.approvalAddress;
  const tokenAddr = current.action.fromToken.address;

  if (!est.skipApproval && approvalAddr && !isNativeToken(tokenAddr)) {
    onLog(hardware ? 'Confirm the token approval on your device…' : 'Checking token allowance…');
    onTx?.(null);
    const ah = await ensureErc20Allowance({
      chainId: fromC,
      tokenAddress: tokenAddr,
      spender: approvalAddr,
      minAmount: spend,
    });
    if (ah) {
      onLog(`Approval sent (${ah.slice(0, 10)}…), waiting…`);
      onTx?.({ chainId: fromC, hash: ah as `0x${string}` });
      const recApprove = await waitForChainReceipt(ah, fromC);
      if (recApprove.status !== 'success') {
        throw new Error(await describeRevertedTx(fromC, ah as `0x${string}`));
      }
      onLog('Re-fetching quote after approval…');
      onTx?.(null);
      current = await refreshQuote();
      if (!current.transactionRequest) {
        throw new Error('Re-quote after approval did not return transaction data.');
      }
    }
  }

  onLog(hardware ? 'Confirm the swap on your device…' : 'Submitting transaction…');
  onTx?.(null);
  const txHash = (await sendTransactionRequest(fromC, current.transactionRequest)) as `0x${string}`;
  onLog(`Submitted: ${txHash}`);
  onTx?.({ chainId: fromC, hash: txHash });

  const rec = await waitForChainReceipt(txHash, fromC);
  if (rec.status !== 'success') {
    throw new Error(await describeRevertedTx(fromC, txHash));
  }

  return {
    step: current,
    txHash,
    fromChainId: fromC,
    crossChain: fromC !== current.action.toChainId,
  };
}

export function pollLiFiCrossChainStatus(params: {
  txHash: string;
  fromChain: number;
  toChain: number;
  tool: string;
  destToken: Token;
  onLog: (msg: string) => void;
  onDone: (status: 'DONE' | 'FAILED', substatus?: string) => void;
  intervalMs?: number;
}): () => void {
  const intervalMs = params.intervalMs ?? 5000;
  const id = window.setInterval(() => {
    void (async () => {
      try {
        const st = await getStatus({
          txHash: params.txHash,
          fromChain: String(params.fromChain),
          toChain: String(params.toChain),
          bridge: params.tool,
        });
        params.onLog(
          `Cross-chain status: ${st.status}${st.substatus ? ` (${st.substatus})` : ''}`,
        );
        if (st.status === 'DONE' || st.status === 'FAILED') {
          params.onDone(st.status, st.substatus);
        }
      } catch (err) {
        params.onLog(
          err instanceof Error ? err.message : 'Status check failed.',
        );
      }
    })();
  }, intervalMs);
  return () => window.clearInterval(id);
}
