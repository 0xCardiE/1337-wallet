import { useState } from 'react';
import {
  getAccountsMeta,
  getActiveAccountId,
  getSessionPassword,
  hasSessionMnemonic,
} from '../lib/accountSession';
import {
  accountKindLabel,
  DEFAULT_ETH_DERIVATION_PATH,
  shortAddress,
} from '../lib/accounts';
import { connectLedgerAddress } from '../lib/ledger';
import { connectTrezorAddress } from '../lib/trezor';
import { looksLikeMnemonic } from '../lib/walletCore';
import {
  addDerivedSeedAccount,
  addHardwareAccount,
  addLocalAccount,
  removeAccount,
  renameAccount,
  switchActiveAccount,
} from '../lib/walletManager';

export function AccountsPanel({ onChanged }: { onChanged: () => void }) {
  const [importKey, setImportKey] = useState('');
  const [label, setLabel] = useState('');
  const [path, setPath] = useState(DEFAULT_ETH_DERIVATION_PATH);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const accounts = getAccountsMeta();
  const activeId = getActiveAccountId();
  const canAddLocal = Boolean(getSessionPassword());
  const hasSeed = hasSessionMnemonic();

  async function run(labelBusy: string, fn: () => Promise<void>) {
    setBusy(labelBusy);
    setErr(null);
    setMsg(null);
    try {
      await fn();
      onChanged();
      window.dispatchEvent(new Event('1337-account-changed'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="bfox-accounts-panel">
      <strong style={{ color: 'var(--text)' }}>Accounts ({accounts.length})</strong>
      <p className="muted" style={{ fontSize: 12, margin: '6px 0 10px' }}>
        Switch the active account used for dapps, swaps, and sends. Local keys stay encrypted;
        Ledger/Trezor keys never leave the device.
      </p>

      <ul className="bfox-account-manage-list">
        {accounts.map(account => {
          const active = account.id === activeId;
          return (
            <li key={account.id} className={`bfox-account-manage-item${active ? ' is-active' : ''}`}>
              <button
                type="button"
                className="bfox-account-manage-select"
                onClick={() =>
                  void run('switch', async () => {
                    await switchActiveAccount(account.id);
                    setMsg(`Active: ${account.label}`);
                  })
                }
              >
                <span>{account.label}</span>
                <span className="muted mono" style={{ fontSize: 11 }}>
                  {accountKindLabel(account.kind)} · {shortAddress(account.address)}
                </span>
              </button>
              <div className="bfox-account-manage-actions">
                <button
                  type="button"
                  className="ghost"
                  style={{ padding: '6px 8px', fontSize: 11 }}
                  onClick={() => {
                    const next = window.prompt('Account label', account.label);
                    if (next == null) return;
                    void run('rename', async () => {
                      await renameAccount(account.id, next);
                      setMsg('Label updated.');
                    });
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="ghost"
                  style={{ padding: '6px 8px', fontSize: 11 }}
                  disabled={accounts.length <= 1 || busy != null}
                  onClick={() => {
                    if (!confirm(`Remove ${account.label}?`)) return;
                    void run('remove', async () => {
                      await removeAccount(account.id);
                      setMsg('Account removed.');
                    });
                  }}
                >
                  ×
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div style={{ marginTop: 14 }}>
        <strong style={{ fontSize: 13 }}>Add local account</strong>
        <input
          placeholder="Label (optional)"
          value={label}
          onChange={e => setLabel(e.target.value)}
          style={{ marginTop: 8 }}
        />
        <textarea
          className="mono"
          rows={3}
          placeholder="Private key or seed phrase to import (leave empty to generate a key)"
          value={importKey}
          onChange={e => setImportKey(e.target.value)}
          spellCheck={false}
          style={{ marginTop: 8 }}
        />
        <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
          {hasSeed ? (
            <button
              type="button"
              className="ghost"
              disabled={busy != null || !canAddLocal}
              onClick={() =>
                void run('derive', async () => {
                  const account = await addDerivedSeedAccount(label || undefined);
                  setLabel('');
                  setMsg(`Derived ${account.label}`);
                })
              }
            >
              {busy === 'derive' ? '…' : 'Add from seed'}
            </button>
          ) : null}
          <button
            type="button"
            className="ghost"
            disabled={busy != null || !canAddLocal}
            onClick={() =>
              void run('create', async () => {
                const account = await addLocalAccount({ label: label || undefined });
                setImportKey('');
                setLabel('');
                setMsg(`Created ${account.label}`);
              })
            }
          >
            {busy === 'create' ? '…' : 'Generate key'}
          </button>
          <button
            type="button"
            className="ghost"
            disabled={busy != null || !importKey.trim() || !canAddLocal}
            onClick={() =>
              void run('import', async () => {
                const account = await addLocalAccount(
                  looksLikeMnemonic(importKey)
                    ? { mnemonicInput: importKey, label: label || undefined }
                    : { privateKeyInput: importKey, label: label || undefined },
                );
                setImportKey('');
                setLabel('');
                setMsg(`Imported ${account.label}`);
              })
            }
          >
            {busy === 'import' ? '…' : 'Import'}
          </button>
        </div>
        <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
          {hasSeed
            ? 'Seed phrase is in this vault — “Add from seed” derives the next HD account (m/44\'/60\'/0\'/0/n).'
            : 'No seed in this vault yet. Import a 12–24 word phrase, or generate/import a single private key.'}
          {!canAddLocal ? ' Unlock with your password this session to change local keys.' : ''}
        </p>
      </div>

      <div style={{ marginTop: 16 }}>
        <strong style={{ fontSize: 13 }}>Hardware wallets</strong>
        <input
          className="mono"
          value={path}
          onChange={e => setPath(e.target.value)}
          spellCheck={false}
          style={{ marginTop: 8 }}
          aria-label="Derivation path"
        />
        <div className="row" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="ghost"
            disabled={busy != null}
            onClick={() =>
              void run('ledger', async () => {
                const result = await connectLedgerAddress(path.trim() || DEFAULT_ETH_DERIVATION_PATH);
                const account = await addHardwareAccount({
                  kind: 'ledger',
                  address: result.address,
                  derivationPath: result.derivationPath,
                });
                setMsg(`Connected ${account.label}`);
              })
            }
          >
            {busy === 'ledger' ? 'Connecting…' : 'Connect Ledger'}
          </button>
          <button
            type="button"
            className="ghost"
            disabled={busy != null}
            onClick={() =>
              void run('trezor', async () => {
                const result = await connectTrezorAddress(path.trim() || DEFAULT_ETH_DERIVATION_PATH);
                const account = await addHardwareAccount({
                  kind: 'trezor',
                  address: result.address,
                  derivationPath: result.derivationPath,
                });
                setMsg(`Connected ${account.label}`);
              })
            }
          >
            {busy === 'trezor' ? 'Connecting…' : 'Connect Trezor'}
          </button>
        </div>
      </div>

      {msg ? <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>{msg}</p> : null}
      {err ? <p className="error" style={{ marginTop: 8 }}>{err}</p> : null}
    </section>
  );
}
