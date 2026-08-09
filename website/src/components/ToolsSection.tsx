import Link from 'next/link';
import { TOOLS } from '@/lib/site';

export function ToolsSection() {
  return (
    <section id="tools" className="border-y border-border/60 bg-bg-elevated/40">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-deep">Tools</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            One wallet, a full workbench
          </h2>
          <p className="mt-4 text-muted">
            Multisend, gas top-ups, approvals, swaps, and ENS — plus room for what you need next.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map(tool => {
            const isPlaceholder = 'placeholder' in tool && tool.placeholder;
            return (
            <article
              key={tool.id}
              className={`card-surface p-6 ${
                isPlaceholder
                  ? 'border-dashed border-accent/35 bg-accent-soft/20'
                  : 'hover:border-accent/35'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold">{tool.title}</h3>
                {isPlaceholder ? (
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/40 bg-bg text-lg font-semibold text-accent-deep"
                    aria-hidden
                  >
                    ?
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{tool.description}</p>
              {isPlaceholder ? (
                <Link
                  href="/#contact"
                  className="mt-4 inline-flex text-sm font-medium text-accent-deep hover:underline"
                >
                  Request a feature →
                </Link>
              ) : null}
            </article>
          );})}
        </div>
      </div>
    </section>
  );
}
