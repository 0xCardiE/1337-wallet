/** Hero branding — CRT skull + 1337 wordmark (public/icons). */

const SKULL_SRC = 'icons/1337-skull.png';
const WORDMARK_SRC = 'icons/1337-wordmark.png';

export function Brand1337({
  skullSize = 88,
  wordmarkWidth = 200,
  className,
}: {
  skullSize?: number;
  wordmarkWidth?: number;
  className?: string;
}) {
  return (
    <div className={`w1337-brand${className ? ` ${className}` : ''}`}>
      <img
        src={SKULL_SRC}
        alt=""
        className="w1337-brand__skull"
        width={skullSize}
        height={Math.round(skullSize * (125 / 110))}
        decoding="async"
        draggable={false}
      />
      <img
        src={WORDMARK_SRC}
        alt="1337"
        className="w1337-brand__wordmark"
        width={wordmarkWidth}
        height={Math.round(wordmarkWidth * (126 / 329))}
        decoding="async"
        draggable={false}
      />
    </div>
  );
}
