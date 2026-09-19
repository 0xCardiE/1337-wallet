import { useEffect, useState } from 'react';
import { loadPersisted } from '../lib/storageState';
import { unlockWallet } from '../lib/walletManager';
import { Brand1337 } from './Brand1337';

export function Unlock({ onUnlocked }: { onUnlocked: () => void }) {
  const [hasVault, setHasVault] = useState<boolean | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadPersisted().then(s => setHasVault(s.vault != null));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasVault) return;
    setBusy(true);
    setErr(null);
    try {
      await unlockWallet(password);
      onUnlocked();
    } catch (error) {
      setErr(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  if (hasVault === undefined) {
    return (
      <div className="unlock-screen unlock-screen--loading">
        <p className="unlock-loading">Loading…</p>
      </div>
    );
  }

  if (!hasVault) {
    return (
      <p className="panel error">No vault found. Reload the extension.</p>
    );
  }

  return (
    <div className="unlock-screen">
      <div className="unlock-brand">
        <Brand1337 className="unlock-brand-stack" />
      </div>

      <form className="unlock-form" onSubmit={e => void submit(e)}>
        <label htmlFor="unlock-pw" className="unlock-label">
          Password
        </label>
        <input
          id="unlock-pw"
          type="password"
          className="unlock-input"
          autoComplete="current-password"
          value={password}
          placeholder="Enter your password"
          onChange={e => setPassword(e.target.value)}
          autoFocus
          data-testid="unlock-password"
        />
        {err ? <p className="unlock-error">{err}</p> : null}
        <button
          type="submit"
          className="unlock-submit"
          disabled={busy || !password}
          data-testid="unlock-submit"
        >
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>

      <div className="unlock-footer-art" aria-hidden="true" />
    </div>
  );
}
