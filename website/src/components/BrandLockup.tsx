type BrandLockupProps = {
  size?: 'sm' | 'md';
};

const SIZES = {
  sm: { mark: 28, word: 12 },
  md: { mark: 40, word: 16 },
} as const;

const WORD_W = 35;
const WORD_H = 11;

export function BrandLockup({ size = 'md' }: BrandLockupProps) {
  const { mark, word } = SIZES[size];

  return (
    <span className="brand-lockup">
      <img
        src="/1337-skull.png"
        alt=""
        width={mark}
        height={mark}
        className="brand-lockup__mark"
        style={{ width: mark, height: mark }}
        draggable={false}
      />
      <img
        src="/1337-wordmark.png"
        alt="1337"
        width={WORD_W}
        height={WORD_H}
        className="brand-lockup__word"
        style={{ height: word, width: Math.round((WORD_W / WORD_H) * word) }}
        draggable={false}
      />
    </span>
  );
}
