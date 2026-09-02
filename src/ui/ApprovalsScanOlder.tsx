import type { ReactNode } from 'react';
import { APPROVAL_LOG_LOOKBACK_DAYS } from '../lib/tokenApprovals';

export function ExternalLinkIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" />
      <polyline points="15 3 21 3 21 9" strokeLinecap="round" />
      <line x1="10" y1="14" x2="21" y2="3" strokeLinecap="round" />
    </svg>
  );
}

export function ApprovalFact({
  label,
  children,
  stack,
}: {
  label: string;
  children: ReactNode;
  stack?: boolean;
}) {
  return (
    <div className={`w1337-approvals__fact${stack ? ' w1337-approvals__fact--stack' : ''}`}>
      <dt className="muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function ApprovalsScanOlder({
  scannedDays,
  scannedFromGenesis,
  busy,
  note,
  onScanOlder,
}: {
  scannedDays: number | null;
  scannedFromGenesis: boolean;
  busy: boolean;
  note?: string | null;
  onScanOlder: () => void;
}) {
  if (scannedDays == null) return null;
  if (scannedFromGenesis) {
    return <p className="w1337-approvals__older-meta muted">Reached chain genesis.</p>;
  }
  return (
    <div className="w1337-approvals__older">
      <button
        type="button"
        className="ghost w1337-approvals__older-btn"
        disabled={busy}
        onClick={onScanOlder}
      >
        {busy ? 'Scanning…' : `Scan older (${APPROVAL_LOG_LOOKBACK_DAYS} more days)`}
      </button>
      {note && !busy ? <p className="w1337-approvals__older-meta muted">{note}</p> : null}
    </div>
  );
}

export function olderScanNote(found: number): string {
  return found === 0
    ? `Checked previous ${APPROVAL_LOG_LOOKBACK_DAYS} days. Nothing new.`
    : `Found ${found} more in the previous ${APPROVAL_LOG_LOOKBACK_DAYS} days.`;
}
