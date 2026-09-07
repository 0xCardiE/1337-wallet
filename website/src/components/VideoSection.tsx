import Image from 'next/image';
import { STORE_SCREENSHOTS } from '@/lib/site';

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
          Side panel or popup, readable confirms, your RPCs, and signer tools. These shots are the
          production UI — the same images on the Chrome Web Store listing.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STORE_SCREENSHOTS.map((shot, i) => (
          <figure
            key={shot.src}
            className={`card-surface overflow-hidden ${i === 2 ? 'sm:col-span-2 lg:col-span-1' : ''}`}
          >
            <Image
              src={shot.src}
              alt={shot.alt}
              width={1280}
              height={800}
              className="h-auto w-full"
            />
            <figcaption className="px-4 py-3 text-sm text-muted">{shot.caption}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
