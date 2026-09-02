import { useState } from 'react';
import { getAccountsMeta } from '../lib/accountSession';
import { accountKindLabel } from '../lib/accounts';
import {
  firstUnusedSelection,
  importedAddressSet,
  listHardwareAddressPage,
  type HardwareAddressRow,
} from '../lib/hwAccounts';
import { defaultHwPathScheme, type HwPathScheme } from '../lib/hwDerivation';
import { closeLedgerPickerSession, firstHidDevice, startLedgerHidPicker } from '../lib/ledger';
import { addHardwareAccounts } from '../lib/walletManager';
import { HardwareAccountPicker } from './HardwareAccountPicker';

type PickerState = {
  scheme: HwPathScheme;
  startIndex: number;
  rows: HardwareAddressRow[];
  selected: Record<string, HardwareAddressRow>;
  device: HIDDevice;
};

/** Dedicated full tab: Chrome’s HID chooser only renders in a normal tab, never in the side panel or popup windows. */
export function LedgerHidConnect() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);

  async function showPage(opts: {
    scheme: HwPathScheme;
    startIndex: number;
    device: HIDDevice;
    keepSelected?: Record<string, HardwareAddressRow>;
  }) {
    const rows = await listHardwareAddressPage({
      kind: 'ledger',
      scheme: opts.scheme,
      startIndex: opts.startIndex,
      device: opts.device,
    });
    const imported = importedAddressSet(getAccountsMeta());
    setPicker({
      scheme: opts.scheme,
      startIndex: opts.startIndex,
      rows,
      selected: opts.keepSelected ?? firstUnusedSelection(rows, imported),
      device: opts.device,
    });
  }

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
        await showPage({
          scheme: defaultHwPathScheme('ledger'),
          startIndex: 0,
          device,
        });
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    })();
  }

  async function runPicker(fn: () => Promise<void>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (picker) {
    return (
      <div className="w1337-send-panel" style={{ padding: 16 }}>
        <HardwareAccountPicker
          kind="ledger"
          scheme={picker.scheme}
          rows={picker.rows}
          startIndex={picker.startIndex}
          selected={picker.selected}
          importedAddresses={importedAddressSet(getAccountsMeta())}
          busy={busy}
          onSchemeChange={scheme => {
            setPicker(prev => (prev ? { ...prev, scheme, startIndex: 0 } : prev));
            void runPicker(() =>
              showPage({ scheme, startIndex: 0, device: picker.device }),
            );
          }}
          onToggle={row =>
            setPicker(prev => {
              if (!prev) return prev;
              const selected = { ...prev.selected };
              if (selected[row.derivationPath]) delete selected[row.derivationPath];
              else selected[row.derivationPath] = row;
              return { ...prev, selected };
            })
          }
          onPrev={() =>
            void runPicker(() =>
              showPage({
                scheme: picker.scheme,
                startIndex: Math.max(0, picker.startIndex - picker.rows.length),
                device: picker.device,
                keepSelected: picker.selected,
              }),
            )
          }
          onNext={() =>
            void runPicker(() =>
              showPage({
                scheme: picker.scheme,
                startIndex: picker.startIndex + picker.rows.length,
                device: picker.device,
                keepSelected: picker.selected,
              }),
            )
          }
          onImport={() =>
            void runPicker(async () => {
              const chosen = Object.values(picker.selected);
              const { added } = await addHardwareAccounts(
                chosen.map(row => ({
                  kind: 'ledger' as const,
                  address: row.address,
                  derivationPath: row.derivationPath,
                })),
              );
              setPicker(null);
              await closeLedgerPickerSession();
              setOk(
                added.length === 1
                  ? `Connected ${added[0].label}`
                  : `Connected ${added.length} ${accountKindLabel('ledger')} accounts`,
              );
              window.dispatchEvent(new Event('1337-account-changed'));
              window.setTimeout(() => window.close(), 800);
            })
          }
          onCancel={() => {
            setPicker(null);
            void closeLedgerPickerSession();
          }}
        />
        {err ? <p className="error">{err}</p> : null}
        {ok ? <p className="muted">{ok}</p> : null}
      </div>
    );
  }

  return (
    <div className="w1337-send-panel" style={{ padding: 16 }}>
      <strong style={{ fontSize: 14 }}>Connect Ledger</strong>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Click Allow, then pick your Nano in Chrome’s device list. After that you can choose which
        addresses to import. Unlock it and keep the Ethereum app open. Close Ledger Live if it is
        running.
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
