import { effectiveTxConfirmMode, type AppSettings } from './storageState';
import {
  effectiveActiveInstantGates,
  effectiveHighValueNative,
} from './instantGates';
import { classifyRequest } from './txRisk';
import type { ProviderRequest } from '../provider/types';

/** Whether a dapp provider sign/send should queue the approval sheet. */
export function shouldQueueDappApproval(
  settings: AppSettings,
  opts: {
    hardware?: boolean;
    hasLocalKey: boolean;
    request?: ProviderRequest;
    chainId?: number;
    origin?: string;
  },
): boolean {
  if (opts.hardware) return true;
  if (!opts.hasLocalKey) return true;
  if (effectiveTxConfirmMode(settings) === 'normal') return true;
  if (settings.instantFullyUngated) return false;
  if (!opts.request || opts.chainId == null) return false;

  const active = effectiveActiveInstantGates(settings);
  if (active.size === 0) return false;

  const report = classifyRequest(opts.request, {
    chainId: opts.chainId,
    origin: opts.origin,
    highValueNative: effectiveHighValueNative(settings),
  });
  return report.hits.some(id => active.has(id));
}

/** Whether in-wallet sends (inline send, etc.) need an extra confirm step. */
export function shouldConfirmInWalletSend(settings: AppSettings): boolean {
  return effectiveTxConfirmMode(settings) === 'normal';
}
