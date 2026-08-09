export function VideoSection() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-20">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-deep">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            See the wallet before you install
          </h2>
          <p className="mt-4 text-muted">
            Walkthrough video coming soon. For now, load the unpacked extension from{' '}
            <code>dist/</code> in Chrome Developer mode — or grab the Chrome build when it ships.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-muted">
            <li>• Side panel for dapp + wallet side-by-side</li>
            <li>• Turbo vs Normal signing modes</li>
            <li>• Ledger, Trezor, seed, and private-key accounts</li>
          </ul>
        </div>

        <div className="card-surface relative aspect-video overflow-hidden">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-accent-soft/30 to-transparent">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-accent/40 bg-bg text-accent-deep">
              <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-7 w-7" aria-hidden>
                <path d="M8 5v14l11-7L8 5Z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-muted">Product video — placeholder</p>
            <p className="text-xs text-muted/80">Order / embed your walkthrough here</p>
          </div>
        </div>
      </div>
    </section>
  );
}
