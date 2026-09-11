import { ScreenshotGallery } from '@/components/ScreenshotGallery';

export function VideoSection() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-20">
      <div className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-deep">
          Features
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          The signer, in the actual UI
        </h2>
        <p className="mt-4 text-muted">
          Confirm, RPC, revoke, swap, batch, top up gas. These are live captures — click any of
          them to enlarge. Install the extension and try the same screens on a dapp you already
          use.
        </p>
      </div>

      <ScreenshotGallery />
    </section>
  );
}
