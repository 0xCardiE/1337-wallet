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
  isKeyBackedAccount,
  shortAddress,
} from '../lib/accounts';
import {
  connectLedgerAddress,
  firstHidDevice,
  openLedgerHidConnectWindow,
  startLedgerHidPicker,
} from '../lib/ledger';
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
import { AccountActionSheet, type AccountAction } from './AccountActionSheet';
import { AccountLabel } from './AccountLabel';
import { PassportScoreBadge } from './PassportScoreBadge';
import { Segment1337 } from './Select1337';
import { TxConfirmModeToggle } from './TxConfirmModeBar';
import type { AppSettings } from '../lib/storageState';
import { accountInstantEnabled } from '../lib/txConfirmMode';

type AddMode = 'derive' | 'importKey' | 'import' | 'generate';

export function AccountsPanel({
  settings,
  onChanged,
}: {
  settings: AppSettings;
  onChanged: () => void;
}) {
  const [importKey, setImportKey] = useState('');
  const [label, setLabel] = useState('');
  const [path, setPath] = useState(DEFAULT_ETH_DERIVATION_PATH);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [action, setAction] = useState<AccountAction | null>(null);

  const accounts = getAccountsMeta();
  const activeId = getActiveAccountId();
  const canAddLocal = Boolean(getSessionPassword());
  const hasSeed = hasSessionMnemonic();
  const [addMode, setAddMode] = useState<AddMode>(hasSeed ? 'derive' : 'import');

  const addModeOptions = hasSeed
    ? [
        { value: 'derive', label: 'From seed' },
        { value: 'importKey', label: 'Import key' },
        { value: 'generate', label: 'Generate' },
      ]
    : [
        { value: 'import', label: 'Import' },
        { value: 'generate', label: 'Generate' },
      ];

  const needsSecret = addMode === 'importKey' || addMode === 'import';
  const addButtonLabel =
    addMode === 'derive'
      ? 'Add from seed'
      : addMode === 'generate'
        ? 'Generate key'
        : addMode === 'importKey'
          ? 'Import private key'
          : 'Import';

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

  async function handleAddAccount() {
    if (addMode === 'derive') {
      await run('derive', async () => {
        const account = await addDerivedSeedAccount(label || undefined);
        setLabel('');
        setMsg(`Derived ${account.label}`);
      });
      return;
    }

    if (addMode === 'generate') {
      await run('create', async () => {
        const account = await addLocalAccount({ label: label || undefined });
        setImportKey('');
        setLabel('');
        setMsg(`Created ${account.label}`);
      });
      return;
    }

    if (!importKey.trim()) {
      setErr(addMode === 'importKey' ? 'Enter a private key.' : 'Enter a seed phrase or private key.');
      return;
    }

    await run('import', async () => {
      const account = await addLocalAccount(
        addMode === 'importKey' || !looksLikeMnemonic(importKey)
          ? { privateKeyInput: importKey, label: label || undefined }
          : { mnemonicInput: importKey, label: label || undefined },
      );
      setImportKey('');
      setLabel('');
      setMsg(`Imported ${account.label}`);
    });
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
          const burnerOn = accountInstantEnabled(account, settings);
          return (
            <li
              key={account.id}
              className={`bfox-account-manage-item${active ? ' is-active' : ''}${
                burnerOn ? ' bfox-account-manage-item--burner' : ''
              }`}
            >
              <button
                type="button"
                className="bfox-account-manage-select"
                onClick={() =>
                  void run('switch', async () => {
                    await switchActiveAccount(account.id);
                  })
                }
              >
                <AccountLabel account={account} />
                <span className="muted mono bfox-account-manage-meta">
                  {accountKindLabel(account.kind)}
                  {burnerOn ? ' · Burner' : ''} · {shortAddress(account.address)}
                </span>
              </button>
              <PassportScoreBadge address={account.address} />
              {isKeyBackedAccount(account) ? (
                <TxConfirmModeToggle
                  settings={settings}
                  account={account}
                  onSaved={onChanged}
                  compact
                />
              ) : null}
              <div className="bfox-account-manage-actions">
                <button
                  type="button"
                  className="ghost"
                  style={{ padding: '6px 8px', fontSize: 11 }}
                  onClick={() => setAction({ type: 'rename', account })}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="ghost"
                  style={{ padding: '6px 8px', fontSize: 11 }}
                  disabled={accounts.length <= 1 || busy != null}
                  onClick={() => setAction({ type: 'remove', account })}
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
        <div className="onboarding-segments" style={{ marginTop: 10, marginBottom: 10 }}>
          <Segment1337
            value={addMode}
            onChange={v => setAddMode(v as AddMode)}
            ariaLabel="How to add account"
            options={addModeOptions}
          />
        </div>
        <input
          placeholder="Label (optional)"
          value={label}
          onChange={e => setLabel(e.target.value)}
        />
        {needsSecret ? (
          <textarea
            className="mono"
            rows={3}
            placeholder={
              addMode === 'importKey'
                ? '0x… or 64 hex chars'
                : 'Seed phrase (12–24 words) or private key'
            }
            value={importKey}
            onChange={e => setImportKey(e.target.value)}
            spellCheck={false}
            style={{ marginTop: 8 }}
          />
        ) : null}
        <button
          type="button"
          className="primary"
          style={{ width: '100%', marginTop: 10 }}
          disabled={busy != null || !canAddLocal || (needsSecret && !importKey.trim())}
          onClick={() => void handleAddAccount()}
        >
          {busy === 'derive' || busy === 'create' || busy === 'import' ? 'Working…' : addButtonLabel}
        </button>
        <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
          {addMode === 'derive'
            ? 'Derives the next HD account from your vault seed (m/44\'/60\'/0\'/0/n).'
            : addMode === 'importKey'
              ? 'Imports a standalone private key alongside your seed accounts. Shows as Imported.'
              : addMode === 'generate'
                ? 'Creates a new random private key in this vault.'
                : 'Import a seed phrase to set up HD accounts, or a private key for a single imported account.'}
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
        <div className="row bfox-hw-actions" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="ghost"
            disabled={busy != null}
            onClick={() => {
              const derivationPath = path.trim() || DEFAULT_ETH_DERIVATION_PATH;
              const pick = startLedgerHidPicker();
              void run('ledger', async () => {
                let device: HIDDevice | undefined;
                try {
                  device = firstHidDevice(await pick);
                } catch {
                  device = undefined;
                }
                if (!device) {
                  await openLedgerHidConnectWindow(derivationPath);
                  setMsg('Pick the Nano in the Ledger window, then Chrome’s device list.');
                  return;
                }
                const result = await connectLedgerAddress(derivationPath, { device });
                const account = await addHardwareAccount({
                  kind: 'ledger',
                  address: result.address,
                  derivationPath: result.derivationPath,
                });
                setMsg(`Connected ${account.label}`);
              });
            }}
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

      <AccountActionSheet
        action={action}
        busy={busy === 'rename' || busy === 'remove'}
        onCancel={() => setAction(null)}
        onRename={nextLabel =>
          void run('rename', async () => {
            if (!action || action.type !== 'rename') return;
            await renameAccount(action.account.id, nextLabel);
            setAction(null);
            setMsg('Label updated.');
          })
        }
        onRemove={() =>
          void run('remove', async () => {
            if (!action || action.type !== 'remove') return;
            await removeAccount(action.account.id);
            setAction(null);
            setMsg('Account removed.');
          })
        }
      />
    </section>
  );
}
