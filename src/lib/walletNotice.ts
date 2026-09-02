import type { WalletNoticeKind, WalletNoticePayload } from './devErrorFormat';

export type WalletNoticeEntry = WalletNoticePayload & {
  id: string;
  at: number;
};

export type { WalletNoticeKind, WalletNoticePayload };

let active: WalletNoticeEntry | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export function getWalletNotice(): WalletNoticeEntry | null {
  return active;
}

export function subscribeWalletNotice(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function clearWalletNotice(): void {
  if (!active) return;
  active = null;
  emit();
}

export function showWalletNotice(payload: WalletNoticePayload): WalletNoticeEntry {
  active = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    kind: payload.kind,
    title: payload.title,
    message: payload.message,
  };
  emit();
  return active;
}

export function showWalletNoticeFromMessage(payload: unknown): void {
  const p = payload as Partial<WalletNoticePayload> | undefined;
  if (!p?.title || !p.message || !p.kind) return;
  if (p.kind !== 'ok' && p.kind !== 'info' && p.kind !== 'warn') return;
  showWalletNotice({ kind: p.kind, title: p.title, message: p.message });
}
