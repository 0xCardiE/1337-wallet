import type { Metadata } from 'next';
import Link from 'next/link';
import { Kicker } from '@/components/Kicker';
import { RPC_METHOD_GROUPS, RPC_STATUS_LABEL, type RpcStatus } from '@/content/rpcMethods';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'RPC methods',
  description:
    'EIP-1193 methods 1337 Wallet supports, what we leave empty, and what Uniswap, Aave, Pendle, and Curve use instead.',
};

const PILL: Record<RpcStatus, string> = {
  yes: 'bg-accent-soft text-accent-deep',
  empty: 'bg-[rgba(250,204,21,0.12)] text-[#fbbf24]',
  fallback: 'bg-[rgba(148,163,184,0.12)] text-[#94a3b8]',
  no: 'bg-[rgba(251,146,60,0.12)] text-[#fb923c]',
  off: 'bg-[rgba(248,113,113,0.12)] text-[#f87171]',
};

function StatusPill({ status }: { status: RpcStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[status]}`}
    >
      {RPC_STATUS_LABEL[status]}
    </span>
  );
}

export default function RpcMethodsPage() {
  return (
    <div>
      <section className="grid-glow border-b border-border/60">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <Kicker>Provider</Kicker>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
            RPC methods
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            What {SITE.shortName} answers on <code className="text-text">window.ethereum</code>,
            and what Uniswap, Aave, Pendle, and Curve do when we do not implement a call. We are a
            signer: send, sign, switch chain. We do not fake batch sends.
          </p>
          <div className="mt-8 flex flex-wrap gap-2 text-sm">
            {(
              [
                ['yes', 'Supported'],
                ['empty', 'Answers empty'],
                ['fallback', 'Dapp fallback'],
                ['no', 'Not implemented'],
                ['off', 'Disabled'],
              ] as const
            ).map(([status, label]) => (
              <span
                key={status}
                className={`inline-flex items-center rounded-full px-3 py-1 ${PILL[status]}`}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {RPC_METHOD_GROUPS.map(group => (
              <a key={group.id} href={`#${group.id}`} className="btn-secondary px-4 py-2 text-sm">
                {group.nav ?? group.title}
              </a>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-14 px-5 py-16">
        {RPC_METHOD_GROUPS.map(group => (
          <section key={group.id} id={group.id} className="scroll-mt-28">
            <h2 className="text-2xl font-semibold tracking-tight">{group.title}</h2>
            <p className="mt-2 max-w-3xl text-muted">{group.lead}</p>

            <div className="mt-6 space-y-3 md:hidden">
              {group.rows.map(row => (
                <article
                  key={row.method}
                  className="rounded-2xl border border-border/80 bg-bg-card px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-mono text-xs font-medium text-text">{row.method}</p>
                    <StatusPill status={row.status} />
                  </div>
                  <p className="mt-3 text-[0.7rem] font-medium uppercase tracking-wider text-muted">
                    What 1337 does
                  </p>
                  <p className="mt-1 text-sm text-muted">{row.weDo}</p>
                  <p className="mt-3 text-[0.7rem] font-medium uppercase tracking-wider text-muted">
                    What dapps use
                  </p>
                  <p className="mt-1 text-sm text-muted">{row.dappsUse}</p>
                </article>
              ))}
            </div>

            <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-border/80 md:block">
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[9.5rem]" />
                  <col className="w-[32%]" />
                  <col />
                </colgroup>
                <thead className="bg-bg-elevated text-text">
                  <tr>
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">What 1337 does</th>
                    <th className="px-4 py-3 font-medium">What dapps use</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map(row => (
                    <tr key={row.method} className="border-t border-border/70">
                      <th className="px-4 py-3 align-top font-mono text-xs font-medium break-words text-text">
                        {row.method}
                      </th>
                      <td className="px-4 py-3 align-top">
                        <StatusPill status={row.status} />
                      </td>
                      <td className="px-4 py-3 align-top text-muted">{row.weDo}</td>
                      <td className="px-4 py-3 align-top text-muted">{row.dappsUse}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <p className="text-sm text-muted">
          Events: <code className="text-text">accountsChanged</code>,{' '}
          <code className="text-text">chainChanged</code>, <code className="text-text">connect</code>
          , <code className="text-text">disconnect</code>. Integration code is on{' '}
          <Link href="/integrate" className="text-text underline-offset-4 hover:underline">
            /integrate
          </Link>
          .
        </p>

        <div className="flex flex-wrap gap-4">
          <Link href="/integrate" className="btn-secondary">
            Integration guide
          </Link>
          <Link href="/" className="btn-secondary">
            ← Home
          </Link>
        </div>
      </div>
    </div>
  );
}
