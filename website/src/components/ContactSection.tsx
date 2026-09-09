import { DiscordJoin } from '@/components/Outbound';

export function ContactSection() {
  return (
    <section id="contact" className="mx-auto max-w-6xl px-5 py-20">
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-deep">
          Contact
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Questions, integrations, feature requests
        </h2>
        <p className="mt-4 text-muted">
          Builders start with the{' '}
          <a href="/integrate" className="text-text underline-offset-4 hover:underline">
            integration guide
          </a>
          . Product questions live on the{' '}
          <a href="/faq" className="text-text underline-offset-4 hover:underline">
            FAQ
          </a>
          . Keys, hardware, and how we compare to MetaMask and Rabby are on{' '}
          <a href="/security" className="text-text underline-offset-4 hover:underline">
            Security
          </a>
          .
        </p>
        <DiscordJoin className="btn-primary mt-8">Join Discord</DiscordJoin>
      </div>
    </section>
  );
}
