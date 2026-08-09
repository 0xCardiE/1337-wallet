import { FAQ, SITE } from '@/lib/site';

export function ContactSection() {
  return (
    <section id="contact" className="mx-auto max-w-6xl px-5 py-20">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-deep">
            Contact
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Questions, integrations, feature requests
          </h2>
          <p className="mt-4 text-muted">
            Builders and AIs: start with the{' '}
            <a href="/integrate" className="text-text underline-offset-4 hover:underline">
              integration guide
            </a>
            . Humans: email us or skim the FAQ.
          </p>
          <a
            href={`mailto:${SITE.contactEmail}?subject=1337%20Wallet%20question`}
            className="btn-primary mt-8"
          >
            Email {SITE.contactEmail}
          </a>
        </div>

        <div className="space-y-4">
          {FAQ.map(item => (
            <details key={item.q} className="card-surface group p-5">
              <summary className="cursor-pointer list-none font-medium marker:content-none">
                <span className="flex items-center justify-between gap-4">
                  {item.q}
                  <span className="text-accent-deep transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
