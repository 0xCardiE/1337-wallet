import { TOOLS } from '@/lib/site';

export function ToolsSection() {
  return (
    <section id="tools" className="border-y border-border/60 bg-bg-elevated/40">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-deep">Tools</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Signer tools
          </h2>
          <p className="mt-4 text-muted">
            Signings, approvals, swaps, ENS, multisend, and gas. Things you do in a wallet. Hide
            what you do not use in Settings.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map(tool => (
            <article key={tool.id} className="card-surface p-6 hover:border-accent/35">
              <h3 className="text-lg font-semibold">{tool.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{tool.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
