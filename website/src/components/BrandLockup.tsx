type BrandLockupProps = {
  size?: 'sm' | 'md';
};

const SIZES = {
  sm: { skull: 22, wordmark: 12 },
  md: { skull: 28, wordmark: 18 },
} as const;

export function BrandLockup({ size = 'md' }: BrandLockupProps) {
  const { skull, wordmark } = SIZES[size];

  return (
    <span className="inline-flex items-center gap-2">
      <img
        src="/1337-skull.svg"
        alt=""
        width={skull}
        height={skull}
        className="[image-rendering:pixelated]"
        style={{ width: skull, height: skull }}
        draggable={false}
      />
      <img
        src="/1337-wordmark.png"
        alt="1337"
        width={336}
        height={72}
        className="w-auto [image-rendering:pixelated]"
        style={{ height: wordmark }}
        draggable={false}
      />
    </span>
  );
}
