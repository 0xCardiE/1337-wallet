import { ScreenshotGallery } from '@/components/ScreenshotGallery';

export function VideoSection() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-20">
      <div className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-deep">
          How it works
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          See the wallet before you install
        </h2>
        <p className="mt-4 text-muted">
          Side panel or popup, readable confirms, easy RPC switching, and signer tools. Each card
          is the production UI on a 1337 billboard. Click any of them to open a larger view.
        </p>
      </div>

      <ScreenshotGallery />
    </section>
  );
}
