export function RefreshIconButton({
  busy,
  disabled,
  onClick,
  ariaLabel = 'Refresh',
  className,
}: {
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`w1337-icon-head w1337-refresh-icon${busy ? ' w1337-refresh-icon--busy' : ''}${className ? ` ${className}` : ''}`}
      aria-label={ariaLabel}
      disabled={disabled ?? busy}
      onClick={onClick}
    >
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  );
}
