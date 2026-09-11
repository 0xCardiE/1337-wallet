import { BrowserGrid } from '@/components/BrowserInstall';
import { Kicker } from '@/components/Kicker';

export function InstallSection() {
  return (
    <section id="download" className="scroll-mt-28 border-t border-border/60">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <Kicker>Install</Kicker>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Install on</h2>
        <p className="mt-4 max-w-2xl text-muted">
          Chrome, Brave, Opera, and Arc. Same Chrome Web Store listing — Chromium browsers that run
          the extension.
        </p>
        <BrowserGrid />
      </div>
    </section>
  );
}
