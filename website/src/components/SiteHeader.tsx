import Image from 'next/image';
import Link from 'next/link';
import { ChromeDownload } from '@/components/Outbound';
import { NAV_LINKS, SITE } from '@/lib/site';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo.svg" alt="" width={36} height={36} className="rounded-lg" />
          <span className="text-lg font-semibold tracking-tight">{SITE.shortName}</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-text"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <ChromeDownload className="btn-primary text-sm" />
      </div>
    </header>
  );
}
