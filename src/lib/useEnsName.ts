import { useEffect, useState } from 'react';
import { fetchEnsName } from './ens';

/** Cached mainnet ENS reverse lookup for a wallet address. */
export function useEnsName(address: string | undefined): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!address?.trim()) {
      setName(null);
      return;
    }

    let cancelled = false;
    void fetchEnsName(address)
      .then(result => {
        if (!cancelled) setName(result);
      })
      .catch(() => {
        if (!cancelled) setName(null);
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return name;
}
