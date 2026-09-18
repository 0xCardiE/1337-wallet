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
  xUrl: 'https://x.com/1337wallet',
  privacyPath: '/privacy',
  termsPath: '/terms',
} as const;

export type FeatureShot = {
  src: string;
  width: number;
  height: number;
  caption: string;
  alt: string;
};

export type ProductFeature = {
  id: string;
  kicker: string;
  title: string;
  hook: string;
  tryIt: string;
  shots: FeatureShot[];
};

export const PRODUCT_FEATURES: ProductFeature[] = [
  {
    id: 'networks',
    kicker: 'Networks',
    title: 'Pick the chain and the RPC',
    hook: 'Mainnets and testnets in the same wallet. Switch the endpoint when one is slow. 1337 does not run an RPC of its own.',
    tryIt: 'Open Assets, change the Ethereum RPC, then switch to Sepolia.',
    shots: [
      {
        src: '/screenshots/features/assets.png',
        width: 499,
        height: 518,
        caption: 'Balances in USD. Chain and RPC in the header. Doctor when an endpoint looks off.',
        alt: 'Assets tab on Ethereum showing Derive, Swarm, and Virtuals balances with chain and RPC pickers',
      },
      {
        src: '/screenshots/features/rpc.png',
        width: 503,
        height: 532,
        caption: 'Public endpoints for this chain, with health and latency. One click to switch.',
        alt: 'RPC dropdown listing PublicNode, dRPC, MEV Blocker, Cloudflare, and other Ethereum endpoints',
      },
      {
        src: '/screenshots/features/testnets.png',
        width: 508,
        height: 562,
        caption: 'Sepolia, Base Sepolia, Arbitrum Sepolia, Amoy: same picker as mainnet.',
        alt: 'Testnets chain picker open on Sepolia with Robinhood Testnet, Base Sepolia, and other testnets listed',
      },
    ],
  },
  {
    id: 'reorder',
    kicker: 'Dropdowns',
    title: 'Reorder the chain and RPC dropdowns',
    hook: 'The order in Settings is the order on Assets. Put the chain you use first, then open it and put the RPC you use first. That RPC is preferred. Add a chain if it is missing from the catalog.',
    tryIt: 'Settings → Networks. Reorder the chain dropdown, then open a chain and reorder the RPC dropdown.',
    shots: [
      {
        src: '/screenshots/features/networks-rank.png',
        width: 504,
        height: 685,
        caption: 'Chain list. This order is the chain dropdown on Assets. Active stays marked.',
        alt: 'Networks list with reorder handles, Ethereum active, and chains ordered Ethereum, Robinhood Chain, Base, HyperEVM',
      },
      {
        src: '/screenshots/features/rpc-rank.png',
        width: 509,
        height: 678,
        caption: 'RPC list for that chain. This order is the RPC dropdown. First in the list is preferred.',
        alt: 'HyperEVM RPC list with reorder handles and a Preferred badge on PublicNode',
      },
    ],
  },
  {
    id: 'doctor',
    kicker: 'RPC Doctor',
    title: 'See which endpoints are actually up',
    hook: 'Probe chainId on every RPC for the active chain. Healthy, down, missing API key, and HTTP errors show in the same list. Failover uses the healthy ones.',
    tryIt: 'Tap Doctor next to the RPC field on Assets.',
    shots: [
      {
        src: '/screenshots/features/doctor.png',
        width: 509,
        height: 781,
        caption: 'Seven healthy, three down. Preferred and active are marked. Use a healthy RPC, or probe all again.',
        alt: 'RPC Doctor on Ethereum showing healthy and down endpoints, including Ankr unauthorized and HTTP 521/525 errors',
      },
    ],
  },
  {
    id: 'confirm',
    kicker: 'Confirm sheet',
    title: 'Read the request before you sign',
    hook: 'Each dapp request shows a plain-language summary, a local simulation, and the contract you are calling. Open the decode for the selector, Solidity source, and calldata. If you use hardware, you still confirm on the device.',
    tryIt: 'Connect a dapp, send a token, and read the sheet before you confirm.',
    shots: [
      {
        src: '/screenshots/features/confirm-summary.png',
        width: 503,
        height: 353,
        caption: 'Summary first: “Send tokens.” Simulation against the current chain. Verified proxy, with owner and implementation.',
        alt: '1337 confirm sheet summarizing a token transfer, with a successful simulation and Derive marked as a verified proxy',
      },
      {
        src: '/screenshots/features/confirm-decode.png',
        width: 488,
        height: 630,
        caption: 'Decoded call: selector, likely function, and the Solidity from the explorer.',
        alt: 'Confirm overview showing eth_sendTransaction fields, ERC-20 transfer decode, and OpenZeppelin transfer source',
      },
      {
        src: '/screenshots/features/confirm-hardware.png',
        width: 502,
        height: 398,
        caption: 'Full calldata if you want it. Reject here, or confirm on Trezor.',
        alt: 'Confirm sheet calldata for an ERC-20 transfer with Reject and Confirm on Trezor buttons',
      },
    ],
  },
  {
    id: 'history',
    kicker: 'History',
    title: 'Your transactions, in plain language',
    hook: 'Rows like “Approved token spending”, not a raw hash. Copy the fields or open the explorer. History uses the explorer API key you paste in Settings. A public RPC cannot list your transactions.',
    tryIt: 'Add an explorer key in Settings, then open History.',
    shots: [
      {
        src: '/screenshots/features/history.png',
        width: 493,
        height: 433,
        caption: 'Hash, nonce, from, to, function, method ID, gas. Link to Etherscan.',
        alt: 'History tab showing an expanded Approved token spending transaction with copyable fields and an Etherscan link',
      },
    ],
  },
  {
    id: 'approvals',
    kicker: 'Approvals',
    title: 'Revoke token allowances',
    hook: 'ERC-20, NFT operators, and Permit2 in one list. Revoke goes through the same confirm sheet as a send.',
    tryIt: 'Tools → Approvals. Revoke a spender you no longer need.',
    shots: [
      {
        src: '/screenshots/features/approvals.png',
        width: 533,
        height: 429,
        caption: 'Token, spender, last transaction, remaining allowance.',
        alt: 'Approvals tool listing token allowances with Revoke buttons and spender addresses',
      },
    ],
  },
  {
    id: 'swap',
    kicker: 'Swap',
    title: 'Quote a swap, then sign',
    hook: 'Routes come from LI.FI. 1337 does not run a swap service. You confirm the transaction; hardware confirms on the device.',
    tryIt: 'Tools → Swap. Quote ETH for another token.',
    shots: [
      {
        src: '/screenshots/features/swap.png',
        width: 473,
        height: 483,
        caption: 'Amount, 25 / 50 / 75 / MAX, then Get quote. The route and estimated output show underneath.',
        alt: 'Swap tool quoting ETH to 1INCH via LI.FI with percent amount buttons and Get quote',
      },
    ],
  },
  {
    id: 'ens',
    kicker: 'ENS',
    title: 'Register and manage .eth names',
    hook: 'Commit, wait 60 seconds, then register. That is the standard ENS controller flow. Confirm mode reviews each mainnet transaction. After that you can set a content hash, a URL, or renew. Names load from the ENS subgraph. A Graph API key in Settings is optional if the public endpoint fails.',
    tryIt: 'Tools → ENS. Register a name, or open one you already own.',
    shots: [
      {
        src: '/screenshots/features/ens-register.png',
        width: 503,
        height: 342,
        caption: 'Enter the label and Commit. If you refresh during the wait, the commit starts over.',
        alt: 'ENS register a .eth name form with a Commit button and the standard controller flow noted',
      },
      {
        src: '/screenshots/features/ens-manage.png',
        width: 507,
        height: 605,
        caption: 'Names you own, expiry, IPFS or bzz content hash, URL text record, extend one year.',
        alt: 'ENS tool showing swarmt3.eth with content hash, URL text record, and Extend 1 year',
      },
    ],
  },
  {
    id: 'multisend',
    kicker: 'Multisend',
    title: 'Send to many addresses in one transaction',
    hook: 'Paste a list. Disperse.app batches native or ERC-20. The contract takes no fee, and leftover ETH is refunded to you.',
    tryIt: 'Tools → Multisend. Three addresses, one send.',
    shots: [
      {
        src: '/screenshots/features/multisend.png',
        width: 499,
        height: 587,
        caption: 'Recipients, amount per address, optional ERC-20. Uses Disperse.app.',
        alt: 'Multisend tool using Disperse.app with three recipient addresses and amount per recipient',
      },
    ],
  },
  {
    id: 'gas',
    kicker: 'Gas station',
    title: 'Get gas on the chain you need',
    hook: 'If you need ETH on Ethereum and you only have USDC on Base, quote a top-up and sign the route.',
    tryIt: 'Tools → Gas. Choose the destination chain and the token you will pay with.',
    shots: [
      {
        src: '/screenshots/features/gas.png',
        width: 504,
        height: 416,
        caption: 'Destination chain, native amount to receive, pay-from chain, pay-with token.',
        alt: 'Gas station quoting 0.2 ETH on Ethereum paid from Base USDC',
      },
    ],
  },
  {
    id: 'accounts',
    kicker: 'Accounts',
    title: 'Human Passport, and copy with a double-click',
    hook: 'Human Passport is read onchain, with no API key. Click a row to switch accounts. Double-click an address to copy it. Seed, Trezor, Ledger, and imported keys are in the same list. Hardware still confirms on the device.',
    tryIt: 'Open the account menu. Double-click a row. Look for the Human badge if the address has a score.',
    shots: [
      {
        src: '/screenshots/features/accounts-passport.png',
        width: 502,
        height: 338,
        caption: 'Human Passport on the scored account. Click a row to switch.',
        alt: 'Account switcher with a Human 22 Passport badge on Swarm, plus seed, Trezor, and Ledger accounts',
      },
      {
        src: '/screenshots/features/accounts-copy.png',
        width: 514,
        height: 346,
        caption: 'Double-click any account address to copy it.',
        alt: 'Account switcher showing Copied! after double-clicking a Ledger address',
      },
    ],
  },
  {
    id: 'tools',
    kicker: 'Tools',
    title: 'Turn off tools you do not use',
    hook: 'Signings, Approvals, Swap, ENS, Multisend, and Gas. Inspect stays off until you enable it. Decode and simulation on the confirm sheet stay on.',
    tryIt: 'Settings → Tools. Uncheck what you will not use.',
    shots: [
      {
        src: '/screenshots/features/tools.png',
        width: 501,
        height: 460,
        caption: 'Inspect is a search box you enable. It is not a fourth tab.',
        alt: 'Tools settings with Signings, Approvals, Swap, ENS, Multisend, and Gas enabled, Inspect off',
      },
    ],
  },
  {
    id: 'burner',
    kicker: 'Burner Mode',
    title: 'Auto-sign on a disposable key',
    hook: 'Ordinary dapp requests can auto-sign on a software wallet you treat as disposable. Unlimited approvals, unknown contracts, permits, and SIWE mismatches still pause unless you turn those gates off. Hardware always confirms on the device.',
    tryIt: 'Turn Burner on for a throwaway account, and leave the risk gates checked.',
    shots: [
      {
        src: '/screenshots/features/burner.png',
        width: 522,
        height: 676,
        caption: 'Gates for unlimited approvals, unknown calls, high-value sends, permits, and domain mismatches. Fully ungate is optional.',
        alt: 'Burner Mode settings with gates for unlimited approvals, unknown calls, high-value sends, permits, and domain mismatches',
      },
    ],
  },
];

export const FEATURE_SHOTS = PRODUCT_FEATURES.flatMap(feature =>
  feature.shots.map(shot => ({ ...shot, featureTitle: feature.title })),
);

export const SUPPORTED_BROWSERS = [
  { id: 'chrome', name: 'Chrome' },
  { id: 'brave', name: 'Brave' },
  { id: 'opera', name: 'Opera' },
  { id: 'arc', name: 'Arc' },
] as const;

export type SupportedBrowserId = (typeof SUPPORTED_BROWSERS)[number]['id'];

export const NAV_LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/faq', label: 'FAQ' },
  { href: '/integrate', label: 'Integrate' },
  { href: '/security', label: 'Security' },
] as const;

export const FOOTER_EXTRA_LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/#download', label: 'Install' },
  { href: '/#contact', label: 'Contact' },
] as const;

export const PROVIDER = {
  uuid: '1337-dev-wallet-2026',
  name: '1337',
  rdns: 'io.1337.wallet',
  isMetaMask: true,
  is1337: true,
} as const;
