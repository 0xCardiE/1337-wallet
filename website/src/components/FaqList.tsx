import type { ReactNode } from 'react';

export type FaqItem = {
  q: string;
  a: ReactNode;
};

export type FaqGroup = {
  id: string;
  title: string;
  intro?: string;
  extra?: ReactNode;
  items: FaqItem[];
};

export function FaqList({ groups }: { groups: readonly FaqGroup[] }) {
  return (
    <div className="space-y-14">
      {groups.map(group => (
        <section key={group.id} id={group.id} className="scroll-mt-28">
          <h2 className="text-2xl font-semibold tracking-tight">{group.title}</h2>
          {group.intro ? <p className="mt-2 max-w-3xl text-muted">{group.intro}</p> : null}
          {group.extra ? <div className="mt-8">{group.extra}</div> : null}
          <div className="mt-6 space-y-3">
            {group.items.map(item => (
              <details key={item.q} className="card-surface group p-5">
                <summary className="cursor-pointer list-none font-medium marker:content-none">
                  <span className="flex items-center justify-between gap-4">
                    {item.q}
                    <span className="shrink-0 text-accent-deep transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                {typeof item.a === 'string' ? (
                  <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
                ) : (
                  <div className="faq-answer mt-3 text-sm leading-relaxed text-muted">{item.a}</div>
                )}
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
