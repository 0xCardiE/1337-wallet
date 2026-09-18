import Link from 'next/link';
import { BrandLockup } from '@/components/BrandLockup';
import { BuiltOnEthereumBadge } from '@/components/BuiltOnEthereumBadge';
import { Colophon } from '@/components/Colophon';
import { DonateAddress } from '@/components/DonateAddress';
import { FOOTER_EXTRA_LINKS, SITE } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="border-t border-border/80 bg-bg">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2">
            <BrandLockup size="sm" />
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              Wallet
            </span>
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">{SITE.tagline}</p>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            Privacy and power. Data stays on the user&apos;s machine.
          </p>
        </div>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text">Site</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {FOOTER_EXTRA_LINKS.map(link => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-text">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text">Trust</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>
              <Link href="/terms" className="hover:text-text">
                Terms of use
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-text">
                Privacy policy
              </Link>
            </li>
            <li>
              <Link href="/security#hardware" className="hover:text-text">
                Hardware wallets
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text">Builders</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>
              <Link href="/rpc" className="hover:text-text">
                RPC methods
              </Link>
            </li>
            <li>
              <a
                href={SITE.discordUrl}
                className="hover:text-text"
                target="_blank"
                rel="noopener noreferrer"
              >
                Discord
              </a>
            </li>
            <li>
              <a
                href={SITE.xUrl}
                className="hover:text-text"
                target="_blank"
                rel="noopener noreferrer"
              >
                X
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/60 px-5 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-8">
          <div id="donate" className="flex w-full scroll-mt-32 flex-col items-center gap-3 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent-deep">
              Self-funded
            </p>
            <p className="max-w-md text-sm leading-relaxed text-muted">
              1337 is self-funded. Donations in tokens and NFTs are welcome.
            </p>
            <DonateAddress />
          </div>
          <BuiltOnEthereumBadge />
          <Colophon compact />
          <p className="text-center text-xs text-muted">
            © {new Date().getFullYear()} {SITE.name}. Self-custody tool. You hold the keys. We do
            not guarantee funds.
          </p>
        </div>
      </div>
    </footer>
  );
}
