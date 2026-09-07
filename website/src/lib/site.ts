export const SITE = {
  name: '1337 Wallet',
  shortName: '1337',
  origin: 'https://1337wallet.io',
  tagline: 'A professional EVM signer for developers, hackers, and advanced users.',
  description:
    'Dense confirms, your RPCs, approvals, swaps, ENS, multisend. Built for people who already read the request. No analytics. No 1337 server. Works with every MetaMask dapp.',
  chromeStoreUrl: '#download',
  contactEmail: 'hello@1337wallet.io',
  githubUrl: 'https://github.com/0xCardiE/1337-wallet',
  privacyPath: '/privacy',
} as const;

export const STORE_SCREENSHOTS = [
  {
    src: '/screenshots/onboarding.jpg',
    caption: 'Create or import a seed or private key — encrypted on this device',
    alt: '1337 Wallet onboarding: create or import a seed phrase or private key',
  },
  {
    src: '/screenshots/assets.jpg',
    caption: 'Assets, your RPC, and network doctor on each chain',
    alt: '1337 Wallet Assets tab on Ethereum with RPC picker and network doctor',
  },
  {
    src: '/screenshots/confirm.jpg',
    caption: 'Readable confirm before you sign — origin, message, reject or confirm',
    alt: '1337 Wallet confirm sheet for a personal_sign request from example.com',
  },
  {
    src: '/screenshots/tools.jpg',
    caption: 'Signer tools: Signings, Approvals, Swap, ENS, Multisend, Gas',
    alt: '1337 Wallet Tools tab showing Signings history',
  },
  {
    src: '/screenshots/multisend.jpg',
    caption: 'Multisend via Disperse.app — one transaction, leftover ETH refunded',
    alt: '1337 Wallet Multisend tool with recipient list',
  },
] as const;

export const NAV_LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/#tools', label: 'Tools' },
  { href: '/security', label: 'Security' },
  { href: '/faq', label: 'FAQ' },
  { href: '/integrate', label: 'Integrate' },
] as const;

export const FOOTER_EXTRA_LINKS = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#contact', label: 'Contact' },
] as const;

export const CORE_FEATURES = [
  {
    title: 'Popular RPCs, your way',
    description:
      '20+ EVM chains ship with curated public RPC endpoints. Switch per chain, add custom URLs, and run the network doctor when something looks off.',
    icon: 'rpc',
  },
  {
    title: 'Inline send',
    description:
      'Send native or ERC-20 tokens without leaving the home screen — quick amounts, address paste, and confirmation in one flow.',
    icon: 'send',
  },
  {
    title: 'ENS built in',
    description:
      'Resolve names on send, manage your portfolio, and work with DNS-style domains from the Tools tab.',
    icon: 'ens',
  },
  {
    title: 'Human Passport',
    description:
      'See Gitcoin Passport scores inline when you interact with addresses — useful context for sybil resistance and trust.',
    icon: 'passport',
  },
  {
    title: 'Readable before you sign',
    description:
      'Human summary, local simulation (pass / fail / revert), and contract danger flags — then the decoded details if you want them.',
    icon: 'tx',
  },
  {
    title: 'History via Etherscan',
    description:
      'Pull transaction history through your own explorer API key. Every row opens straight to the matching Etherscan page.',
    icon: 'history',
  },
] as const;

export const TOOLS = [
  {
    id: 'signings',
    title: 'Signings',
    description:
      'Local history of messages and typed data this wallet signed — SIWE, permits, EIP-712. Device only.',
  },
  {
    id: 'approvals',
    title: 'Approvals',
    description: 'Review and revoke ERC-20, NFT, and Permit2 allowances from the wallet.',
  },
  {
    id: 'swap',
    title: 'Swap',
    description: 'Cross-chain swaps powered by LI.FI — routes, slippage, and execution in-wallet.',
  },
  {
    id: 'ens',
    title: 'ENS & DNS',
    description: 'Register, renew, and manage .eth names and related DNS records.',
  },
  {
    id: 'multisend',
    title: 'Multisend',
    description: 'Paste a list of addresses and batch-send native or ERC-20 in one go.',
  },
  {
    id: 'gas',
    title: 'Gas station',
    description: 'Top up gas across chains when you are running low on the network you need.',
  },
] as const;

export const PROVIDER = {
  uuid: '1337-dev-wallet-2026',
  name: '1337',
  rdns: 'io.1337.wallet',
  isMetaMask: true,
  is1337: true,
} as const;

export const FAQ = [
  {
    q: 'Who is 1337 Wallet for?',
    a: 'Developers, security researchers, and advanced users who want a serious signer — readable confirms, RPC control, hardware — not a consumer toy and not a Foundry lab in the toolbar.',
  },
  {
    q: 'Does it track me?',
    a: 'No analytics, no telemetry, no 1337 backend. Vault and settings stay in Chrome extension storage on your machine.',
  },
  {
    q: 'Can I use it with existing dapps?',
    a: 'Yes. Enable MetaMask drop-in mode for window.ethereum compatibility, or connect via EIP-6963 as 1337.',
  },
  {
    q: 'Hardware wallets?',
    a: 'Ledger (WebHID) and Trezor Connect are supported alongside seed and private-key accounts.',
  },
] as const;
