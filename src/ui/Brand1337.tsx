/** Hero branding — pixel skull + 1337 wordmark (public/icons). */

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
  const wordmarkHeight = Math.round(wordmarkWidth * (6 / 28));

  return (
    <div className={`w1337-brand${className ? ` ${className}` : ''}`}>
      <img
        src={SKULL_SRC}
        alt=""
        className="w1337-brand__skull"
        width={skullSize}
        height={skullSize}
        style={{ width: skullSize, height: skullSize }}
        decoding="async"
        draggable={false}
      />
      <img
        src={WORDMARK_SRC}
        alt="1337"
        className="w1337-brand__wordmark"
        width={wordmarkWidth}
        height={wordmarkHeight}
        style={{ width: wordmarkWidth, height: wordmarkHeight }}
        decoding="async"
        draggable={false}
      />
    </div>
  );
}
