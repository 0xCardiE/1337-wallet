import { Kicker } from '@/components/Kicker';
import { ScreenshotGallery } from '@/components/ScreenshotGallery';

const PITCHES = [
  {
    href: '#confirm',
    index: '01',
    title: 'Confirm',
    body: 'Human summary, local eth_call, danger flags. See pass / fail / revert / gas before you spend.',
  },
  {
    href: '#networks',
    index: '02',
    title: 'RPC',
    body: 'Your endpoint, per chain. Switch when one is dead. Doctor probes chainId. We do not run an RPC.',
  },
  {
    href: '#accounts',
    index: '03',
    title: 'Hardware',
    body: 'Ledger, Trezor, seed, imported keys. Same sheet. The device still has to say yes.',
  },
  {
    href: '#privacy',
    index: '04',
    title: 'Local',
    body: 'No analytics. No 1337 server. Encrypted vault in Chrome storage on this machine.',
  },
] as const;

export function VideoSection() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-28 px-5 py-20">
      <div className="grid items-end gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <Kicker>Features</Kicker>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl md:leading-[1.08]">
            See the request.
            <br />
            <span className="text-accent-deep">Then sign.</span>
          </h2>
        </div>
        <p className="max-w-md text-base leading-relaxed text-muted lg:justify-self-end">
          You already have a wallet. 1337 is the confirm sheet it still doesn&apos;t give you — plus
          the RPC picker, hardware, and a vault that never leaves this machine.
        </p>
      </div>

      <div className="feature-pitch">
        {PITCHES.map(pitch => (
          <a key={pitch.href} href={pitch.href} className="feature-pitch__item">
            <span className="feature-pitch__index">{pitch.index}</span>
            <span>
              <span className="feature-pitch__title">{pitch.title}</span>
              <span className="feature-pitch__body">{pitch.body}</span>
            </span>
          </a>
        ))}
      </div>

      <ScreenshotGallery />
    </section>
  );
}
