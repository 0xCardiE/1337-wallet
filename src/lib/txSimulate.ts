import { decodeErrorResult, isHex, type Hex } from 'viem';
import { chainJsonRpcCall } from './ethereum';

export type TxSimStatus = 'ok' | 'revert' | 'error';

export type TxSimResult = {
  status: TxSimStatus;
  revertReason?: string;
};

const ERROR_STRING_ABI = [
  {
    type: 'error',
    name: 'Error',
    inputs: [{ name: 'message', type: 'string' }],
  },
] as const;

const PANIC_ABI = [
  {
    type: 'error',
    name: 'Panic',
    inputs: [{ name: 'code', type: 'uint256' }],
  },
] as const;

function extractRevertHex(err: unknown): Hex | null {
  const msg =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err);
  const m = msg.match(/0x[a-fA-F0-9]{8,}/);
  return m && isHex(m[0]) ? (m[0] as Hex) : null;
}

function decodeRevertData(data: Hex): string {
  const selector = data.slice(0, 10).toLowerCase();
  if (data === '0x') return 'Empty revert (no reason string)';
  if (selector === '0x08c379a0') {
    try {
      const decoded = decodeErrorResult({ abi: ERROR_STRING_ABI, data });
      return String(decoded.args[0]);
    } catch {
      /* fall through */
    }
  }
  if (selector === '0x4e487b71') {
    try {
      const decoded = decodeErrorResult({ abi: PANIC_ABI, data });
      return `Panic(0x${Number(decoded.args[0]).toString(16)})`;
    } catch {
      /* fall through */
    }
  }
  return `Custom error ${selector}`;
}

function parseRpcMessageReason(message: string): string | null {
  const patterns = [
    /execution reverted:\s*(.+)$/i,
    /reverted with reason string\s+'([^']+)'/i,
    /reverted with reason string\s+"([^"]+)"/i,
  ];
  for (const p of patterns) {
    const m = message.match(p);
    if (m?.[1]) {
      const t = m[1].trim();
      if (t && !/^0x[a-fA-F0-9]+$/i.test(t)) return t;
    }
  }
  if (/execution reverted/i.test(message)) return 'Execution reverted';
  return null;
}

/** Local eth_call: succeed / revert / RPC error. No balance-diff claims. */
export async function simulateTransaction(params: {
  chainId: number;
  from: string;
  to?: string;
  data?: string;
  value?: string;
}): Promise<TxSimResult> {
  const call = {
    from: params.from,
    to: params.to,
    data: params.data && params.data !== '' ? params.data : '0x',
    value: params.value && params.value !== '' ? params.value : '0x0',
  };

  try {
    await chainJsonRpcCall<string>(params.chainId, 'eth_call', [call, 'latest']);
    return { status: 'ok' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const data = extractRevertHex(err);
    if (data) {
      return { status: 'revert', revertReason: decodeRevertData(data) };
    }
    const parsed = parseRpcMessageReason(message);
    if (parsed) return { status: 'revert', revertReason: parsed };
    return { status: 'error', revertReason: message };
  }
}
