/** Hero branding — original hoodie+ETH mark + pixel 1337 wordmark. */

const MARK_SRC = 'icons/1337-skull.png';
const WORD_SRC = 'icons/1337-wordmark.png';
const WORD_NATIVE = { w: 35, h: 11 };

export function Brand1337({
  markSize = 128,
  wordHeight = WORD_NATIVE.h * 2,
  className,
}: {
  markSize?: number;
  wordHeight?: number;
  className?: string;
}) {
  const wordWidth = (WORD_NATIVE.w / WORD_NATIVE.h) * wordHeight;

  return (
    <div className={`w1337-brand${className ? ` ${className}` : ''}`}>
      <span className="w1337-brand__mark-slot" style={{ width: markSize, height: markSize }}>
        <img
          src={MARK_SRC}
          alt=""
          className="w1337-brand__mark-glow"
          width={markSize}
          height={markSize}
          aria-hidden
          decoding="async"
          draggable={false}
        />
        <img
          src={MARK_SRC}
          alt=""
          className="w1337-brand__mark"
          width={markSize}
          height={markSize}
          decoding="async"
          draggable={false}
        />
      </span>
      <img
        src={WORD_SRC}
        alt="1337"
        className="w1337-brand__wordmark"
        width={wordWidth}
        height={wordHeight}
        style={{ width: wordWidth, height: wordHeight }}
        decoding="async"
        draggable={false}
      />
    </div>
  );
}
