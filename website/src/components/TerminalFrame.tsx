import type { ReactNode } from 'react';

export function TerminalFrame({
  title,
  zoomHint = false,
  children,
  className,
}: {
  title: string;
  zoomHint?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`terminal-frame ${className ?? ''}`}>
      <div className="terminal-frame__bar">
        <span className="terminal-frame__dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="terminal-frame__title">{title}</span>
        {zoomHint ? (
          <span className="terminal-frame__zoom" aria-hidden>
            [+]
          </span>
        ) : (
          <span className="w-7" aria-hidden />
        )}
      </div>
      <div className="terminal-frame__body">{children}</div>
    </div>
  );
}

export function frameTitleFromSrc(src: string): string {
  const file = src.split('/').pop() ?? src;
  return file.replace(/\.[a-z0-9]+$/i, '').replace(/-/g, '.');
}
