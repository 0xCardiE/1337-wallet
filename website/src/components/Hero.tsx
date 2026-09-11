import Image from 'next/image';
import { Colophon } from '@/components/Colophon';
import { ChromeDownload } from '@/components/Outbound';
import { TerminalFrame } from '@/components/TerminalFrame';
import { PRODUCT_FEATURES, SITE } from '@/lib/site';

const HERO_SHOT = PRODUCT_FEATURES[0].shots[0];

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="hero-bg" aria-hidden>
        <div className="hero-floor">
          <div className="hero-floor-grid" />
        </div>
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <p className="status-line">
            <span className="status-dot" aria-hidden />
            <span>Online</span>
            <span aria-hidden>·</span>
            <span>No server</span>
            <span aria-hidden>·</span>
            <span>Local vault</span>
          </p>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-6xl md:leading-[1.05]">
            An EVM wallet for <span className="text-accent-deep">hackers</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{SITE.description}</p>

          <div id="download" className="mt-8 flex flex-wrap items-center gap-3 scroll-mt-24">
            <ChromeDownload />
            <a href="#features" className="btn-secondary">
              See the features
            </a>
          </div>
        </div>

        <div className="hero-product mx-auto w-full max-w-[28rem] lg:mx-0 lg:max-w-none">
          <a href="#confirm" className="block" aria-label={HERO_SHOT.alt}>
            <TerminalFrame title="confirm.sheet">
              <Image
                src={`${HERO_SHOT.src}?v=5`}
                alt=""
                width={HERO_SHOT.width}
                height={HERO_SHOT.height}
                unoptimized
                priority
                sizes="(min-width: 1024px) 480px, 90vw"
                className="h-auto w-full"
              />
            </TerminalFrame>
          </a>
        </div>
      </div>

      <Colophon className="relative" />
    </section>
  );
}
