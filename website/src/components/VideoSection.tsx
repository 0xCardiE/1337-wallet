import { Kicker } from '@/components/Kicker';
import { ScreenshotGallery } from '@/components/ScreenshotGallery';

export function VideoSection() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-20">
      <div className="max-w-3xl">
        <Kicker>Features</Kicker>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          What you get
        </h2>
        <p className="mt-4 text-muted">
          Confirm sheet, RPC switching, ENS, Human Passport, and the chain dropdown order. Click a
          screenshot to enlarge, then install and try the same screens.
        </p>
      </div>

      <ScreenshotGallery />
    </section>
  );
}
