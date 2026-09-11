function Barcode() {
  return (
    <svg className="barcode" viewBox="0 0 88 14" aria-hidden>
      <rect x="0" y="0" width="2" height="14" fill="currentColor" />
      <rect x="4" y="0" width="1" height="14" fill="currentColor" />
      <rect x="7" y="0" width="3" height="14" fill="currentColor" />
      <rect x="12" y="0" width="1" height="14" fill="currentColor" />
      <rect x="15" y="0" width="2" height="14" fill="currentColor" />
      <rect x="19" y="0" width="1" height="14" fill="currentColor" />
      <rect x="22" y="0" width="4" height="14" fill="currentColor" />
      <rect x="28" y="0" width="1" height="14" fill="currentColor" />
      <rect x="31" y="0" width="2" height="14" fill="currentColor" />
      <rect x="35" y="0" width="1" height="14" fill="currentColor" />
      <rect x="38" y="0" width="3" height="14" fill="currentColor" />
      <rect x="43" y="0" width="1" height="14" fill="currentColor" />
      <rect x="46" y="0" width="2" height="14" fill="currentColor" />
      <rect x="50" y="0" width="1" height="14" fill="currentColor" />
      <rect x="53" y="0" width="4" height="14" fill="currentColor" />
      <rect x="59" y="0" width="1" height="14" fill="currentColor" />
      <rect x="62" y="0" width="2" height="14" fill="currentColor" />
      <rect x="66" y="0" width="1" height="14" fill="currentColor" />
      <rect x="69" y="0" width="3" height="14" fill="currentColor" />
      <rect x="74" y="0" width="1" height="14" fill="currentColor" />
      <rect x="77" y="0" width="2" height="14" fill="currentColor" />
      <rect x="81" y="0" width="1" height="14" fill="currentColor" />
      <rect x="84" y="0" width="4" height="14" fill="currentColor" />
    </svg>
  );
}

export function Colophon({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`colophon ${className ?? ''}`}>
      {compact ? null : (
        <div className="colophon-rule">
          <span className="colophon-diamond" />
        </div>
      )}
      <div className="colophon-meta">
        <Barcode />
        <span>1337 wallet · self-custody</span>
      </div>
    </div>
  );
}
