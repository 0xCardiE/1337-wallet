'use client';

import { useEffect, useState } from 'react';
import { HERO_BAGS, pickHeroBag, type HeroBag } from '@/lib/heroBags';

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M19.4 12.6a7.4 7.4 0 0 0 .06-1.2 7.4 7.4 0 0 0-.06-1.2l2-1.56-1.9-3.28-2.36.96a7.6 7.6 0 0 0-2.08-1.2L13 2h-2l-.16 2.52c-.74.28-1.44.68-2.08 1.2L6.4 4.76 4.5 8.04 6.5 9.6a7.4 7.4 0 0 0-.06 1.2 7.4 7.4 0 0 0 .06 1.2L4.5 13.56l1.9 3.28 2.36-.96c.64.52 1.34.92 2.08 1.2L11 20.6h2l.16-2.52c.74-.28 1.44-.68 2.08-1.2l2.36.96 1.9-3.28-2.1-1.56Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HeroDevice() {
  const [bag, setBag] = useState<HeroBag>(HERO_BAGS[0]!);

  useEffect(() => {
    setBag(pickHeroBag());
  }, []);

  const names = bag.tokens.map(token => token.symbol).join(', ');

  return (
    <div className="hero-device-scene">
      <a
        href="#networks"
        className="hero-device"
        aria-label={`1337 Assets on Ethereum with ${names}`}
      >
        <span className="hero-device__bezel">
          <span className="hero-device__screen">
            <span className="hero-wallet">
              <span className="hero-wallet__top">
                <span className="hero-wallet__brand">
                  <img src="/1337-skull.png" alt="" width={22} height={22} />
                  <img
                    src="/1337-wordmark.png"
                    alt="1337"
                    width={35}
                    height={11}
                    className="hero-wallet__wordmark"
                  />
                </span>
                <span className="hero-wallet__gear">
                  <GearIcon />
                </span>
              </span>

              <span className="hero-wallet__tabs">
                <span className="hero-wallet__tab hero-wallet__tab--on">Assets</span>
                <span className="hero-wallet__tab">History</span>
                <span className="hero-wallet__tab">Tools</span>
              </span>

              <span className="hero-wallet__nets">
                <span className="hero-wallet__net hero-wallet__net--on">Mainnets</span>
                <span className="hero-wallet__net">Testnets</span>
              </span>

              <span className="hero-wallet__pickers">
                <span className="hero-wallet__picker">
                  <span className="hero-wallet__picker-k">Chain</span>
                  <span className="hero-wallet__picker-v">
                    <img src="/tokens/eth.png" alt="" width={14} height={14} />
                    Ethereum
                  </span>
                </span>
                <span className="hero-wallet__picker">
                  <span className="hero-wallet__picker-k">RPC</span>
                  <span className="hero-wallet__picker-v hero-wallet__picker-v--mono">
                    publicnode.com
                  </span>
                </span>
              </span>

              <span className="hero-wallet__health">
                <span>
                  <span className="hero-wallet__dot" />
                  dRPC · 48ms · 3 healthy
                </span>
                <span className="hero-wallet__doctor">Doctor</span>
              </span>

              <span className="hero-wallet__list">
                {bag.tokens.map(token => (
                  <span key={`${bag.id}-${token.symbol}`} className="hero-wallet__row">
                    <img src={token.logo} alt="" width={32} height={32} />
                    <span className="hero-wallet__meta">
                      <span className="hero-wallet__name">{token.name}</span>
                      <span className="hero-wallet__sym">{token.symbol}</span>
                    </span>
                    <span className="hero-wallet__vals">
                      <span className="hero-wallet__usd">{token.usd}</span>
                      <span className="hero-wallet__amt">{token.amount}</span>
                    </span>
                    <span className="hero-wallet__plus" aria-hidden>
                      +
                    </span>
                    <span className="hero-wallet__x" aria-hidden>
                      ×
                    </span>
                  </span>
                ))}
              </span>
            </span>
          </span>
          <span className="hero-device__shine" aria-hidden />
        </span>
      </a>
    </div>
  );
}
