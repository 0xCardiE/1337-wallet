import { useState } from 'react';
import { DEFAULT_ETH_DERIVATION_PATH } from '../lib/accounts';
import {
  connectLedgerAddress,
  firstHidDevice,
  startLedgerHidPicker,
} from '../lib/ledger';
import { addHardwareAccount } from '../lib/walletManager';

function pathFromQuery(): string {
  const raw = new URLSearchParams(window.location.search).get('path')?.trim();
  return raw || DEFAULT_ETH_DERIVATION_PATH;
}

/** Dedicated full tab: Chrome’s HID chooser only renders in a normal tab, never in the side panel or popup windows. */
export function LedgerHidConnect() {
  const path = pathFromQuery();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function onAllow() {
    const pick = startLedgerHidPicker();
    setBusy(true);
    setErr(null);
    void (async () => {
      try {
        const device = firstHidDevice(await pick);
        if (!device) {
          throw new Error(
            'Chrome did not grant the Ledger. Close Ledger Live, unlock the Nano, open the Ethereum app, then pick it in the browser list.',
          );
        }
        const result = await connectLedgerAddress(path, { device });
        const account = await addHardwareAccount({
          kind: 'ledger',
          address: result.address,
          derivationPath: result.derivationPath,
        });
        setOk(`Connected ${account.label}`);
        window.dispatchEvent(new Event('1337-account-changed'));
        window.setTimeout(() => window.close(), 800);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    })();
  }

  return (
    <div className="w1337-send-panel" style={{ padding: 16 }}>
      <strong style={{ fontSize: 14 }}>Connect Ledger</strong>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Click Allow, then pick your Nano in Chrome’s device list. Unlock it and keep the Ethereum
        app open. Close Ledger Live if it is running.
      </p>
      <p className="mono" style={{ fontSize: 11, marginTop: 8 }}>
        {path}
      </p>
      {err ? <p className="error">{err}</p> : null}
      {ok ? <p className="muted">{ok}</p> : null}
      <button
        type="button"
        className="primary"
        style={{ width: '100%', marginTop: 12 }}
        disabled={busy || ok != null}
        onClick={() => onAllow()}
      >
        {busy ? 'Waiting for Chrome…' : 'Allow Ledger'}
      </button>
    </div>
  );
}
