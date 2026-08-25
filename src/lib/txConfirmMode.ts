import { isHardwareAccount, isKeyBackedAccount, type WalletAccount } from './accounts';
import { getActiveAccountMeta } from './accountSession';
import { effectiveTxConfirmMode, type AppSettings } from './storageState';
import {
  effectiveActiveInstantGates,
  effectiveHighValueNative,
} from './instantGates';
import { classifyRequest } from './txRisk';
import type { ProviderRequest } from '../provider/types';

/**
 * Burner Mode is per software wallet. Hardware never auto-signs.
 * Unset `account.instant` still follows the legacy global toggle.
 */
export function accountInstantEnabled(
  account: WalletAccount | undefined,
  settings: AppSettings,
): boolean {
  if (!account || isHardwareAccount(account) || !isKeyBackedAccount(account)) return false;
  if (account.instant === true) return true;
  if (account.instant === false) return false;
  return effectiveTxConfirmMode(settings) === 'speed';
}

/** Whether a dapp provider sign/send should queue the approval sheet. */
export function shouldQueueDappApproval(
  settings: AppSettings,
  opts: {
    hardware?: boolean;
    hasLocalKey: boolean;
    /** Active software wallet Burner Mode. False/undefined means confirm. */
    instantOn?: boolean;
    request?: ProviderRequest;
    chainId?: number;
    origin?: string;
  },
): boolean {
  if (opts.hardware) return true;
  if (!opts.hasLocalKey) return true;
  if (!opts.instantOn) return true;
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
export function shouldConfirmInWalletSend(
  settings: AppSettings,
  account?: WalletAccount,
): boolean {
  return !accountInstantEnabled(account ?? getActiveAccountMeta(), settings);
}
