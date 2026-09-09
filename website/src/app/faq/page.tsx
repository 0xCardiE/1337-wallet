import type { Metadata } from 'next';
import Link from 'next/link';
import { FaqList } from '@/components/FaqList';
import { DiscordJoin } from '@/components/Outbound';
import { PRODUCT_FAQ } from '@/content/productFaq';

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Questions about 1337 Wallet: who it is for, install, dapps, tools, privacy, and how it differs from MetaMask and Rabby.',
};

export default function FaqPage() {
  return (
    <div>
      <section className="grid-glow border-b border-border/60">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-deep">FAQ</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
            Questions about the product
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            Install, dapps, tools, networks, and privacy. Keys, hardware, and “what if I do not
            trust it?” live on the{' '}
            <Link href="/security" className="text-text underline-offset-4 hover:underline">
              security FAQ
            </Link>{' '}
            — that is the comparison with MetaMask and Rabby.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-16 pb-20">
        <FaqList groups={PRODUCT_FAQ} />

        <div className="mt-16 flex flex-wrap gap-4">
          <Link href="/security" className="btn-secondary">
            Security FAQ
          </Link>
          <DiscordJoin>Ask on Discord</DiscordJoin>
        </div>
      </div>
    </div>
  );
}
