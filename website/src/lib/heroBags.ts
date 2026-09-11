export type HeroToken = {
  symbol: string;
  name: string;
  logo: string;
  usd: string;
  amount: string;
  kind: 'major' | 'meme' | 'defi';
};

export type HeroBag = {
  id: string;
  tokens: [HeroToken, HeroToken, HeroToken];
};

const ETH: HeroToken = {
  kind: 'major',
  symbol: 'ETH',
  name: 'Ethereum',
  logo: '/tokens/eth.png',
  usd: '$48,210.00',
  amount: '12.4081 ETH',
};

const WBTC: HeroToken = {
  kind: 'major',
  symbol: 'WBTC',
  name: 'Wrapped Bitcoin',
  logo: '/tokens/wbtc.png',
  usd: '$62,840.00',
  amount: '0.6142 WBTC',
};

const USDC: HeroToken = {
  kind: 'major',
  symbol: 'USDC',
  name: 'USD Coin',
  logo: '/tokens/usdc.png',
  usd: '$18,420.00',
  amount: '18,420 USDC',
};

const PEPE: HeroToken = {
  kind: 'meme',
  symbol: 'PEPE',
  name: 'Pepe',
  logo: '/tokens/pepe.png',
  usd: '$6,140.00',
  amount: '842,190,000 PEPE',
};

const SHIB: HeroToken = {
  kind: 'meme',
  symbol: 'SHIB',
  name: 'Shiba Inu',
  logo: '/tokens/shib.png',
  usd: '$2,280.00',
  amount: '148,200,000 SHIB',
};

const FLOKI: HeroToken = {
  kind: 'meme',
  symbol: 'FLOKI',
  name: 'FLOKI',
  logo: '/tokens/floki.png',
  usd: '$1,640.00',
  amount: '11,840,000 FLOKI',
};

const MOG: HeroToken = {
  kind: 'meme',
  symbol: 'MOG',
  name: 'Mog Coin',
  logo: '/tokens/mog.png',
  usd: '$3,910.00',
  amount: '4,120,000,000 MOG',
};

const UNI: HeroToken = {
  kind: 'defi',
  symbol: 'UNI',
  name: 'Uniswap',
  logo: '/tokens/uni.png',
  usd: '$4,180.00',
  amount: '612.4 UNI',
};

const AAVE: HeroToken = {
  kind: 'defi',
  symbol: 'AAVE',
  name: 'Aave',
  logo: '/tokens/aave.png',
  usd: '$5,760.00',
  amount: '28.14 AAVE',
};

const LDO: HeroToken = {
  kind: 'defi',
  symbol: 'LDO',
  name: 'Lido DAO',
  logo: '/tokens/ldo.png',
  usd: '$3,040.00',
  amount: '2,180 LDO',
};

const MKR: HeroToken = {
  kind: 'defi',
  symbol: 'MKR',
  name: 'Maker',
  logo: '/tokens/mkr.png',
  usd: '$7,120.00',
  amount: '4.82 MKR',
};

const LINK: HeroToken = {
  kind: 'defi',
  symbol: 'LINK',
  name: 'Chainlink',
  logo: '/tokens/link.png',
  usd: '$3,890.00',
  amount: '246.8 LINK',
};

const CRV: HeroToken = {
  kind: 'defi',
  symbol: 'CRV',
  name: 'Curve DAO',
  logo: '/tokens/crv.png',
  usd: '$1,980.00',
  amount: '4,620 CRV',
};

/** One major, one meme, one DeFi. Picked at random in the hero. */
export const HERO_BAGS: HeroBag[] = [
  { id: 'eth-pepe-uni', tokens: [ETH, PEPE, UNI] },
  { id: 'eth-shib-aave', tokens: [ETH, SHIB, AAVE] },
  { id: 'wbtc-pepe-ldo', tokens: [WBTC, PEPE, LDO] },
  { id: 'usdc-floki-mkr', tokens: [USDC, FLOKI, MKR] },
  { id: 'eth-mog-link', tokens: [ETH, MOG, LINK] },
  { id: 'wbtc-shib-crv', tokens: [WBTC, SHIB, CRV] },
  { id: 'usdc-pepe-uni', tokens: [USDC, PEPE, UNI] },
  { id: 'eth-floki-aave', tokens: [ETH, FLOKI, AAVE] },
];

export function pickHeroBag(): HeroBag {
  return HERO_BAGS[Math.floor(Math.random() * HERO_BAGS.length)]!;
}
