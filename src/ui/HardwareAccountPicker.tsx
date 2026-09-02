import { accountKindLabel, shortAddress } from '../lib/accounts';
import {
  HW_ADDRESS_PAGE_SIZE,
  HW_PATH_SCHEMES,
  type HardwareKind,
  type HwPathScheme,
} from '../lib/hwDerivation';
import type { HardwareAddressRow } from '../lib/hwAccounts';
import { Segment1337 } from './Select1337';

export function HardwareAccountPicker({
  kind,
  scheme,
  onSchemeChange,
  rows,
  startIndex,
  selected,
  importedAddresses,
  busy,
  onToggle,
  onImport,
  onPrev,
  onNext,
  onCancel,
}: {
  kind: HardwareKind;
  scheme: HwPathScheme;
  onSchemeChange: (scheme: HwPathScheme) => void;
  rows: HardwareAddressRow[];
  startIndex: number;
  selected: Record<string, HardwareAddressRow>;
  importedAddresses: Set<string>;
  busy?: boolean;
  onToggle: (row: HardwareAddressRow) => void;
  onImport: () => void;
  onPrev: () => void;
  onNext: () => void;
  onCancel: () => void;
}) {
  const selectedCount = Object.keys(selected).length;
  const deviceLabel = accountKindLabel(kind);
  const from = startIndex + 1;
  const to = startIndex + rows.length;

  return (
    <div className="w1337-hw-picker">
      <strong className="w1337-hw-picker__title">Choose {deviceLabel} addresses</strong>
      <p className="muted w1337-hw-picker__lead">
        Pick one or more accounts to import. Already imported addresses stay in the list but
        cannot be added again.
      </p>
      <div className="onboarding-segments w1337-hw-picker__schemes">
        <Segment1337
          value={scheme}
          onChange={v => onSchemeChange(v as HwPathScheme)}
          ariaLabel="Derivation path"
          options={HW_PATH_SCHEMES}
          disabled={busy}
        />
      </div>
      <ul className="w1337-hw-picker__list">
        {rows.map(row => {
          const imported = importedAddresses.has(row.address.toLowerCase());
          const checked = imported || Boolean(selected[row.derivationPath]);
          return (
            <li key={row.derivationPath}>
              <label
                className={`w1337-hw-picker__row${imported ? ' is-imported' : ''}${
                  checked && !imported ? ' is-picked' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={imported || busy}
                  onChange={() => onToggle(row)}
                />
                <span className="w1337-hw-picker__copy">
                  <span className="w1337-hw-picker__addr mono">
                    #{row.index} {shortAddress(row.address)}
                  </span>
                  <span className="muted mono w1337-hw-picker__path">{row.derivationPath}</span>
                </span>
                {imported ? <span className="muted w1337-hw-picker__tag">Imported</span> : null}
              </label>
            </li>
          );
        })}
      </ul>
      <div className="w1337-hw-picker__pager">
        <button type="button" className="ghost" disabled={busy || startIndex === 0} onClick={onPrev}>
          Previous
        </button>
        <span className="muted">
          {from}–{to}
        </span>
        <button type="button" className="ghost" disabled={busy} onClick={onNext}>
          Next {HW_ADDRESS_PAGE_SIZE}
        </button>
      </div>
      <div className="w1337-hw-picker__actions">
        <button type="button" className="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          disabled={busy || selectedCount === 0}
          onClick={onImport}
        >
          {busy
            ? 'Working…'
            : selectedCount === 1
              ? 'Import 1 address'
              : `Import ${selectedCount} addresses`}
        </button>
      </div>
    </div>
  );
}
