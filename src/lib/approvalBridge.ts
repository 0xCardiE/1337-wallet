import type { PendingApproval } from './pendingApprovals';
import type { GasOverrideInput } from './gasOverrides';

const INTERNAL_POLL_MS = 400;
const INTERNAL_TIMEOUT_MS = 10 * 60 * 1000;

function sendMessage<T>(msg: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response: T) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(response);
    });
  });
}

export async function fetchPendingApprovals(): Promise<PendingApproval[]> {
  try {
    const res = (await sendMessage<{ ok: boolean; pending?: PendingApproval[] }>({
      type: 'GET_PENDING_APPROVALS',
    })) as { ok: boolean; pending?: PendingApproval[] };
    return res?.ok && Array.isArray(res.pending) ? res.pending : [];
  } catch {
    return [];
  }
}

export async function resolvePendingApproval(
  id: string,
  approved: boolean,
  gasOverrides?: GasOverrideInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = (await sendMessage<{ ok: boolean; error?: string }>({
      type: 'RESOLVE_PENDING_APPROVAL',
      id,
      approved,
      gasOverrides,
    })) as { ok: boolean; error?: string };
    return res ?? { ok: false, error: 'No response' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/** Queue an in-wallet send through the confirm sheet (hardware accounts). */
export async function queueInternalHardwareTransaction(params: {
  chainId: number;
  tx: Record<string, unknown>;
}): Promise<`0x${string}`> {
  const queued = await sendMessage<{ ok: boolean; id?: string; error?: string }>({
    type: 'QUEUE_INTERNAL_APPROVAL',
    chainId: params.chainId,
    tx: params.tx,
  });
  if (!queued?.ok || !queued.id) {
    throw new Error(queued?.error || 'Could not open the hardware confirmation sheet.');
  }
  const id = queued.id;
  const started = Date.now();
  while (Date.now() - started < INTERNAL_TIMEOUT_MS) {
    const row = await sendMessage<{
      status?: 'pending' | 'ok' | 'error';
      result?: unknown;
      error?: string;
    }>({
      type: 'GET_INTERNAL_RESULT',
      id,
    });
    if (row?.status === 'ok' && typeof row.result === 'string' && row.result.startsWith('0x')) {
      return row.result as `0x${string}`;
    }
    if (row?.status === 'error') {
      throw new Error(row.error || 'Request rejected.');
    }
    await sleep(INTERNAL_POLL_MS);
  }
  throw new Error('Hardware confirmation timed out. Keep the 1337 window open and try again.');
}

export async function requestHardwareConfirmWindow(): Promise<void> {
  try {
    await sendMessage({ type: 'OPEN_HARDWARE_CONFIRM_UI' });
  } catch {
    /* ignore */
  }
}

/** Resolve a pending dapp request after the UI signed it (e.g. hardware wallet). */
export async function completePendingApproval(
  id: string,
  result?: unknown,
  error?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = (await sendMessage<{ ok: boolean; error?: string }>({
      type: 'COMPLETE_PENDING_APPROVAL',
      id,
      result,
      error,
    })) as { ok: boolean; error?: string };
    return res ?? { ok: false, error: 'No response' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
