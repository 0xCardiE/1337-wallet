import Link from 'next/link';
import { ChromeDownload } from '@/components/Outbound';
import { NAV_LINKS, SITE } from '@/lib/site';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4">
        <Link href="/" className="flex items-center gap-2">
          <img
            src="/1337-skull.svg"
            alt=""
            width={28}
            height={28}
            className="size-7 [image-rendering:pixelated]"
            draggable={false}
          />
          <span className="text-[17px] font-extrabold tracking-[0.08em] text-accent uppercase">
            {SITE.shortName}
          </span>
        </Link>

        <nav className="order-3 flex w-full items-center gap-5 text-sm text-muted md:order-none md:w-auto md:gap-6">
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
