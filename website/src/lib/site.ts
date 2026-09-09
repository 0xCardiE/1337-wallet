export const SITE = {
  name: '1337 Wallet',
  shortName: '1337',
  origin: 'https://1337wallet.io',
  tagline: 'A professional EVM signer for developers, hackers, and advanced users.',
  description:
    'Readable confirms, easy RPC switching, approvals, swaps, ENS, and multisend. No analytics. No tracking server. Works with every MetaMask dapp.',
  chromeStoreUrl:
    'https://chromewebstore.google.com/detail/1337-wallet/ggdidobiifdhehiigbcjiddeeadklmhl',
  discordUrl: 'https://discord.gg/ZgADAzAKFd',
  privacyPath: '/privacy',
  termsPath: '/terms',
} as const;

export const STORE_SCREENSHOTS = [
  {
    src: '/screenshots/onboarding.jpg',
    caption: 'Create or import a seed or private key — encrypted on this device',
    alt: '1337 Wallet onboarding: create or import a seed phrase or private key',
  },
  {
    src: '/screenshots/assets.jpg',
    caption: 'Balances on each chain — switch RPC when you need to',
    alt: '1337 Wallet Assets tab on Ethereum showing ETH, USDC, and other token balances',
  },
  {
    src: '/screenshots/assets-send.jpg',
    caption: 'Inline send — recipient and amount without leaving Assets',
    alt: '1337 Wallet Assets tab with Derive expanded and an inline send form',
  },
  {
    src: '/screenshots/assets-empty.jpg',
    caption: 'Empty network — add a token or switch chain',
    alt: '1337 Wallet Assets tab showing no tokens with balance on the selected network',
  },
  {
    src: '/screenshots/history.jpg',
    caption: 'History via your explorer key — hash, decode, open on Etherscan',
    alt: '1337 Wallet History tab with an expanded approve transaction and Etherscan link',
  },
  {
    src: '/screenshots/confirm.jpg',
    caption: 'Readable confirm before you sign — origin, amount, reject or confirm',
    alt: '1337 Wallet confirm sheet for sending ETH from a dapp',
  },
  {
    src: '/screenshots/signings.jpg',
    caption: 'Signings — SIWE, permits, and typed data this wallet signed',
    alt: '1337 Wallet Signings tool with a list of recent message and permit signatures',
  },
  {
    src: '/screenshots/approvals.jpg',
    caption: 'Approvals — review and revoke ERC-20, NFT, and Permit2 allowances',
    alt: '1337 Wallet Approvals tool listing token and NFT allowances with revoke',
  },
  {
    src: '/screenshots/swap.jpg',
    caption: 'Swap via LI.FI — pick a pair, get a quote, sign in-wallet',
    alt: '1337 Wallet Swap tool showing an ETH to USDC quote',
  },
  {
    src: '/screenshots/ens.jpg',
    caption: 'ENS — names, expiry, and Swarm content hashes',
    alt: '1337 Wallet ENS tool listing .eth names with an expanded Swarm content hash',
  },
  {
    src: '/screenshots/multisend.jpg',
    caption: 'Multisend via Disperse.app — one transaction, leftover ETH refunded',
    alt: '1337 Wallet Multisend tool with a filled recipient list',
  },
  {
    src: '/screenshots/gas.jpg',
    caption: 'Gas station — top up native token, pay with USDC',
    alt: '1337 Wallet Gas tool quoting an Ethereum top-up paid with USDC',
  },
  {
    src: '/screenshots/accounts.jpg',
    caption: 'Switch account — seed, burner, hardware, and private key',
    alt: '1337 Wallet account switcher listing seed, Trezor, Ledger, and private-key accounts',
  },
  {
    src: '/screenshots/settings.jpg',
    caption: 'Settings — networks, wallets, burner mode, tools, connected sites',
    alt: '1337 Wallet Settings with networks, wallets, burner mode, and side panel options',
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
    title: 'Easy RPC switching',
    description:
      '20+ EVM chains ship with curated public endpoints. Switch per chain in one click, add a custom URL if you want, and run the network doctor when something looks off.',
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
    a: 'Developers, security researchers, and advanced users who want a serious signer — readable confirms, easy RPC switching, and hardware — without a consumer toy UI.',
  },
  {
    q: 'Does it track me?',
    a: 'No analytics, no telemetry, no tracking server. Vault and settings stay in Chrome extension storage on your machine.',
  },
  {
    q: 'Do you guarantee my funds?',
    a: 'No. 1337 is a self-custody tool. You hold the keys. We cannot recover a lost seed or reimburse lost funds. Terms of use are on this site.',
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
