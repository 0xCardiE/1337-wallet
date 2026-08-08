import { useEffect, useState } from 'react';
import {
  fetchOnchainPassportScore,
  formatPassportScoreLabel,
  type OnchainPassportLookup,
  type OnchainPassportScore,
} from '../lib/humanPassport';

export function PassportScoreBadge({
  address,
  titlePrefix = 'Human Passport (onchain)',
}: {
  address: string;
  titlePrefix?: string;
}) {
  const [lookup, setLookup] = useState<OnchainPassportLookup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void fetchOnchainPassportScore(address)
      .then(result => {
        if (cancelled) return;
        setLookup(result);
      })
      .catch(() => {
        if (cancelled) return;
        setLookup({ kind: 'none' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  if (loading || !lookup || lookup.kind === 'none') {
    return null;
  }

  const score: OnchainPassportScore = lookup.score;
  const label = formatPassportScoreLabel(score);
  const title = [
    titlePrefix,
    score.isHuman ? 'Verified human' : 'Below humanity threshold',
    `Score ${score.score.toFixed(1)} (threshold ${score.threshold})`,
    `Minted on ${score.chainName}`,
  ].join(' · ');

  return (
    <span
      className={`bfox-passport-badge${
        score.isHuman ? ' bfox-passport-badge--human' : ' bfox-passport-badge--sybil'
      }`}
      title={title}
    >
      {label}
    </span>
  );
}
