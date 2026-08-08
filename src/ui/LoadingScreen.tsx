import { Brand1337 } from './Brand1337';

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <div
      className="loading-screen w1337-loading-screen"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Brand1337 className="loading-screen-brand-stack" skullSize={80} wordmarkWidth={180} />
      {message ? (
        <p className="loading-screen-message">{message}</p>
      ) : (
        <p className="loading-screen-message">Loading…</p>
      )}
      <span className="sr-only">Loading</span>
    </div>
  );
}
