import Image from 'next/image';

export function BuiltOnEthereumBadge({ className = '' }: { className?: string }) {
  return (
    <a
      href="https://ethereum.org"
      target="_blank"
      rel="noreferrer"
      aria-label="Built on Ethereum Mainnet"
      className={`inline-block transition hover:-translate-y-0.5 hover:opacity-95 ${className}`}
    >
      <Image
        src="/built-on-ethereum.png"
        alt="Built on Ethereum Mainnet"
        width={415}
        height={128}
        className="h-auto w-[210px] rounded-lg md:w-[248px]"
      />
    </a>
  );
}
