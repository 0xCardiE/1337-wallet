import type { ReactNode } from 'react';
import { CORE_FEATURES } from '@/lib/site';

const ICONS: Record<string, ReactNode> = {
  rpc: (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <path
        d="M4 7h16M4 12h10M4 17h7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="18" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  ),
  send: (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <path
        d="m4 12 16-7-4 7 4 7-16-7Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  ),
  ens: (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <path
        d="M6 18V6l6 4 6-4v12l-6-4-6 4Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  ),
  passport: (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8.5 16c.8-1.6 2-2.5 3.5-2.5s2.7.9 3.5 2.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  ),
  tx: (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <path
        d="M8 6h12M8 12h12M8 18h8M4 6h.01M4 12h.01M4 18h.01"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <path
        d="M12 7v5l3 2M21 12a9 9 0 1 1-3-6.7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  ),
};

export function FeatureGrid() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-20">
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-deep">
          Features
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          The details before you sign
        </h2>
        <p className="mt-4 text-muted">
          Inspired by wallets like{' '}
          <a href="https://rabby.io/" className="text-text underline-offset-4 hover:underline">
            Rabby
          </a>{' '}
          and{' '}
          <a href="https://www.ambire.com/" className="text-text underline-offset-4 hover:underline">
            Ambire
          </a>
          , but tuned for developers who want the details before they sign.
        </p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {CORE_FEATURES.map(feature => (
          <article key={feature.title} className="card-surface p-6 transition hover:border-accent/35">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-deep">
              {ICONS[feature.icon]}
            </div>
            <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
