import type { Metadata } from 'next';
import Link from 'next/link';
import { FaqList } from '@/components/FaqList';
import { Kicker } from '@/components/Kicker';
import { DiscordJoin, GitHubFollow, XFollow } from '@/components/Outbound';
import { WalletComparisonTable } from '@/components/WalletComparisonTable';
import { SECURITY_COMPARISON, SECURITY_FAQ } from '@/content/securityFaq';

export const metadata: Metadata = {
  title: 'Security',
  description:
    'How 1337 Wallet holds keys compared with MetaMask and Rabby. Hardware, burner accounts, confirmations, and what to do if you do not trust a new extension yet.',
};

export default function SecurityPage() {
  return (
    <div>
      <section className="grid-glow border-b border-border/60">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <Kicker>Security</Kicker>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
            Same custody class as MetaMask and Rabby
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            1337 is a self-custody Chrome extension. Software keys stay encrypted on your machine.
            Hardware keys never leave Ledger or Trezor. There is no tracking server that could spend.
            If you do not trust a new wallet, use a burner for small amounts and hardware for the
            rest. Same split careful people already use in MetaMask and Rabby.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">Side by side</h2>
        <p className="mt-2 max-w-3xl text-muted">
          Workflow and privacy differ. Who can move funds does not.
        </p>

        <div className="mt-8">
          <WalletComparisonTable
            rows={SECURITY_COMPARISON}
            caption="Custody and signing compared with MetaMask and Rabby"
          />
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 pb-20">
        <FaqList groups={SECURITY_FAQ} />

        <div className="mt-16 flex flex-wrap gap-4">
          <Link href="/faq" className="btn-secondary">
            FAQ
          </Link>
          <DiscordJoin>Ask on Discord</DiscordJoin>
          <GitHubFollow>Source on GitHub</GitHubFollow>
          <XFollow>Follow on X</XFollow>
        </div>
      </div>
    </div>
  );
}
