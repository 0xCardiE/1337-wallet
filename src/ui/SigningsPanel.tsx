import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAddress } from 'viem';
import { getUnlockedAccount } from '../lib/accountSession';
import { chainById } from '../lib/chainCatalog';
import {
  clearSigningHistory,
  loadSigningHistory,
  subscribeSigningHistory,
  type SigningKind,
  type SigningRecord,
  type SigningSource,
} from '../lib/signingHistory';
import { type AppSettings } from '../lib/storageState';
import { pagePathAndQuery } from '../lib/txAction';
import { describeError, shortHash } from '../lib/utils';
import { ApprovalFact, ExternalLinkIcon } from './ApprovalsScanOlder';

const KIND_LABEL: Record<SigningKind, string> = {
  message: 'Message',
  typedData: 'Typed data',
  siwe: 'Sign-in',
  permit: 'Permit',
};

const KIND_MARK: Record<SigningKind, string> = {
  message: 'MSG',
  typedData: '712',
  siwe: 'SIWE',
  permit: 'PMT',
};

const SOURCE_LABEL: Record<SigningSource, string> = {
  confirm: 'Confirm sheet',
  instant: 'Burner Mode',
  hardware: 'Hardware device',
};

type DateGroup = {
  label: string;
  rows: SigningRecord[];
};

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDateGroupLabel(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(d, now)) return 'Today';
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function groupRowsByDate(rows: SigningRecord[]): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const row of rows) {
    const label = formatDateGroupLabel(row.signedAt);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  }
  return groups;
}

function formatSignedAt(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 45_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (diff < 86_400_000) return `${Math.max(1, Math.floor(diff / 3_600_000))}h ago`;
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }

  return (
    <button type="button" className="w1337-signings__copy" onClick={() => void onCopy()}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function SigningItem({
  row,
  expanded,
  onToggle,
}: {
  row: SigningRecord;
  expanded: boolean;
  onToggle: () => void;
}) {
  const chain = chainById(row.chainId);
  const path = pagePathAndQuery(row.pageUrl);
  const site = row.hostname ?? row.origin ?? 'Unknown site';
  const when = formatSignedAt(row.signedAt);

  return (
    <li
      className={`w1337-approvals__item${expanded ? ' w1337-approvals__item--open' : ''}`}
      data-testid={`signing-row-${row.id}`}
    >
      <div className="w1337-approvals__row">
        <button
          type="button"
          className="w1337-approvals__main"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          <span className={`w1337-signings__mark w1337-signings__mark--${row.kind}`} aria-hidden>
            {KIND_MARK[row.kind]}
          </span>
          <div className="w1337-approvals__meta">
            <span className="w1337-approvals__token-symbol">{row.headline}</span>
            <span className="w1337-approvals__kind">
              {KIND_LABEL[row.kind]}
              {site ? ` · ${site}` : ''}
            </span>
          </div>
          <span className="w1337-approvals__amt w1337-signings__when">{when}</span>
        </button>
        <button
          type="button"
          className="w1337-approvals__toggle"
          aria-expanded={expanded}
          aria-label={expanded ? 'Hide signing details' : 'Show signing details'}
          onClick={onToggle}
        >
          {expanded ? '−' : '+'}
        </button>
      </div>
      {expanded ? (
        <dl className="w1337-approvals__facts">
          <ApprovalFact label="Site">{site}</ApprovalFact>
          {path ? (
            <ApprovalFact label="Path">
              <span className="w1337-signings__mono">{path}</span>
            </ApprovalFact>
          ) : null}
          {row.origin && !isSameAsSite(row.origin, site) ? (
            <ApprovalFact label="Origin">
              <span className="w1337-signings__mono">{row.origin}</span>
            </ApprovalFact>
          ) : null}
          <ApprovalFact label="Network">{chain?.name ?? `Chain ${row.chainId}`}</ApprovalFact>
          <ApprovalFact label="Type">{KIND_LABEL[row.kind]}</ApprovalFact>
          {row.primaryType ? <ApprovalFact label="Primary type">{row.primaryType}</ApprovalFact> : null}
          {row.domainName ? <ApprovalFact label="Domain">{row.domainName}</ApprovalFact> : null}
          {row.detail ? <ApprovalFact label="Detail">{row.detail}</ApprovalFact> : null}
          <ApprovalFact label="Signed via">{SOURCE_LABEL[row.source]}</ApprovalFact>
          {row.message ? (
            <ApprovalFact label="Message" stack>
              <span className="w1337-signings__body">{row.message}</span>
              <CopyBtn text={row.message} />
            </ApprovalFact>
          ) : null}
          {row.typedFields?.map(field => (
            <ApprovalFact key={field.label} label={field.label} stack>
              <span className="w1337-signings__body w1337-signings__mono">{field.value}</span>
            </ApprovalFact>
          ))}
          {row.signature ? (
            <ApprovalFact label="Signature">
              <span className="w1337-signings__mono">{shortHash(row.signature, 10, 8)}</span>
              <CopyBtn text={row.signature} />
            </ApprovalFact>
          ) : null}
          {row.pageUrl ? (
            <ApprovalFact label="Page">
              <a
                className="w1337-approvals__link"
                href={row.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open <ExternalLinkIcon />
              </a>
            </ApprovalFact>
          ) : null}
        </dl>
      ) : null}
    </li>
  );
}

function isSameAsSite(origin: string, site: string): boolean {
  try {
    return new URL(origin).hostname === site || origin === site;
  } catch {
    return origin === site;
  }
}

export function SigningsPanel({ settings: _settings }: { settings: AppSettings }) {
  const account = getUnlockedAccount();
  const addr = account ? getAddress(account.address) : null;
  const [rows, setRows] = useState<SigningRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const reload = useCallback(async () => {
    if (!addr) {
      setRows([]);
      setHydrated(true);
      return;
    }
    try {
      setRows(await loadSigningHistory(addr));
      setErr(null);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setHydrated(true);
    }
  }, [addr]);

  useEffect(() => {
    setHydrated(false);
    void reload();
  }, [reload]);

  useEffect(() => subscribeSigningHistory(() => void reload()), [reload]);

  const groups = useMemo(() => groupRowsByDate(rows), [rows]);

  async function onClear() {
    if (!addr) return;
    if (
      !confirm(
        'Clear local signing history for this wallet? This cannot be recovered — it is not on-chain.',
      )
    ) {
      return;
    }
    setClearing(true);
    setErr(null);
    try {
      await clearSigningHistory(addr);
      setRows([]);
      setExpandedId(null);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setClearing(false);
    }
  }

  if (!addr) {
    return <p className="w1337-tools-empty muted">Unlock wallet to view signings.</p>;
  }

  const empty = hydrated && rows.length === 0 && !err;

  return (
    <div className="w1337-approvals w1337-signings">
      <div className="w1337-signings__intro">
        <p className="w1337-signings__lead muted">
          Messages and typed data this wallet signed. Stored on this device only — not on-chain.
        </p>
        {rows.length > 0 ? (
          <button
            type="button"
            className="ghost w1337-signings__clear"
            data-testid="signings-clear"
            disabled={clearing}
            onClick={() => void onClear()}
          >
            {clearing ? '…' : 'Clear'}
          </button>
        ) : null}
      </div>

      {err ? <p className="error">{err}</p> : null}

      {!hydrated ? <p className="w1337-tools-empty muted">Loading signings…</p> : null}

      {empty ? (
        <p className="w1337-tools-empty muted" data-testid="signings-empty">
          Nothing signed yet on this wallet.
        </p>
      ) : null}

      {groups.map(group => (
        <div key={group.label} className="w1337-signings__group">
          <p className="w1337-tx-history__date">{group.label}</p>
          <ul className="w1337-approvals__list">
            {group.rows.map(row => (
              <SigningItem
                key={row.id}
                row={row}
                expanded={expandedId === row.id}
                onToggle={() => setExpandedId(cur => (cur === row.id ? null : row.id))}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
