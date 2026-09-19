import type { Metadata } from 'next';
import Link from 'next/link';
import { FaqList } from '@/components/FaqList';
import { Kicker } from '@/components/Kicker';
import { DiscordJoin, GitHubFollow, XFollow } from '@/components/Outbound';
import { PRODUCT_FAQ } from '@/content/productFaq';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Questions about 1337 Wallet: who it is for, install, dapps, tools, open source on GitHub, private-by-design privacy compared with MetaMask and Rabby, and how the product differs.',
};

export default function FaqPage() {
  return (
    <div>
      <section className="grid-glow border-b border-border/60">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <Kicker>FAQ</Kicker>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
            Questions about the product
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            Install, dapps, tools, networks, and why 1337 is private by design — including how
            vendor collection compares to MetaMask and Rabby. The wallet is{' '}
            <a
              href={SITE.githubUrl}
              className="text-text underline-offset-4 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              open source on GitHub
            </a>
            . Keys, hardware, and “what if I do not trust it?” live on{' '}
            <Link href="/security" className="text-text underline-offset-4 hover:underline">
              Security
            </Link>
            .
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-16 pb-20">
        <FaqList groups={PRODUCT_FAQ} />

        <div className="mt-16 flex flex-wrap gap-4">
          <Link href="/security" className="btn-secondary">
            Security
          </Link>
          <DiscordJoin>Ask on Discord</DiscordJoin>
          <GitHubFollow>Source on GitHub</GitHubFollow>
          <XFollow>Follow on X</XFollow>
        </div>
      </div>
    </div>
  );
}
