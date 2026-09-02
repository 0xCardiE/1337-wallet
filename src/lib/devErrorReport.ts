import {
  formatDevError,
  formatProviderRpcError,
  providerErrorTitle,
  shouldReportProviderError,
  userNoticeForProviderFailure,
  userNoticeForSignSuccess,
  type WalletNoticePayload,
} from './devErrorFormat';
import type { DevErrorMessagePayload } from './devErrorLog';

export function pushDevErrorToWallet(
  payload: DevErrorMessagePayload & {
    title: string;
    summary: string;
    detail: string;
    sections: DevErrorMessagePayload['sections'];
  },
): void {
  void chrome.runtime
    .sendMessage({ type: 'DEV_ERROR', payload })
    .catch(() => {});
}

export function pushWalletNotice(payload: WalletNoticePayload): void {
  void chrome.runtime
    .sendMessage({ type: 'WALLET_NOTICE', payload })
    .catch(() => {});
}

export function reportProviderRpcFailure(opts: {
  method: string;
  code?: number;
  message: string;
  origin?: string;
  chainId?: number;
  params?: unknown[];
  rpcData?: unknown;
}): void {
  const code = opts.code ?? 4001;
  const notice = userNoticeForProviderFailure(opts.method, code, opts.message);
  if (notice) {
    pushWalletNotice(notice);
    return;
  }
  if (!shouldReportProviderError(code, opts.message, opts.method)) return;
  const formatted = formatProviderRpcError(opts);
  pushDevErrorToWallet({
    source: 'dapp',
    title: providerErrorTitle(opts.method, opts.code),
    summary: formatted.summary,
    sections: formatted.sections,
    detail: formatted.detail,
  });
}

export function reportDappSignSuccess(method: string): void {
  const notice = userNoticeForSignSuccess(method);
  if (notice) pushWalletNotice(notice);
}

export function reportInternalFailure(opts: {
  source: string;
  title: string;
  err: unknown;
  context?: Record<string, unknown>;
}): void {
  const formatted = formatDevError(opts.err, opts.context);
  pushDevErrorToWallet({
    source: opts.source,
    title: opts.title,
    summary: formatted.summary,
    sections: formatted.sections,
    detail: formatted.detail,
  });
}
