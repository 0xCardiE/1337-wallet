import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { WalletAccount } from '../lib/accounts';
import { accountKindLabel, shortAddress } from '../lib/accounts';
import { accountLabelWithEns } from '../lib/ens';
import { useEnsName } from '../lib/useEnsName';

export type AccountAction =
  | { type: 'rename'; account: WalletAccount }
  | { type: 'remove'; account: WalletAccount };

export function AccountActionSheet({
  action,
  busy,
  onCancel,
  onRename,
  onRemove,
}: {
  action: AccountAction | null;
  busy?: boolean;
  onCancel: () => void;
  onRename: (label: string) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (action?.type === 'rename') {
      setDraft(action.account.label);
    } else {
      setDraft('');
    }
  }, [action]);

  useEffect(() => {
    if (!action) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [action, onCancel]);

  const ensName = useEnsName(action?.account.address);

  if (!action || typeof document === 'undefined') return null;

  const labelWithEns = accountLabelWithEns(action.account, ensName);
  const meta = `${accountKindLabel(action.account)} · ${shortAddress(action.account.address)}${
    ensName ? ` · ${ensName}` : ''
  }`;

  return createPortal(
    <div className="w1337-acct-sheet-mount" role="dialog" aria-modal="true">
      <button
        type="button"
        className="w1337-acct-sheet-backdrop"
        aria-label="Close"
        disabled={busy}
        onClick={onCancel}
      />
      <div className="w1337-acct-sheet-panel w1337-acct-action-sheet">
        <div className="w1337-acct-sheet-head">
          <strong>{action.type === 'rename' ? 'Rename account' : 'Remove account'}</strong>
        </div>

        <div className="w1337-acct-action-sheet__body">
          {action.type === 'rename' ? (
            <>
              <p className="muted w1337-acct-action-sheet__meta">{meta}</p>
              <label htmlFor="acct-rename">Label</label>
              <input
                id="acct-rename"
                value={draft}
                autoFocus
                disabled={busy}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && draft.trim()) onRename(draft);
                }}
              />
            </>
          ) : (
            <>
              <p className="w1337-acct-action-sheet__warn">
                Remove <strong>{labelWithEns}</strong>?
              </p>
              <p className="muted w1337-acct-action-sheet__meta">{meta}</p>
              <p className="muted w1337-acct-action-sheet__hint">
                This only removes the account from this wallet. Your seed phrase and any saved
                keys stay in the vault unless you wipe the wallet.
              </p>
            </>
          )}
        </div>

        <div className="w1337-acct-action-sheet__actions">
          <button type="button" className="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          {action.type === 'rename' ? (
            <button
              type="button"
              className="primary"
              disabled={busy || !draft.trim()}
              onClick={() => onRename(draft)}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          ) : (
            <button type="button" className="danger" disabled={busy} onClick={onRemove}>
              {busy ? 'Removing…' : 'Remove'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
