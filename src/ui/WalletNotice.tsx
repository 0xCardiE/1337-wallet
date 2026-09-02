import { useEffect, useSyncExternalStore } from 'react';
import {
  clearWalletNotice,
  getWalletNotice,
  showWalletNoticeFromMessage,
  subscribeWalletNotice,
} from '../lib/walletNotice';

const AUTO_DISMISS_MS = 5000;

export function WalletNotice() {
  const entry = useSyncExternalStore(subscribeWalletNotice, getWalletNotice, getWalletNotice);

  useEffect(() => {
    if (!entry) return;
    const id = window.setTimeout(() => clearWalletNotice(), AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [entry?.id]);

  useEffect(() => {
    const onMessage = (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (r?: unknown) => void,
    ) => {
      const m = message as { type?: string; payload?: unknown };
      if (m?.type !== 'WALLET_NOTICE') return;
      showWalletNoticeFromMessage(m.payload);
      sendResponse({ ok: true });
      return true;
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  if (!entry) return null;

  return (
    <div
      className={`w1337-notice w1337-notice--${entry.kind}`}
      role="status"
      aria-live="polite"
    >
      <div className="w1337-notice__body">
        <strong className="w1337-notice__title">{entry.title}</strong>
        <p className="w1337-notice__msg">{entry.message}</p>
      </div>
      <button
        type="button"
        className="w1337-notice__close"
        onClick={() => clearWalletNotice()}
        aria-label="Dismiss"
      >
        Close
      </button>
    </div>
  );
}
