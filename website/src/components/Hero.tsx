import Link from 'next/link';
import { ChromeDownload } from '@/components/Outbound';
import { SITE } from '@/lib/site';

export function Hero() {
  return (
    <section className="grid-glow relative overflow-hidden border-b border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-20 md:py-28">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-medium text-accent-deep">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          For developers and hackers
        </div>

        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl md:leading-[1.05]">
            An EVM wallet for <span className="text-accent-deep">hackers</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">{SITE.description}</p>
        </div>

        <div id="download" className="flex flex-wrap items-center gap-4 scroll-mt-24">
          <ChromeDownload />
          <Link href="/integrate" className="btn-secondary">
            Integrate
          </Link>
          <Link href="/security" className="text-sm text-muted underline-offset-4 hover:text-text hover:underline">
            Security
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {['Easy RPC switching', 'Full decode on every confirm', 'No analytics, no tracking'].map(
            item => (
              <div key={item} className="card-surface px-4 py-3 text-sm text-muted">
                {item}
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
