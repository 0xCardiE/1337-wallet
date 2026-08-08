import type { ReactNode } from 'react';

/** Outer key remount triggers enter animation inside. */
export function ScreenFade({
  routeKey,
  children,
}: {
  routeKey: string;
  children: ReactNode;
}) {
  return (
    <div key={routeKey} className="w1337-route-root">
      <div className="w1337-route-layer">{children}</div>
    </div>
  );
}
