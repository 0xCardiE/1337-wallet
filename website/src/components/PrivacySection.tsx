import { Kicker } from '@/components/Kicker';
import { SITE } from '@/lib/site';

export function PrivacySection() {
  return (
    <section id="privacy" className="border-y border-border/60">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <div className="card-surface grid gap-8 p-8 md:grid-cols-[1.2fr_1fr] md:p-10">
          <div>
            <Kicker>Privacy</Kicker>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl md:leading-[1.1]">
              Private by design.
              <br />
              <span className="text-accent-deep">Not by policy.</span>
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-text">
              Keep all user data where it belongs on the user&apos;s machine.
            </p>
            <p className="mt-4 max-w-xl text-muted">
              Privacy is only possible when there is no central entity with the power to violate it.
              Other wallets keep that power — analytics, accounts, a server that could watch you.
              1337 has none of those, and never will. Open source. No analytics. No 1337 servers
              collecting anything.
            </p>
            <p className="mt-4 max-w-xl text-sm text-muted">
              <a href="/faq#privacy" className="text-text underline-offset-4 hover:underline">
                FAQ
              </a>
              {' · '}
              <a href="/privacy" className="text-text underline-offset-4 hover:underline">
                Privacy policy
              </a>
              {' · '}
              <a href="/terms" className="text-text underline-offset-4 hover:underline">
                Terms
              </a>
              {' · '}
              <a href="/security" className="text-text underline-offset-4 hover:underline">
                Security
              </a>
              .
            </p>
          </div>
          <ul className="space-y-3 text-sm text-muted">
            <li className="rounded-[4px] border border-border/80 px-4 py-3">
              All user data stays on the user&apos;s machine
            </li>
            <li className="rounded-[4px] border border-border/80 px-4 py-3">
              No analytics, telemetry, or tracking — ever
            </li>
            <li className="rounded-[4px] border border-border/80 px-4 py-3">
              No 1337 server that could receive your data
            </li>
            <li className="rounded-[4px] border border-border/80 px-4 py-3">
              No central account that could watch you
            </li>
            <li className="rounded-[4px] border border-border/80 px-4 py-3">
              Open source.{' '}
              <a
                href={SITE.githubUrl}
                className="text-text underline-offset-4 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Read the code on GitHub
              </a>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
