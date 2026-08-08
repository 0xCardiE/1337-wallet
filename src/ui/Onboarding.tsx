import { useState } from 'react';
import {
  createInitialPrivateKeyWallet,
  createInitialWallet,
  importInitialWallet,
} from '../lib/walletManager';
import { PRODUCT_ONBOARDING_LEAD } from '../lib/productManifest';
import { ScreenHeader } from './ScreenHeader';

type Mode = 'create' | 'import';
type CreateKind = 'seed' | 'privateKey';
type ImportKind = 'seed' | 'privateKey';

export function Onboarding({ onReady }: { onReady: () => void }) {
  const [mode, setMode] = useState<Mode>('create');
  const [createKind, setCreateKind] = useState<CreateKind>('seed');
  const [importKind, setImportKind] = useState<ImportKind>('seed');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [importSecret, setImportSecret] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [backupMnemonic, setBackupMnemonic] = useState<string | null>(null);
  const [backupKey, setBackupKey] = useState<`0x${string}` | null>(null);

  function validatePassword(): string | null {
    if (password.length < 8) return 'Use a password of at least 8 characters.';
    if (password !== password2) return 'Passwords do not match.';
    return null;
  }

  async function handleCreate() {
    setErr(null);
    const pwErr = validatePassword();
    if (pwErr) {
      setErr(pwErr);
      return;
    }
    setBusy(true);
    try {
      if (createKind === 'seed') {
        const { mnemonic, privateKey } = await createInitialWallet(password);
        setBackupMnemonic(mnemonic);
        setBackupKey(privateKey);
      } else {
        const { privateKey } = await createInitialPrivateKeyWallet(password);
        setBackupMnemonic(null);
        setBackupKey(privateKey);
      }
      setShowBackup(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    setErr(null);
    const pwErr = validatePassword();
    if (pwErr) {
      setErr(pwErr);
      return;
    }
    if (!importSecret.trim()) {
      setErr(importKind === 'seed' ? 'Enter your seed phrase.' : 'Enter a private key.');
      return;
    }
    setBusy(true);
    try {
      await importInitialWallet(password, importSecret);
      onReady();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (showBackup && (backupMnemonic || backupKey)) {
    return (
      <div className="wallet-shell w1337">
        <ScreenHeader title="1337" />
        <div className="screen-body">
          <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>
            {backupMnemonic ? 'Back up your seed phrase' : 'Back up your key'}
          </h2>
          <p className="muted">
            {backupMnemonic
              ? 'Write these 12 words down offline. Anyone with this phrase can control every account derived from it. We will not show it again.'
              : 'This is the only time we show the generated private key. Store it offline. Anyone with it controls this wallet.'}
          </p>
          {backupMnemonic ? (
            <div
              className="mono"
              style={{
                margin: '12px 0',
                padding: 12,
                border: '1px solid var(--border)',
                borderRadius: 8,
                lineHeight: 1.7,
                wordSpacing: 4,
              }}
            >
              {backupMnemonic}
            </div>
          ) : (
            <div className="mono" style={{ margin: '12px 0' }}>
              {backupKey}
            </div>
          )}
          <button
            type="button"
            className="primary"
            style={{ width: '100%' }}
            onClick={() => {
              setShowBackup(false);
              onReady();
            }}
          >
            I have saved it — continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-shell w1337">
      <ScreenHeader title="1337" />
      <div className="screen-body">
        <p className="muted" style={{ marginBottom: 14 }}>
          {PRODUCT_ONBOARDING_LEAD}
        </p>

        <div className="row" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className={mode === 'create' ? 'primary' : 'ghost'}
            onClick={() => setMode('create')}
          >
            Create
          </button>
          <button
            type="button"
            className={mode === 'import' ? 'primary' : 'ghost'}
            onClick={() => setMode('import')}
          >
            Import
          </button>
        </div>

        {mode === 'create' ? (
          <div className="row" style={{ marginBottom: 14 }}>
            <button
              type="button"
              className={createKind === 'seed' ? 'primary' : 'ghost'}
              onClick={() => setCreateKind('seed')}
            >
              Seed phrase
            </button>
            <button
              type="button"
              className={createKind === 'privateKey' ? 'primary' : 'ghost'}
              onClick={() => setCreateKind('privateKey')}
            >
              Private key
            </button>
          </div>
        ) : (
          <div className="row" style={{ marginBottom: 14 }}>
            <button
              type="button"
              className={importKind === 'seed' ? 'primary' : 'ghost'}
              onClick={() => setImportKind('seed')}
            >
              Seed phrase
            </button>
            <button
              type="button"
              className={importKind === 'privateKey' ? 'primary' : 'ghost'}
              onClick={() => setImportKind('privateKey')}
            >
              Private key
            </button>
          </div>
        )}

        <label htmlFor="pw">Password (encrypts local vault)</label>
        <input
          id="pw"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <label htmlFor="pw2">Confirm password</label>
        <input
          id="pw2"
          type="password"
          autoComplete="new-password"
          value={password2}
          onChange={e => setPassword2(e.target.value)}
        />

        {mode === 'import' ? (
          <>
            <label htmlFor="secret">
              {importKind === 'seed' ? 'Seed phrase (12–24 words)' : 'Private key'}
            </label>
            <textarea
              id="secret"
              className="mono"
              rows={importKind === 'seed' ? 4 : 3}
              placeholder={
                importKind === 'seed'
                  ? 'word1 word2 word3 …'
                  : '0x… or 64 hex chars'
              }
              value={importSecret}
              onChange={e => setImportSecret(e.target.value)}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </>
        ) : null}

        {err ? <p className="error">{err}</p> : null}

        <button
          type="button"
          className="primary"
          style={{ width: '100%', marginTop: 12 }}
          disabled={busy}
          onClick={() => void (mode === 'create' ? handleCreate() : handleImport())}
        >
          {busy
            ? 'Working…'
            : mode === 'create'
              ? createKind === 'seed'
                ? 'Create with seed phrase'
                : 'Create with private key'
              : importKind === 'seed'
                ? 'Import seed phrase'
                : 'Import private key'}
        </button>
      </div>
    </div>
  );
}
