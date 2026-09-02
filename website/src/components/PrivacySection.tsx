export function PrivacySection() {
  return (
    <section className="border-y border-border/60">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <div className="card-surface grid gap-8 p-8 md:grid-cols-[1.2fr_1fr] md:p-10">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-deep">
              Privacy
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">No analytics. No 1337 server.</h2>
            <p className="mt-4 max-w-xl text-muted">
              Vault, settings, and session data stay in Chrome extension storage on your machine.
              Network calls happen only when you use RPCs, swaps, explorer history, or hardware SDKs.{' '}
              <a href="/security" className="text-text underline-offset-4 hover:underline">
                Security FAQ
              </a>
              .
            </p>
          </div>
          <ul className="space-y-3 text-sm text-muted">
            <li className="rounded-xl border border-border/80 px-4 py-3">No usage telemetry</li>
            <li className="rounded-xl border border-border/80 px-4 py-3">No central account system</li>
            <li className="rounded-xl border border-border/80 px-4 py-3">
              Your explorer API key, your history
            </li>
            <li className="rounded-xl border border-border/80 px-4 py-3">
              Open build — inspect before you trust
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
