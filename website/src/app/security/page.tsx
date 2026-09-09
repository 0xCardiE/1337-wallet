import type { Metadata } from 'next';
import Link from 'next/link';
import { FaqList } from '@/components/FaqList';
import { DiscordJoin } from '@/components/Outbound';
import { SECURITY_COMPARISON, SECURITY_FAQ } from '@/content/securityFaq';

export const metadata: Metadata = {
  title: 'Security',
  description:
    'How 1337 Wallet holds keys compared with MetaMask and Rabby. Hardware, burner accounts, confirmations, and what to do if you do not trust a new extension yet.',
};

const TOC = [
  { href: '#trust', label: 'If you do not trust it yet' },
  { href: '#compare', label: 'MetaMask & Rabby' },
  { href: '#keys', label: 'Where keys live' },
  { href: '#hardware', label: 'Hardware wallets' },
  { href: '#signing', label: 'Before you sign' },
  { href: '#build', label: 'How it is built' },
  { href: '#practice', label: 'Keep risk lower' },
] as const;

export default function SecurityPage() {
  return (
    <div>
      <section className="grid-glow border-b border-border/60">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-deep">
            Security
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
            Same custody class as MetaMask and Rabby
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            1337 is a self-custody Chrome extension. Software keys stay encrypted on your machine.
            Hardware keys never leave Ledger or Trezor. There is no tracking server that could spend.
            If you do not trust a new wallet, use a burner for small amounts and hardware for the
            rest — the same split careful people already use in MetaMask and Rabby.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {TOC.map(item => (
              <a key={item.href} href={item.href} className="btn-secondary px-4 py-2 text-sm">
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">Side by side</h2>
        <p className="mt-2 max-w-3xl text-muted">
          The scary question is usually “is this a different, weaker model?” It is not. Workflow
          and privacy differ. Who can move funds does not.
        </p>

        <div className="mt-8 overflow-x-auto rounded-2xl border border-border/80">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="bg-bg-elevated text-text">
              <tr>
                <th className="px-4 py-3 font-medium">Topic</th>
                <th className="px-4 py-3 font-medium">MetaMask</th>
                <th className="px-4 py-3 font-medium">Rabby</th>
                <th className="px-4 py-3 font-medium">1337</th>
              </tr>
            </thead>
            <tbody>
              {SECURITY_COMPARISON.map(row => (
                <tr key={row.topic} className="border-t border-border/70">
                  <th className="px-4 py-3 align-top font-medium text-text">{row.topic}</th>
                  <td className="px-4 py-3 align-top text-muted">{row.metamask}</td>
                  <td className="px-4 py-3 align-top text-muted">{row.rabby}</td>
                  <td className="px-4 py-3 align-top text-muted">{row.us}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 pb-20">
        <FaqList groups={SECURITY_FAQ} />

        <div className="mt-16 flex flex-wrap gap-4">
          <Link href="/faq" className="btn-secondary">
            Product FAQ
          </Link>
          <DiscordJoin>Ask on Discord</DiscordJoin>
        </div>
      </div>
    </div>
  );
}
