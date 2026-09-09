import { useState } from 'react';
import {
  createInitialPrivateKeyWallet,
  createInitialWallet,
  importInitialWallet,
} from '../lib/walletManager';
import {
  PRODUCT_ONBOARDING_LEAD,
  PRODUCT_ONBOARDING_TERMS_CHECKBOX,
  PRODUCT_ONBOARDING_TERMS_LEAD,
  PRODUCT_PRIVACY_URL,
  PRODUCT_TERMS_URL,
} from '../lib/productManifest';
import { ScreenHeader } from './ScreenHeader';
import { Segment1337 } from './Select1337';

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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [backupMnemonic, setBackupMnemonic] = useState<string | null>(null);
  const [backupKey, setBackupKey] = useState<`0x${string}` | null>(null);

  function validatePassword(): string | null {
    if (!acceptedTerms) return 'Accept the terms of use before continuing.';
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
            data-testid="onboarding-continue"
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

        <div className="onboarding-segments">
          <Segment1337
            value={mode}
            onChange={v => setMode(v as Mode)}
            ariaLabel="Create or import wallet"
            options={[
              { value: 'create', label: 'Create' },
              { value: 'import', label: 'Import' },
            ]}
          />
          <Segment1337
            value={mode === 'create' ? createKind : importKind}
            onChange={v => {
              if (mode === 'create') setCreateKind(v as CreateKind);
              else setImportKind(v as ImportKind);
            }}
            ariaLabel="Wallet type"
            options={[
              { value: 'seed', label: 'Seed phrase' },
              { value: 'privateKey', label: 'Private key' },
            ]}
          />
        </div>

        <label htmlFor="pw">Password (encrypts local vault)</label>
        <input
          id="pw"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          data-testid="onboarding-password"
        />
        <label htmlFor="pw2">Confirm password</label>
        <input
          id="pw2"
          type="password"
          autoComplete="new-password"
          value={password2}
          onChange={e => setPassword2(e.target.value)}
          data-testid="onboarding-password-confirm"
        />

        {mode === 'import' ? (
          <>
            <label htmlFor="secret">
              {importKind === 'seed' ? 'Seed phrase (12–24 words)' : 'Private key'}
            </label>
            <textarea
              id="secret"
              className="mono"
              data-testid="onboarding-secret"
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

        <p className="muted" style={{ marginTop: 14, fontSize: 12, lineHeight: 1.45 }}>
          {PRODUCT_ONBOARDING_TERMS_LEAD}
        </p>
        <div className="w1337-settings-gate-row" style={{ marginTop: 8 }}>
          <input
            id="onboarding-terms"
            className="w1337-settings-gate-row__box"
            type="checkbox"
            checked={acceptedTerms}
            onChange={e => setAcceptedTerms(e.target.checked)}
            data-testid="onboarding-terms"
          />
          <label htmlFor="onboarding-terms" className="w1337-settings-gate-row__copy">
            <span>{PRODUCT_ONBOARDING_TERMS_CHECKBOX}</span>
            <span className="muted">
              <a href={PRODUCT_TERMS_URL} target="_blank" rel="noreferrer">
                Terms of use
              </a>
              {' · '}
              <a href={PRODUCT_PRIVACY_URL} target="_blank" rel="noreferrer">
                Privacy
              </a>
            </span>
          </label>
        </div>

        <button
          type="button"
          className="primary"
          style={{ width: '100%', marginTop: 12 }}
          disabled={busy || !acceptedTerms}
          data-testid="onboarding-submit"
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
