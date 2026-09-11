import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';

export function ReorderHandle({
  label,
  disabled,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onNudge,
}: {
  label: string;
  disabled?: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onNudge: (delta: -1 | 1) => void;
}) {
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onNudge(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onNudge(1);
    }
  }

  return (
    <button
      type="button"
      className="w1337-networks__grip"
      aria-label={label}
      title={label}
      disabled={disabled}
      data-testid="reorder-handle"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
      onClick={e => e.stopPropagation()}
    >
      <svg width={12} height={16} viewBox="0 0 12 16" aria-hidden>
        <circle cx="3.5" cy="3" r="1.25" fill="currentColor" />
        <circle cx="8.5" cy="3" r="1.25" fill="currentColor" />
        <circle cx="3.5" cy="8" r="1.25" fill="currentColor" />
        <circle cx="8.5" cy="8" r="1.25" fill="currentColor" />
        <circle cx="3.5" cy="13" r="1.25" fill="currentColor" />
        <circle cx="8.5" cy="13" r="1.25" fill="currentColor" />
      </svg>
    </button>
  );
}
