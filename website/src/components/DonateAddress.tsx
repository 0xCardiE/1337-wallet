'use client';

import { useEffect, useRef, useState } from 'react';
import { SITE } from '@/lib/site';

function CopyIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.2" stroke="currentColor" />
      <path d="M10.5 5.5V3.7A1.2 1.2 0 0 0 9.3 2.5H3.7A1.2 1.2 0 0 0 2.5 3.7v5.6A1.2 1.2 0 0 0 3.7 10.5H5.5" stroke="currentColor" />
    </svg>
  );
}

export function DonateAddress() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    const address = SITE.donationAddress;
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      const field = document.createElement('textarea');
      field.value = address;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.left = '-9999px';
      document.body.appendChild(field);
      field.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(field);
      if (!ok) return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex w-full max-w-xl flex-col items-center gap-2 rounded-[4px] border border-border/80 bg-[#0a0d0b] px-3 py-2.5 transition hover:border-accent/70 hover:bg-accent-soft sm:w-auto sm:flex-row sm:gap-3 sm:text-left"
      aria-label={copied ? 'Donation address copied' : 'Copy donation address'}
    >
      <span className="max-w-full overflow-x-auto font-mono text-[12px] leading-relaxed whitespace-nowrap text-text sm:text-[13px]">
        {SITE.donationAddress}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-accent-deep">
        {copied ? 'Copied' : (
          <>
            <CopyIcon />
            Copy
          </>
        )}
      </span>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </button>
  );
}
