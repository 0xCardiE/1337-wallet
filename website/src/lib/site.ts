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
    caption: 'Create or import a seed or private key. Encrypted on this device.',
    alt: '1337 Wallet onboarding: create or import a seed phrase or private key',
  },
  {
    src: '/screenshots/assets.jpg',
    caption: 'Balances on each chain. Switch RPC when you need to.',
    alt: '1337 Wallet Assets tab on Ethereum showing ETH, USDC, and other token balances',
  },
  {
    src: '/screenshots/assets-send.jpg',
    caption: 'Inline send. Recipient and amount without leaving Assets.',
    alt: '1337 Wallet Assets tab with Derive expanded and an inline send form',
  },
  {
    src: '/screenshots/history.jpg',
    caption: 'History via your explorer key. Hash, decode, open on Etherscan.',
    alt: '1337 Wallet History tab with an expanded approve transaction and Etherscan link',
  },
  {
    src: '/screenshots/confirm.jpg',
    caption: 'Readable confirm before you sign. Origin, amount, reject or confirm.',
    alt: '1337 Wallet confirm sheet for sending ETH from a dapp',
  },
  {
    src: '/screenshots/signings.jpg',
    caption: 'Signings. SIWE, permits, and typed data this wallet signed.',
    alt: '1337 Wallet Signings tool with a list of recent message and permit signatures',
  },
  {
    src: '/screenshots/approvals.jpg',
    caption: 'Approvals. Review and revoke ERC-20, NFT, and Permit2 allowances.',
    alt: '1337 Wallet Approvals tool listing token and NFT allowances with revoke',
  },
  {
    src: '/screenshots/swap.jpg',
    caption: 'Multichain swap with no extra fees. LI.FI route, then you sign.',
    alt: '1337 Wallet Swap tool showing an ETH to USDC quote',
  },
  {
    src: '/screenshots/ens.jpg',
    caption: 'ENS. Names, expiry, and content hashes.',
    alt: '1337 Wallet ENS tool listing .eth names with an expanded content hash',
  },
  {
    src: '/screenshots/multisend.jpg',
    caption: 'Multisend via Disperse.app. One transaction, leftover ETH refunded.',
    alt: '1337 Wallet Multisend tool with a filled recipient list',
  },
  {
    src: '/screenshots/gas.jpg',
    caption: 'Gas station. Top up native token, pay with USDC.',
    alt: '1337 Wallet Gas tool quoting an Ethereum top-up paid with USDC',
  },
  {
    src: '/screenshots/accounts.jpg',
    caption: 'Switch account. Seed, burner, hardware, and private key.',
    alt: '1337 Wallet account switcher listing seed, Trezor, Ledger, and private-key accounts',
  },
  {
    src: '/screenshots/settings.jpg',
    caption: 'Settings. Networks, wallets, burner mode, tools, connected sites.',
    alt: '1337 Wallet Settings with networks, wallets, burner mode, and side panel options',
  },
] as const;

export const NAV_LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/#tools', label: 'Tools' },
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
      'Send native or ERC-20 tokens without leaving the home screen. Quick amounts, address paste, and confirmation in one flow.',
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
      'See Gitcoin Passport scores inline when you interact with addresses. Useful context for sybil resistance and trust.',
    icon: 'passport',
  },
  {
    title: 'Readable before you sign',
    description:
      'Human summary, local simulation (pass / fail / revert), and contract danger flags. Then the decoded details if you want them.',
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
      'Local history of messages and typed data this wallet signed. SIWE, permits, EIP-712. Device only.',
  },
  {
    id: 'approvals',
    title: 'Approvals',
    description: 'Review and revoke ERC-20, NFT, and Permit2 allowances from the wallet.',
  },
  {
    id: 'swap',
    title: 'Swap',
    description: 'Multichain swaps via LI.FI with no extra fees. Routes, slippage, and execution in-wallet.',
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

