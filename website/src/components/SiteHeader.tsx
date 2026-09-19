import Link from 'next/link';
import { BrandLockup } from '@/components/BrandLockup';
import {
  ChromeDownload,
  DiscordMark,
  GitHubMark,
  SocialIconLink,
  XMark,
} from '@/components/Outbound';
import { NAV_LINKS, SITE } from '@/lib/site';

export function SiteHeader() {
  return (
    <header className="site-header sticky top-0 z-50">
      <div className="site-header__accent" />
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-5 py-3 md:grid-cols-[auto_1fr_auto]">
        <Link href="/" className="justify-self-start" aria-label="1337">
          <BrandLockup />
        </Link>

        <nav className="col-span-2 flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted md:col-span-1 md:justify-center">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-accent-deep"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="col-start-2 row-start-1 flex items-center gap-1 md:col-start-auto md:row-start-auto">
          <SocialIconLink href={SITE.githubUrl} label="Source on GitHub">
            <GitHubMark />
          </SocialIconLink>
          <SocialIconLink href={SITE.discordUrl} label="Join Discord">
            <DiscordMark className="h-4 w-[1.3rem] shrink-0" />
          </SocialIconLink>
          <SocialIconLink href={SITE.xUrl} label="Follow on X">
            <XMark />
          </SocialIconLink>
          <ChromeDownload className="btn-primary px-3 py-2 text-sm" />
        </div>
      </div>
    </header>
  );
}
