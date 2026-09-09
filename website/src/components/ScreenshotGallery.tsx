'use client';

import Image from 'next/image';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { STORE_SCREENSHOTS } from '@/lib/site';

const SHOT_CACHE = '?v=4';

export function ScreenshotGallery() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const open = openIndex !== null;
  const shot = openIndex !== null ? STORE_SCREENSHOTS[openIndex] : null;

  const close = useCallback(() => {
    setOpenIndex(null);
  }, []);

  const step = useCallback((delta: number) => {
    setOpenIndex(current => {
      if (current === null) return current;
      return (current + delta + STORE_SCREENSHOTS.length) % STORE_SCREENSHOTS.length;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      lastTrigger.current?.focus();
    };
  }, [open, close, step]);

  return (
    <>
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {STORE_SCREENSHOTS.map((item, index) => (
          <figure key={item.src} className="card-surface overflow-hidden">
            <button
              type="button"
              className="group relative block w-full cursor-zoom-in text-left"
              onClick={event => {
                lastTrigger.current = event.currentTarget;
                setOpenIndex(index);
              }}
              aria-label={`Enlarge screenshot: ${item.alt}`}
            >
              <span className="relative block aspect-[16/10] w-full bg-black">
                <Image
                  src={`${item.src}${SHOT_CACHE}`}
                  alt={item.alt}
                  fill
                  unoptimized
                  sizes="(min-width: 1024px) 560px, (min-width: 640px) 50vw, 100vw"
                  className="object-contain object-center"
                />
              </span>
              <span className="pointer-events-none absolute right-3 top-3 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-xs text-white opacity-90 backdrop-blur-sm group-hover:opacity-100">
                Click to enlarge
              </span>
            </button>
            <figcaption className="px-4 py-3 text-sm text-muted">{item.caption}</figcaption>
          </figure>
        ))}
      </div>

      {shot ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm md:p-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={close}
        >
          <div
            className="relative flex max-h-full w-full flex-col items-center"
            onClick={event => event.stopPropagation()}
          >
            <p id={titleId} className="sr-only">
              {shot.alt}
            </p>
            <div className="relative aspect-[16/10] w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-black shadow-2xl">
              <Image
                src={`${shot.src}${SHOT_CACHE}`}
                alt={shot.alt}
                fill
                unoptimized
                sizes="(min-width: 768px) 1024px, 94vw"
                className="object-contain object-center"
                priority
              />
            </div>
            <p className="mt-3 max-w-md text-center text-sm text-zinc-300">{shot.caption}</p>
            <div className="mt-3 flex items-center gap-3">
              <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={() => step(-1)}>
                Previous
              </button>
              <button ref={closeRef} type="button" className="btn-primary px-4 py-2 text-sm" onClick={close}>
                Close
              </button>
              <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={() => step(1)}>
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
