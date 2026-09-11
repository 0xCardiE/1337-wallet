import type { ReactNode } from 'react';

export function Kicker({
  index,
  rule = false,
  children,
}: {
  index?: string;
  rule?: boolean;
  children: ReactNode;
}) {
  return (
    <p className="kicker">
      {index ? <span className="kicker__index">{index}</span> : null}
      <span>{children}</span>
      {rule ? <span className="kicker__rule" aria-hidden /> : null}
    </p>
  );
}
