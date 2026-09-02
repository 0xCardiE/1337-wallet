import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getAccountsMeta,
  getActiveAccountId,
  getActiveAccountMeta,
} from '../lib/accountSession';
import { accountKindLabel, isKeyBackedAccount, shortAddress } from '../lib/accounts';
import type { AppSettings } from '../lib/storageState';
import { accountInstantEnabled } from '../lib/txConfirmMode';
import { AccountLabel } from './AccountLabel';
import { switchActiveAccount } from '../lib/walletManager';
import { PassportScoreBadge } from './PassportScoreBadge';
import { TxConfirmModeToggle } from './TxConfirmModeBar';

function ChevronUpIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function AccountSwitcher({
  settings,
  onChanged,
  onOpenWallets,
}: {
  settings: AppSettings;
  onChanged?: () => void;
  onOpenWallets?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const accounts = getAccountsMeta();
  const active = getActiveAccountMeta();
  const activeId = getActiveAccountId();
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    window.addEventListener('1337-account-changed', bump);
    return () => window.removeEventListener('1337-account-changed', bump);
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      if (selectTimerRef.current) window.clearTimeout(selectTimerRef.current);
      if (openTimerRef.current) window.clearTimeout(openTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!active || accounts.length === 0) return null;

  async function copyAddress(address: string, id: string) {
    try {
      await navigator.clipboard.writeText(address);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      setCopiedId(id);
      copyTimerRef.current = window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setErr('Could not copy address');
    }
  }

  function scheduleSelect(id: string) {
    if (selectTimerRef.current) window.clearTimeout(selectTimerRef.current);
    selectTimerRef.current = window.setTimeout(() => {
      selectTimerRef.current = null;
      void select(id);
    }, 220);
  }

  function onRowDoubleClick(address: string, id: string) {
    if (selectTimerRef.current) {
      window.clearTimeout(selectTimerRef.current);
      selectTimerRef.current = null;
    }
    void copyAddress(address, id);
  }

  function scheduleOpen() {
    if (openTimerRef.current) window.clearTimeout(openTimerRef.current);
    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null;
      setOpen(true);
    }, 220);
  }

  function onTriggerDoubleClick(address: string) {
    if (openTimerRef.current) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    void copyAddress(address, 'dock');
  }

  async function select(id: string) {
    if (id === activeId || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await switchActiveAccount(id);
      setOpen(false);
      onChanged?.();
      window.dispatchEvent(new Event('1337-account-changed'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const canSwitch = accounts.length > 1;
  const activeBurner = accountInstantEnabled(active, settings);

  const sheet =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div className="w1337-acct-sheet-mount" role="dialog" aria-label="Switch account">
            <button
              type="button"
              className="w1337-acct-sheet-backdrop"
              aria-label="Close"
              onClick={() => setOpen(false)}
            />
            <div className="w1337-acct-sheet-panel">
              <div className="w1337-acct-sheet-head">
                <strong>Switch account</strong>
                {onOpenWallets ? (
                  <button
                    type="button"
                    className="ghost w1337-acct-sheet-open"
                    data-testid="acct-sheet-open"
                    onClick={() => {
                      setOpen(false);
                      onOpenWallets();
                    }}
                  >
                    Open
                  </button>
                ) : null}
              </div>

              <ul className="w1337-acct-sheet-list">
                {accounts.map(account => {
                  const selected = account.id === activeId;
                  const burnerOn = accountInstantEnabled(account, settings);
                  return (
                    <li
                      key={account.id}
                      className={`w1337-acct-sheet-item${selected ? ' w1337-acct-sheet-item--on' : ''}${burnerOn ? ' w1337-acct-sheet-item--burner' : ''}`}
                    >
                      <button
                        type="button"
                        className="w1337-acct-sheet-row"
                        disabled={busy}
                        title="Click to switch · double-click address to copy"
                        onClick={() => scheduleSelect(account.id)}
                        onDoubleClick={() => onRowDoubleClick(account.address, account.id)}
                      >
                        <span className="w1337-acct-sheet-row__text">
                          <span
                            className={`w1337-acct-sheet-row__label${
                              copiedId === account.id ? ' w1337-acct-sheet-row__label--copied' : ''
                            }`}
                          >
                            {copiedId === account.id ? (
                              'Copied!'
                            ) : (
                              <AccountLabel account={account} />
                            )}
                          </span>
                          <span className="w1337-acct-sheet-row__meta mono">
                            {accountKindLabel(account.kind)}
                            {burnerOn ? ' · Burner' : ''} · {shortAddress(account.address)}
                          </span>
                        </span>
                        <PassportScoreBadge address={account.address} />
                      </button>
                      {isKeyBackedAccount(account) ? (
                        <TxConfirmModeToggle
                          settings={settings}
                          account={account}
                          onSaved={onChanged}
                          compact
                        />
                      ) : (
                        <span className="w1337-acct-burner-slot" aria-hidden />
                      )}
                      <span className="w1337-acct-sheet-row__trail">
                        {selected ? (
                          <span className="w1337-acct-sheet-row__check" aria-hidden>
                            <CheckIcon />
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {!canSwitch ? (
                <p className="muted w1337-acct-sheet-hint">
                  {onOpenWallets
                    ? 'Open Wallets to add more accounts.'
                    : 'Add more accounts in Settings → Wallets.'}
                </p>
              ) : null}

              {err ? <p className="error w1337-acct-sheet-err">{err}</p> : null}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className={`w1337-acct-dock${activeBurner ? ' w1337-acct-dock--burner' : ''}`}>
        <button
          type="button"
          className={`w1337-acct-trigger w1337-acct-trigger--dock${open ? ' w1337-acct-trigger--open' : ''}${activeBurner ? ' w1337-acct-trigger--burner' : ''}`}
          onClick={() => scheduleOpen()}
          onDoubleClick={() => onTriggerDoubleClick(active.address)}
          title={`${active.address}${activeBurner ? ' · Burner Mode on' : ''} · double-click to copy`}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <span className="w1337-acct-trigger__main">
            <span
              className={`w1337-acct-trigger__label${
                copiedId === 'dock' ? ' w1337-acct-trigger__label--copied' : ''
              }`}
            >
              {copiedId === 'dock' ? (
                'Copied!'
              ) : (
                <AccountLabel account={active} fallback="Account" />
              )}
            </span>
            <span className="w1337-acct-trigger__sub mono">
              {accountKindLabel(active.kind)}
              {activeBurner ? ' · Burner' : ''} · {shortAddress(active.address)}
            </span>
          </span>
          <PassportScoreBadge address={active.address} />
        </button>
        <TxConfirmModeToggle settings={settings} account={active} onSaved={onChanged} />
        <button
          type="button"
          className="w1337-acct-dock__chev"
          onClick={() => scheduleOpen()}
          aria-label="Switch account"
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <ChevronUpIcon />
        </button>
      </div>
      {sheet}
    </>
  );
}
