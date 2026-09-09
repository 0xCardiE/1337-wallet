import type { Metadata } from 'next';
import Link from 'next/link';
import {
  PRIVACY_NETWORK,
  PRIVACY_NEVER,
  PRIVACY_STORED,
  PRIVACY_SUMMARY,
  PRIVACY_UPDATED,
} from '@/content/privacy';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: PRIVACY_SUMMARY,
};

export default function PrivacyPage() {
  return (
    <div>
      <section className="grid-glow border-b border-border/60">
        <div className="mx-auto max-w-3xl px-5 py-16 md:py-20">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-deep">
            Privacy
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Privacy policy</h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">{PRIVACY_SUMMARY}</p>
          <p className="mt-4 text-sm text-muted">Last updated {PRIVACY_UPDATED}.</p>
        </div>
      </section>

      <article className="prose-docs mx-auto max-w-3xl px-5 py-16 pb-20">
        <h2>Who we are</h2>
        <p>
          {SITE.name} is a self-custody Chrome extension. This policy describes what the extension
          stores on your device and when it talks to the network. There is no 1337 account, no
          analytics SDK, and no tracking server that receives your vault. Responsibility for keys
          and funds is in the{' '}
          <Link href="/terms" className="text-text underline-offset-4 hover:underline">
            terms of use
          </Link>
          .
        </p>
        <p>
          Contact:{' '}
          <a
            href={SITE.discordUrl}
            className="text-text underline-offset-4 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Discord
          </a>
          .
        </p>

        <h2>What stays on your machine</h2>
        <p>The extension uses Chrome storage on this browser profile:</p>
        <ul>
          {PRIVACY_STORED.map(line => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p>
          Software keys are encrypted with your password before they are written to disk. Hardware
          accounts store address and derivation path only — private keys stay on Ledger or Trezor.
        </p>

        <h2>When the extension uses the network</h2>
        <p>
          1337 does not phone home. Requests leave your machine only when you use a feature that
          needs a third party:
        </p>
        <ul>
          {PRIVACY_NETWORK.map(line => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p>
          Those providers see whatever that request contains (for example an address on an RPC
          call, or a swap quote from LI.FI). We do not operate those services and we do not receive
          a copy.
        </p>

        <h2>What we never collect</h2>
        <ul>
          {PRIVACY_NEVER.map(line => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <h2>Dapp connection</h2>
        <p>
          Connecting a site shares your selected account address with that origin through the
          standard Ethereum provider (EIP-1193 / EIP-6963). You can disconnect per site in
          Settings. The extension injects a provider so dapps can request signatures; it does not
          sell browsing history.
        </p>

        <h2>Children</h2>
        <p>
          {SITE.name} is not directed at children. Do not use it if you are not old enough to
          custody crypto in your jurisdiction.
        </p>

        <h2>Changes</h2>
        <p>
          If this policy changes, we will update the date on this page. The extension remains
          local-first: new network destinations appear here if we add a feature that calls them.
        </p>

        <p className="mt-10">
          <Link href="/terms" className="text-text underline-offset-4 hover:underline">
            Terms of use
          </Link>
          {' · '}
          <Link href="/security" className="text-text underline-offset-4 hover:underline">
            Security FAQ
          </Link>
          {' · '}
          <Link href="/faq" className="text-text underline-offset-4 hover:underline">
            Product FAQ
          </Link>
        </p>
      </article>
    </div>
  );
}
