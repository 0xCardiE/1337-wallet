import { useEffect, useMemo, useState } from 'react';

/** Try https before http (common CDNs); fall back to original if load fails. */
function logoSrcAttempts(uri: string): string[] {
  const out: string[] = [];
  try {
    const u = new URL(uri);
    out.push(uri);
    if (u.protocol === 'http:') {
      const u2 = new URL(uri);
      u2.protocol = 'https:';
      const s = u2.toString();
      if (s !== uri) out.push(s);
    }
  } catch {
    out.push(uri);
  }
  return [...new Set(out)];
}

/**
 * Displays a token or chain graphic from LiFi metadata (`logoURI`).
 * Broken or blocked URLs disappear — fallback shows the asset letter (never a fake PNG).
 */
export function LiFiIcon({
  logoURI,
  label,
  size = 32,
  rounded = false,
}: {
  logoURI?: string | null;
  label?: string;
  size?: number;
  /** True for circular chain marks */
  rounded?: boolean;
}) {
  const attempts = useMemo(() => (logoURI ? logoSrcAttempts(logoURI) : []), [logoURI]);
  const [attemptIdx, setAttemptIdx] = useState(0);
  const [ok, setOk] = useState(!!logoURI && attempts.length > 0);
  const letter = (label?.trim()?.[0] ?? '?').toUpperCase();

  useEffect(() => {
    setAttemptIdx(0);
    setOk(!!logoURI && attempts.length > 0);
  }, [logoURI, attempts]);

  const src = attempts[attemptIdx] ?? '';

  return (
    <span
      className={`w1337-li-icon ${rounded ? 'w1337-li-icon--round' : ''}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        flexShrink: 0,
      }}
      aria-hidden
    >
      {logoURI && ok && src ? (
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => {
            if (attemptIdx + 1 < attempts.length) {
              setAttemptIdx(i => i + 1);
            } else {
              setOk(false);
            }
          }}
          className="w1337-li-icon-img"
        />
      ) : (
        <span className="w1337-li-icon-fallback" title={label}>
          {letter}
        </span>
      )}
    </span>
  );
}
