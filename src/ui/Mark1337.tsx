/** Compact skull mark for headers and toolbar contexts. */

const SKULL_SRC = 'icons/1337-skull.png';

export function Mark1337({
  className,
  size = 28,
  animated = true,
}: {
  className?: string;
  size?: number;
  /** When false, skips idle/hover glow. Default true. */
  animated?: boolean;
}) {
  return (
    <img
      src={SKULL_SRC}
      alt=""
      width={size}
      height={size}
      className={`w1337-mark${animated ? ' w1337-mark--live' : ''}${className ? ` ${className}` : ''}`}
      decoding="async"
      draggable={false}
    />
  );
}
