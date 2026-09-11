'use client';

import Image from 'next/image';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Kicker } from '@/components/Kicker';
import { TerminalFrame, frameTitleFromSrc } from '@/components/TerminalFrame';
import { FEATURE_SHOTS, PRODUCT_FEATURES, type FeatureShot } from '@/lib/site';

function similarPairHeightRatio(shots: readonly FeatureShot[]): number | null {
  if (shots.length !== 2) return null;
  const ratios = shots.map(shot => shot.height / shot.width);
  const shorter = Math.min(...ratios);
  const taller = Math.max(...ratios);
  if (taller / shorter > 1.18) return null;
  return shorter;
}

function featureIndexLabel(index: number): string {
  return String(index + 1).padStart(2, '0');
}

export function ScreenshotGallery() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const open = openIndex !== null;
  const shot = openIndex !== null ? FEATURE_SHOTS[openIndex] : null;

  const indexBySrc = useMemo(() => {
    const map = new Map<string, number>();
    FEATURE_SHOTS.forEach((item, index) => map.set(item.src, index));
    return map;
  }, []);

  const close = useCallback(() => {
    setOpenIndex(null);
  }, []);

  const step = useCallback((delta: number) => {
    setOpenIndex(current => {
      if (current === null) return current;
      return (current + delta + FEATURE_SHOTS.length) % FEATURE_SHOTS.length;
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
      <div className="mt-14 space-y-24">
        {PRODUCT_FEATURES.map((feature, featureIndex) => {
          const multi = feature.shots.length > 1;
          const flip = !multi && featureIndex % 2 === 1;
          const pairRatio = similarPairHeightRatio(feature.shots);

          return (
            <article key={feature.id} id={feature.id} className="scroll-mt-28">
              <div
                className={
                  multi ? 'grid gap-10' : 'grid items-center gap-10 lg:grid-cols-2'
                }
              >
                <div className={`${multi ? 'max-w-3xl' : 'max-w-xl'} ${flip ? 'lg:order-2' : ''}`}>
                  <Kicker index={featureIndexLabel(featureIndex)} rule>
                    {feature.kicker}
                  </Kicker>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
                    {feature.title}
                  </h3>
                  <p className="mt-4 text-base leading-relaxed text-muted">{feature.hook}</p>
                  <p className="mt-4 text-sm leading-relaxed text-accent-deep">
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
                      try it →{' '}
                    </span>
                    {feature.tryIt}
                  </p>
                </div>

                <div
                  className={
                    feature.shots.length >= 3
                      ? 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3'
                      : feature.shots.length === 2
                        ? 'grid gap-5 sm:grid-cols-2'
                        : 'flex justify-center lg:justify-end'
                  }
                >
                  {feature.shots.map(item => (
                    <figure key={item.src} className="min-w-0">
                      <button
                        type="button"
                        className="group relative block w-full cursor-zoom-in text-left"
                        onClick={event => {
                          lastTrigger.current = event.currentTarget;
                          setOpenIndex(indexBySrc.get(item.src) ?? 0);
                        }}
                        aria-label={`Enlarge screenshot: ${item.alt}`}
                      >
                        <TerminalFrame title={frameTitleFromSrc(item.src)} zoomHint>
                          <span className="relative block bg-black">
                            <span
                              className="relative mx-auto block w-full max-w-[420px]"
                              style={
                                pairRatio
                                  ? { aspectRatio: `${1} / ${pairRatio}` }
                                  : undefined
                              }
                            >
                              <Image
                                src={`${item.src}?v=8`}
                                alt={item.alt}
                                width={item.width}
                                height={item.height}
                                unoptimized
                                priority={featureIndex < 2}
                                sizes={
                                  multi
                                    ? '(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw'
                                    : '(min-width: 1024px) 480px, 100vw'
                                }
                                className={
                                  pairRatio
                                    ? 'absolute inset-0 h-full w-full object-cover object-top'
                                    : 'h-auto w-full'
                                }
                              />
                            </span>
                          </span>
                        </TerminalFrame>
                      </button>
                      <figcaption className="mt-3 px-1 text-sm leading-relaxed text-muted">
                        {item.caption}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
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
            <div className="relative max-h-[78vh] w-full max-w-3xl overflow-auto">
              <TerminalFrame title={frameTitleFromSrc(shot.src)}>
                <Image
                  src={`${shot.src}?v=8`}
                  alt={shot.alt}
                  width={shot.width}
                  height={shot.height}
                  unoptimized
                  sizes="(min-width: 768px) 768px, 94vw"
                  className="mx-auto h-auto w-full object-contain"
                  priority
                />
              </TerminalFrame>
            </div>
            <p className="mt-3 max-w-xl text-center text-sm text-zinc-300">{shot.caption}</p>
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
