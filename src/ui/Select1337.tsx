import { useEffect, useRef } from 'react';
import { LiFiIcon } from './LiFiIcon';

export type Select1337Option = {
  value: string;
  label: string;
  sublabel?: string;
  logoURI?: string;
};

export type Select1337Group = {
  label: string;
  options: Select1337Option[];
};

function ChevronDownIcon() {
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
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width={14}
      height={14}
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

function OptionLogo({ logoURI, label }: { logoURI?: string; label: string }) {
  return <LiFiIcon logoURI={logoURI} label={label} size={24} rounded />;
}

export function Select1337({
  id,
  label,
  openMenu,
  setOpenMenu,
  value,
  triggerLabel,
  triggerSublabel,
  triggerLogoURI,
  groups,
  onPick,
  disabled,
  panelMaxHeight = 280,
  showLogos = true,
}: {
  id: string;
  label: string;
  openMenu: string | null;
  setOpenMenu: (v: string | null) => void;
  value: string;
  triggerLabel: string;
  triggerSublabel?: string;
  triggerLogoURI?: string;
  groups: Select1337Group[];
  onPick: (value: string) => void;
  disabled?: boolean;
  panelMaxHeight?: number;
  showLogos?: boolean;
}) {
  const open = openMenu === id;
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, setOpenMenu]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpenMenu]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const onWheel = (e: WheelEvent) => {
      if (panel.scrollHeight <= panel.clientHeight) return;
      const atTop = panel.scrollTop <= 0;
      const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1;
      if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
        e.preventDefault();
      }
      e.stopPropagation();
    };

    panel.addEventListener('wheel', onWheel, { passive: false });
    return () => panel.removeEventListener('wheel', onWheel);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`w1337-dd${showLogos ? '' : ' w1337-dd--plain'}${open ? ' w1337-dd--open' : ''}`}
    >
      <span className="w1337-dd__label">{label}</span>
      <button
        type="button"
        className={`w1337-dd__trigger${open ? ' w1337-dd__trigger--open' : ''}`}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={triggerSublabel ?? triggerLabel}
        onClick={() => setOpenMenu(open ? null : id)}
      >
        <span className="w1337-dd__trigger-main">
          {showLogos && triggerLogoURI ? (
            <OptionLogo logoURI={triggerLogoURI} label={triggerLabel} />
          ) : null}
          <span className="w1337-dd__trigger-text">
            <span className="w1337-dd__trigger-value">{triggerLabel}</span>
            {triggerSublabel ? (
              <span className="w1337-dd__trigger-sub">{triggerSublabel}</span>
            ) : null}
          </span>
        </span>
        <span className="w1337-dd__chev" aria-hidden>
          <ChevronDownIcon />
        </span>
      </button>
      {open ? (
        <div
          ref={panelRef}
          className="w1337-dd__panel"
          role="listbox"
          aria-label={label}
          style={{ maxHeight: panelMaxHeight }}
        >
          {groups.map(group => (
            <div key={group.label} className="w1337-dd__group">
              {groups.length > 1 ? (
                <div className="w1337-dd__group-label">{group.label}</div>
              ) : null}
              {group.options.map(opt => {
                const selected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`w1337-dd__option${selected ? ' w1337-dd__option--on' : ''}`}
                    title={opt.sublabel ?? opt.label}
                    onClick={() => {
                      onPick(opt.value);
                      setOpenMenu(null);
                    }}
                  >
                    <span className="w1337-dd__option-main">
                      {showLogos ? (
                        <OptionLogo logoURI={opt.logoURI} label={opt.label} />
                      ) : null}
                      <span className="w1337-dd__option-text">
                        <span className="w1337-dd__option-label">{opt.label}</span>
                        {opt.sublabel ? (
                          <span className="w1337-dd__option-sub">{opt.sublabel}</span>
                        ) : null}
                      </span>
                    </span>
                    {selected ? (
                      <span className="w1337-dd__check" aria-hidden>
                        <CheckIcon />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SimpleSelect1337({
  id,
  label,
  openMenu,
  setOpenMenu,
  value,
  options,
  onChange,
  disabled,
  panelMaxHeight = 240,
}: {
  id: string;
  label: string;
  openMenu: string | null;
  setOpenMenu: (v: string | null) => void;
  value: string;
  options: Select1337Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  panelMaxHeight?: number;
}) {
  const selected = options.find(opt => opt.value === value);

  return (
    <Select1337
      id={id}
      label={label}
      openMenu={openMenu}
      setOpenMenu={setOpenMenu}
      value={value}
      triggerLabel={selected?.label ?? value}
      triggerSublabel={selected?.sublabel}
      groups={[{ label: '', options }]}
      onPick={onChange}
      disabled={disabled}
      panelMaxHeight={panelMaxHeight}
      showLogos={false}
    />
  );
}

export function Segment1337({
  value,
  onChange,
  options,
  ariaLabel = 'Options',
  className,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; title?: string }[];
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`w1337-seg${className ? ` ${className}` : ''}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={`w1337-seg__btn${value === opt.value ? ' w1337-seg__btn--on' : ''}`}
          title={opt.title}
          disabled={disabled}
          onClick={() => {
            if (opt.value !== value) onChange(opt.value);
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
