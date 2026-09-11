import Link from 'next/link';
import { BuiltOnEthereumBadge } from '@/components/BuiltOnEthereumBadge';
import { FOOTER_EXTRA_LINKS, SITE } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="border-t border-border/80 bg-bg">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2 text-lg font-semibold">
            <img
              src="/1337-skull.svg"
              alt=""
              width={22}
              height={22}
              className="size-[22px] [image-rendering:pixelated]"
              draggable={false}
            />
            {SITE.name}
          </p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{SITE.tagline}</p>
          <p className="mt-4 text-xs text-muted">No analytics. No tracking server.</p>
        </div>

        <div>
          <p className="text-sm font-medium text-text">Site</p>
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
          <p className="text-sm font-medium text-text">Trust</p>
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
          <p className="text-sm font-medium text-text">Builders</p>
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
          </ul>
        </div>
      </div>

      <div className="border-t border-border/60 px-5 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5">
          <BuiltOnEthereumBadge />
          <p className="text-center text-xs text-muted">
            © {new Date().getFullYear()} {SITE.name}. Self-custody tool. You hold the keys. We do
            not guarantee funds.
          </p>
        </div>
      </div>
    </footer>
  );
}
