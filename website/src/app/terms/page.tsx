import type { Metadata } from 'next';
import Link from 'next/link';
import { Kicker } from '@/components/Kicker';
import { TERMS_SUMMARY, TERMS_UPDATED } from '@/content/terms';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: TERMS_SUMMARY,
};

export default function TermsPage() {
  return (
    <div>
      <section className="grid-glow border-b border-border/60">
        <div className="mx-auto max-w-3xl px-5 py-16 md:py-20">
          <Kicker>Terms</Kicker>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Terms of use</h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">{TERMS_SUMMARY}</p>
          <p className="mt-4 text-sm text-muted">Last updated {TERMS_UPDATED}.</p>
        </div>
      </section>

      <article className="prose-docs mx-auto max-w-3xl px-5 py-16 pb-20">
        <h2>1. What 1337 is</h2>
        <p>
          {SITE.name} is client-side software: a Chrome extension and this website. It is a tool for
          creating or importing accounts, connecting to dapps, reviewing requests, and signing or
          rejecting them. It is not a bank, exchange, broker, custodian, insurer, or financial
          advisor. There is no 1337 account and no tracking server that holds your assets or can
          spend them.
        </p>
        <p>
          By installing or using the extension or this site, you agree to these terms and the{' '}
          <Link href="/privacy" className="text-text underline-offset-4 hover:underline">
            privacy policy
          </Link>
          . If you do not agree, do not use the software.
        </p>

        <h2>2. No custody</h2>
        <p>
          1337 is non-custodial. Software keys stay encrypted on your machine. Hardware keys stay on
          Ledger or Trezor. We cannot access, freeze, reverse, or restore your funds. On-chain
          transactions are final. If you lose your seed phrase, private key, password, or device
          backup, nobody at 1337 can recover the wallet.
        </p>

        <h2>3. You are responsible for your funds</h2>
        <p>
          You are solely responsible for safeguarding your seed phrase, private keys, password, and
          hardware devices, and for every transaction and approval you authorize. That includes:
        </p>
        <ul>
          <li>Writing backups offline and keeping them secret</li>
          <li>Checking addresses, amounts, and spender contracts before you confirm</li>
          <li>Deciding which dapps, tokens, RPCs, and swap routes to trust</li>
          <li>Phishing, malware, leaked backups, and unlimited token approvals</li>
          <li>Following the law where you live, including whether you may hold crypto</li>
        </ul>
        <p>
          1337 does not guarantee balances, token value, swap quotes, transaction success, or
          recovery of lost or stolen assets. Confirm-time simulation is a local <code>eth_call</code>{' '}
          (pass, fail, revert, gas). It is not insurance and it cannot show every effect a public
          RPC cannot provide.
        </p>

        <h2>4. Software provided as-is</h2>
        <p>
          The extension, this site, and related materials are provided “as is” and “as available,”
          without warranties of any kind, express or implied, including merchantability, fitness for
          a particular purpose, and non-infringement. Software can contain bugs. Chains can reorg.
          Networks can be congested. We do not warrant that the software is uninterrupted, error-free,
          or secure against every attack.
        </p>

        <h2>5. Crypto and third-party risk</h2>
        <p>
          Cryptographic systems, smart contracts, and token markets are volatile and can fail. You
          represent that you understand those risks. 1337 does not control Ethereum or other
          networks, dapps you connect to, RPCs you choose, LI.FI routes, explorers, Ledger, Trezor
          Connect, or any other third party. We are not liable for their content, downtime, quotes,
          or losses you take by using them.
        </p>
        <p>
          Burner Mode auto-signs ordinary requests on a software account you mark as disposable. That
          is extra risk you choose. Hardware accounts still require confirmation on the device.
          Read the device screen, not only the extension.
        </p>

        <h2>6. Eligibility</h2>
        <p>
          You must be old enough to custody crypto and enter this agreement where you live. You are
          responsible for knowing whether using a self-custody wallet is allowed in your
          jurisdiction. We do not perform KYC and we do not block regions at the software layer.
        </p>

        <h2>7. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, the authors and operators of 1337 are not liable
          for any loss of crypto, keys, profits, data, or other damages (direct, indirect,
          incidental, special, consequential, or punitive) arising from your use of the software,
          inability to use it, unauthorized access to your device or backups, third-party services,
          or any transaction you sign or fail to sign. Some places do not allow certain exclusions;
          in those places our liability is limited to the maximum the law allows (which may be
          zero, because the software is free and non-custodial).
        </p>

        <h2>8. Your indemnity</h2>
        <p>
          You agree to indemnify and hold harmless the authors and operators of 1337 from claims,
          damages, and costs (including reasonable legal fees) arising from your use of the
          software, your violation of these terms, or your violation of applicable law.
        </p>

        <h2>9. Changes</h2>
        <p>
          We may update these terms. The date at the top of this page is the current version.
          Continued use after a change is acceptance of the new terms. The extension remains
          local-first; new network destinations appear in the{' '}
          <Link href="/privacy" className="text-text underline-offset-4 hover:underline">
            privacy policy
          </Link>{' '}
          if we add a feature that calls them.
        </p>

        <h2>10. Contact</h2>
        <p>
          Questions:{' '}
          <a
            href={SITE.githubUrl}
            className="text-text underline-offset-4 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          {' · '}
          <a
            href={SITE.discordUrl}
            className="text-text underline-offset-4 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Discord
          </a>
          {' · '}
          <a
            href={SITE.xUrl}
            className="text-text underline-offset-4 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            X
          </a>
          . These terms are the agreement for using the tool. They are not a promise that funds are
          safe.
        </p>

        <p className="mt-10">
          <Link href="/privacy" className="text-text underline-offset-4 hover:underline">
            Privacy policy
          </Link>
          {' · '}
          <Link href="/security" className="text-text underline-offset-4 hover:underline">
            Security
          </Link>
          {' · '}
          <Link href="/faq" className="text-text underline-offset-4 hover:underline">
            FAQ
          </Link>
        </p>
      </article>
    </div>
  );
}
