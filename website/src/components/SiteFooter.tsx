import Link from 'next/link';
import { NAV_LINKS, SITE } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="border-t border-border/80 bg-bg">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <p className="text-lg font-semibold">{SITE.name}</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{SITE.tagline}</p>
          <p className="mt-4 text-xs text-muted">No analytics. No 1337 server.</p>
        </div>

        <div>
          <p className="text-sm font-medium text-text">Site</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {NAV_LINKS.map(link => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-text">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-medium text-text">Builders</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>
              <Link href="/integrate" className="hover:text-text">
                Integration guide
              </Link>
            </li>
            <li>
              <a href={`mailto:${SITE.contactEmail}`} className="hover:text-text">
                {SITE.contactEmail}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/60 px-5 py-5 text-center text-xs text-muted">
        © {new Date().getFullYear()} {SITE.name}. Self-custody. Inspect before you trust.
      </div>
    </footer>
  );
}
