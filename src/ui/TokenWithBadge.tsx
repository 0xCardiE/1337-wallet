import { LiFiIcon } from './LiFiIcon';

/** Token logo (circle) + small chain badge bottom-right, Jumper-style. */
export function TokenWithBadge({
  tokenLogoURI,
  chainLogoURI,
  size = 40,
  symbol,
  subline,
  empty = false,
}: {
  tokenLogoURI?: string | null;
  chainLogoURI?: string | null;
  size?: number;
  symbol: string;
  subline?: string;
  /** Placeholder when no token picked */
  empty?: boolean;
}) {
  const badgeSize = Math.max(15, Math.round(size * 0.34));
  const sym = empty ? '—' : symbol;

  return (
    <div className={`w1337-tw ${empty ? 'w1337-tw--empty' : ''}`}>
      <div className="w1337-tw-inner">
        <LiFiIcon
          logoURI={empty ? null : tokenLogoURI}
          label={sym}
          size={size}
          rounded
        />
        <div className="w1337-tw-badge" aria-hidden>
          <LiFiIcon logoURI={chainLogoURI} label="" size={badgeSize} rounded />
        </div>
      </div>
      <div className="w1337-tw-text">
        <span className="w1337-tw-symbol">{empty ? 'Token' : sym}</span>
        <span className="w1337-tw-sub">{empty ? 'Tap to choose' : subline ?? ' '}</span>
      </div>
    </div>
  );
}
