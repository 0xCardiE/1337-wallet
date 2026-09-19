import { Kicker } from '@/components/Kicker';
import { DiscordJoin, GitHubFollow, XFollow } from '@/components/Outbound';
import { SITE } from '@/lib/site';

export function ContactSection() {
  return (
    <section id="contact" className="mx-auto max-w-6xl px-5 py-20">
      <div className="max-w-2xl">
        <Kicker>Contact</Kicker>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Questions, integrations, feature requests
        </h2>
        <p className="mt-4 text-muted">
          1337 is open source.{' '}
          <a
            href={SITE.githubUrl}
            className="text-text underline-offset-4 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read the code on GitHub
          </a>
          . Builders start with the{' '}
          <a href="/integrate" className="text-text underline-offset-4 hover:underline">
            integration guide
          </a>
          . Product questions live on the{' '}
          <a href="/faq" className="text-text underline-offset-4 hover:underline">
            FAQ
          </a>
          , including a privacy comparison with MetaMask and Rabby. Keys, hardware, and custody
          comparisons are on{' '}
          <a href="/security" className="text-text underline-offset-4 hover:underline">
            Security
          </a>
          .
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <DiscordJoin className="btn-primary">Join Discord</DiscordJoin>
          <GitHubFollow>GitHub</GitHubFollow>
          <XFollow>Follow on X</XFollow>
        </div>
      </div>
    </section>
  );
}
