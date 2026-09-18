import { BrowserChips } from '@/components/BrowserInstall';
import { Colophon } from '@/components/Colophon';
import { HeroDevice } from '@/components/HeroDevice';
import { ChromeDownload } from '@/components/Outbound';

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="hero-bg" aria-hidden>
        <div className="hero-floor">
          <div className="hero-floor-grid" />
        </div>
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        <div>
          <p className="status-line">
            <span className="status-dot" aria-hidden />
            <span>Privacy</span>
            <span aria-hidden>·</span>
            <span>Power</span>
            <span aria-hidden>·</span>
            <span>No server</span>
          </p>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-6xl md:leading-[1.05]">
            An EVM wallet for <span className="text-accent-deep">hackers</span>.
          </h1>
          <p className="mt-6 max-w-xl text-xl font-medium tracking-tight text-text md:text-2xl">
            Privacy and power.
          </p>
          <p className="mt-3 max-w-xl text-lg leading-relaxed text-text">
            Keep all user data where it belongs on the user&apos;s machine.
          </p>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
            Readable confirms, easy RPC switching, approvals, swaps, ENS, and multisend. No
            analytics. No 1337 server. Works with every MetaMask dapp.
          </p>

          <div className="mt-8">
            <ChromeDownload />
            <BrowserChips />
          </div>
        </div>

        <HeroDevice />
      </div>

      <Colophon className="relative" />
    </section>
  );
}
