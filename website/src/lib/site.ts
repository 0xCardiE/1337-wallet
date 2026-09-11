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
    id: 'confirm',
    kicker: 'Confirm sheet',
    title: 'Read it. Then sign.',
    hook: 'Every send and dapp request opens a human summary, a local simulate, and the contract you are talking to. Expand for selector, Solidity source, and raw calldata. Hardware still confirms on the device.',
    tryIt: 'Connect a dapp, send a token, and watch the sheet decode it before you tap Confirm.',
    shots: [
      {
        src: '/screenshots/features/confirm-summary.png',
        width: 503,
        height: 353,
        caption: 'Human line first: “Send tokens.” Local simulate on the current chain. Verified proxy, owner, implementation.',
        alt: '1337 confirm sheet summarizing a token transfer, with a successful simulation and Derive marked as a verified proxy',
      },
      {
        src: '/screenshots/features/confirm-decode.png',
        width: 488,
        height: 630,
        caption: 'Then the decode: selector, likely function, and the Solidity from the explorer — not a blob of hex.',
        alt: 'Confirm overview showing eth_sendTransaction fields, ERC-20 transfer decode, and OpenZeppelin transfer source',
      },
      {
        src: '/screenshots/features/confirm-hardware.png',
        width: 502,
        height: 398,
        caption: 'Calldata if you want it. Reject here, or Confirm on Trezor — the device is the last word.',
        alt: 'Confirm sheet calldata for an ERC-20 transfer with Reject and Confirm on Trezor buttons',
      },
    ],
  },
  {
    id: 'networks',
    kicker: 'Networks',
    title: 'Your chain. Your RPC.',
    hook: 'Mainnets and testnets in the same shell. Pick the endpoint, see latency, and fail over when one is slow. No lock-in to a 1337 RPC — there is no 1337 RPC.',
    tryIt: 'Open Assets, switch the Ethereum RPC, then flip to Sepolia.',
    shots: [
      {
        src: '/screenshots/features/assets.png',
        width: 499,
        height: 518,
        caption: 'Balances with USD. Chain and RPC in the header. A health pill and Doctor when something looks off.',
        alt: 'Assets tab on Ethereum showing Derive, Swarm, and Virtuals balances with chain and RPC pickers',
      },
      {
        src: '/screenshots/features/rpc.png',
        width: 503,
        height: 532,
        caption: 'Curated public endpoints per chain. Health and latency on the list. Switch in one click.',
        alt: 'RPC dropdown listing PublicNode, dRPC, MEV Blocker, Cloudflare, and other Ethereum endpoints',
      },
      {
        src: '/screenshots/features/testnets.png',
        width: 508,
        height: 560,
        caption: 'Sepolia, Base Sepolia, Arbitrum Sepolia, Amoy — same UI as mainnet. No settings hunt.',
        alt: 'Testnets chain picker open on Sepolia with Base Sepolia, Arbitrum Sepolia, and other testnets listed',
      },
    ],
  },
  {
    id: 'history',
    kicker: 'History',
    title: 'Your txs, in English',
    hook: '“Approved token spending,” not a raw hash dump. Copy fields, open the explorer. History comes from your explorer key — we do not pretend a public RPC can list your life.',
    tryIt: 'Paste an explorer key in Settings, then open History.',
    shots: [
      {
        src: '/screenshots/features/history.png',
        width: 493,
        height: 433,
        caption: 'Expanded row: hash, nonce, from, to, function, method ID, gas. Etherscan one click away.',
        alt: 'History tab showing an expanded Approved token spending transaction with copyable fields and an Etherscan link',
      },
    ],
  },
  {
    id: 'approvals',
    kicker: 'Approvals',
    title: 'Revoke what you approved',
    hook: 'ERC-20, NFT operators, and Permit2 in one list. Revoke goes through the same confirm sheet as a send.',
    tryIt: 'Tools → Approvals. Hit Revoke on a leftover spender.',
    shots: [
      {
        src: '/screenshots/features/approvals.png',
        width: 493,
        height: 389,
        caption: 'Token, spender, last tx, remaining allowance. Revoke is the point of the screen.',
        alt: 'Approvals tool listing token allowances with Revoke buttons and spender addresses',
      },
    ],
  },
  {
    id: 'swap',
    kicker: 'Swap',
    title: 'Cross-chain quote. You still sign.',
    hook: 'LI.FI finds the route. 1337 does not run a swap backend. You confirm — on hardware, on the device.',
    tryIt: 'Tools → Swap. Quote ETH for another token.',
    shots: [
      {
        src: '/screenshots/features/swap.png',
        width: 473,
        height: 483,
        caption: 'Amount, 25/50/75/MAX, Get quote. Route and estimate sit under the button until you sign.',
        alt: 'Swap tool quoting ETH to 1INCH via LI.FI with percent amount buttons and Get quote',
      },
    ],
  },
  {
    id: 'multisend',
    kicker: 'Multisend',
    title: 'One tx. Many addresses.',
    hook: 'Paste a list. Disperse.app batches native or ERC-20. No contract fee. Leftover ETH comes back to you.',
    tryIt: 'Tools → Multisend. Three addresses, one send.',
    shots: [
      {
        src: '/screenshots/features/multisend.png',
        width: 499,
        height: 563,
        caption: 'Recipients, amount per line, optional ERC-20. Always Disperse.app — not a CREATE2 lab.',
        alt: 'Multisend tool using Disperse.app with three recipient addresses and amount per recipient',
      },
    ],
  },
  {
    id: 'gas',
    kicker: 'Gas station',
    title: 'Stuck without gas?',
    hook: 'Need ETH on Ethereum and you are sitting on Base USDC? Quote a native top-up. You sign the route.',
    tryIt: 'Tools → Gas. Pick the chain you need native on.',
    shots: [
      {
        src: '/screenshots/features/gas.png',
        width: 504,
        height: 416,
        caption: 'Destination chain, native amount, pay-from chain, pay-with token. Not a generic gas estimate.',
        alt: 'Gas station quoting 0.2 ETH on Ethereum paid from Base USDC',
      },
    ],
  },
  {
    id: 'doctor',
    kicker: 'Network doctor',
    title: 'Probe every RPC',
    hook: 'Who passed chainId, who needs an API key, who is actually healthy. Failover prefers the live ones.',
    tryIt: 'Hit Doctor next to the RPC pill on Assets.',
    shots: [
      {
        src: '/screenshots/features/doctor.png',
        width: 498,
        height: 783,
        caption: 'Probe all, use a healthy one, or clear preferred. Ankr yelling for a key is a feature, not a crash.',
        alt: 'Network doctor listing Ethereum RPC endpoints as healthy or unknown with Probe all RPCs',
      },
    ],
  },
  {
    id: 'accounts',
    kicker: 'Accounts',
    title: 'Seed, Trezor, Ledger, a key',
    hook: 'One switcher. Mark a software wallet as a burner. Hardware always confirms on the device.',
    tryIt: 'Open the account menu. Add Ledger or Trezor in Settings.',
    shots: [
      {
        src: '/screenshots/features/accounts.png',
        width: 508,
        height: 343,
        caption: 'Burner seed, vault seed, Trezor, Ledger, imported key — pick the active account and go.',
        alt: 'Account switcher listing a burner seed, vault seed, Trezor, Ledger, and a private-key account',
      },
    ],
  },
  {
    id: 'tools',
    kicker: 'Tools',
    title: 'Hide what you do not use',
    hook: 'Signings, Approvals, Swap, ENS, Multisend, Gas. Inspect stays off until you enable it. Confirm-time decode is always on.',
    tryIt: 'Settings → Tools. Uncheck anything you will not touch.',
    shots: [
      {
        src: '/screenshots/features/tools.png',
        width: 501,
        height: 460,
        caption: 'A signer, not a lab. Inspect is a search box you turn on — not a fourth tab.',
        alt: 'Tools settings with Signings, Approvals, Swap, ENS, Multisend, and Gas enabled, Inspect off',
      },
    ],
  },
  {
    id: 'burner',
    kicker: 'Burner Mode',
    title: 'Auto-sign, still gated',
    hook: 'Ordinary dapp noise can auto-sign on a disposable key. Unlimited approvals, unknown contracts, permits, and SIWE mismatches still pause — unless you ungate them.',
    tryIt: 'Flip Burner on a throwaway account. Leave the gates on.',
    shots: [
      {
        src: '/screenshots/features/burner.png',
        width: 494,
        height: 652,
        caption: 'Per-risk gates and a native-value threshold. Fully ungate is opt-in. Hardware still confirms on the device.',
        alt: 'Burner Mode settings with gates for unlimited approvals, unknown calls, high-value sends, permits, and domain mismatches',
      },
    ],
  },
];

export const FEATURE_SHOTS = PRODUCT_FEATURES.flatMap(feature =>
  feature.shots.map(shot => ({ ...shot, featureTitle: feature.title })),
);

export const NAV_LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/faq', label: 'FAQ' },
  { href: '/integrate', label: 'Integrate' },
  { href: '/security', label: 'Security' },
] as const;

export const FOOTER_EXTRA_LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/#contact', label: 'Contact' },
] as const;

export const PROVIDER = {
  uuid: '1337-dev-wallet-2026',
  name: '1337',
  rdns: 'io.1337.wallet',
  isMetaMask: true,
  is1337: true,
} as const;

