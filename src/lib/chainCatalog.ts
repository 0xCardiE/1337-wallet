import { applyOrder } from './listOrder';

/** Pre-seeded EVM chains with public RPCs (chainlist.org-style endpoints). */
export type ChainKind = 'mainnet' | 'testnet';

export interface ChainDefinition {
  chainId: number;
  name: string;
  shortName: string;
  kind: ChainKind;
  /** Defillama icon slug — see {@link chainLogoUri}. */
  logoSlug?: string;
  /** Explicit logo when Defillama has no mark yet. */
  logoURI?: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  /** Up to ~10 public RPC endpoints for the network picker. */
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

const MAINNET_CHAINS: ChainDefinition[] = [
  {
    chainId: 1,
    name: 'Ethereum',
    shortName: 'eth',
    kind: 'mainnet',
    logoSlug: 'ethereum',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://ethereum-rpc.publicnode.com',
      'https://eth.drpc.org',
      'https://rpc.ankr.com/eth',
      'https://rpc.mevblocker.io',
      'https://cloudflare-eth.com',
      'https://eth-mainnet.public.blastapi.io',
      'https://endpoints.omniatech.io/v1/eth/mainnet/public',
      'https://rpc.flashbots.net',
      'https://1rpc.io/eth',
      'https://eth.llamarpc.com',
    ],
    blockExplorerUrls: ['https://etherscan.io'],
  },
  {
    chainId: 8453,
    name: 'Base',
    shortName: 'base',
    kind: 'mainnet',
    logoSlug: 'base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://mainnet.base.org',
      'https://base-rpc.publicnode.com',
      'https://base.drpc.org',
      'https://rpc.ankr.com/base',
      'https://1rpc.io/base',
      'https://base.llamarpc.com',
      'https://base-mainnet.public.blastapi.io',
      'https://base.gateway.tenderly.co',
      'https://endpoints.omniatech.io/v1/base/mainnet/public',
      'https://base.meowrpc.com',
    ],
    blockExplorerUrls: ['https://basescan.org'],
  },
  {
    chainId: 42161,
    name: 'Arbitrum One',
    shortName: 'arb1',
    kind: 'mainnet',
    logoSlug: 'arbitrum',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum-one-rpc.publicnode.com',
      'https://arbitrum.drpc.org',
      'https://rpc.ankr.com/arbitrum',
      'https://1rpc.io/arb',
      'https://arbitrum.llamarpc.com',
      'https://arbitrum-one.public.blastapi.io',
      'https://arbitrum.gateway.tenderly.co',
      'https://endpoints.omniatech.io/v1/arbitrum/one/public',
      'https://arbitrum.meowrpc.com',
    ],
    blockExplorerUrls: ['https://arbiscan.io'],
  },
  {
    chainId: 10,
    name: 'Optimism',
    shortName: 'oeth',
    kind: 'mainnet',
    logoSlug: 'optimism',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://mainnet.optimism.io',
      'https://optimism-rpc.publicnode.com',
      'https://optimism.drpc.org',
      'https://rpc.ankr.com/optimism',
      'https://1rpc.io/op',
      'https://optimism.llamarpc.com',
      'https://optimism-mainnet.public.blastapi.io',
      'https://optimism.gateway.tenderly.co',
      'https://endpoints.omniatech.io/v1/op/mainnet/public',
      'https://optimism.meowrpc.com',
    ],
    blockExplorerUrls: ['https://optimistic.etherscan.io'],
  },
  {
    chainId: 137,
    name: 'Polygon',
    shortName: 'polygon',
    kind: 'mainnet',
    logoSlug: 'polygon',
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    rpcUrls: [
      'https://polygon-bor-rpc.publicnode.com',
      'https://polygon.drpc.org',
      'https://rpc.ankr.com/polygon',
      'https://1rpc.io/matic',
      'https://polygon.llamarpc.com',
      'https://polygon-mainnet.public.blastapi.io',
      'https://polygon.gateway.tenderly.co',
      'https://endpoints.omniatech.io/v1/matic/mainnet/public',
      'https://polygon.meowrpc.com',
      'https://polygon-rpc.com',
    ],
    blockExplorerUrls: ['https://polygonscan.com'],
  },
  {
    chainId: 56,
    name: 'BNB Smart Chain',
    shortName: 'bsc',
    kind: 'mainnet',
    logoSlug: 'binance',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: [
      'https://bsc-dataseed.binance.org',
      'https://bsc-dataseed1.defibit.io',
      'https://bsc-rpc.publicnode.com',
      'https://bsc.drpc.org',
      'https://rpc.ankr.com/bsc',
      'https://1rpc.io/bnb',
      'https://bsc.llamarpc.com',
      'https://bsc-mainnet.public.blastapi.io',
      'https://bsc.meowrpc.com',
      'https://endpoints.omniatech.io/v1/bsc/mainnet/public',
    ],
    blockExplorerUrls: ['https://bscscan.com'],
  },
  {
    chainId: 43114,
    name: 'Avalanche',
    shortName: 'avax',
    kind: 'mainnet',
    logoSlug: 'avalanche',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    rpcUrls: [
      'https://api.avax.network/ext/bc/C/rpc',
      'https://avalanche-c-chain-rpc.publicnode.com',
      'https://avalanche.drpc.org',
      'https://rpc.ankr.com/avalanche',
      'https://1rpc.io/avax/c',
      'https://avalanche.llamarpc.com',
      'https://ava-mainnet.public.blastapi.io/ext/bc/C/rpc',
      'https://endpoints.omniatech.io/v1/avax/mainnet/public',
      'https://avalanche.meowrpc.com',
      'https://avax.meowrpc.com',
    ],
    blockExplorerUrls: ['https://snowtrace.io'],
  },
  {
    chainId: 143,
    name: 'Monad',
    shortName: 'monad',
    kind: 'mainnet',
    logoSlug: 'monad',
    nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
    rpcUrls: [
      'https://rpc.monad.xyz',
      'https://rpc1.monad.xyz',
      'https://rpc2.monad.xyz',
      'https://rpc3.monad.xyz',
      'https://rpc-mainnet.monadinfra.com',
      'https://monad-mainnet.drpc.org',
      'https://monad.drpc.org',
      'https://monad-rpc.publicnode.com',
      'https://rpc.ankr.com/monad',
      'https://monad.llamarpc.com',
    ],
    blockExplorerUrls: ['https://monadvision.com'],
  },
  {
    chainId: 4326,
    name: 'MegaETH',
    shortName: 'megaeth',
    kind: 'mainnet',
    logoSlug: 'megaeth',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://mainnet.megaeth.com/rpc',
      'https://megaeth.drpc.org',
      'https://rpc.ankr.com/megaeth',
      'https://megaeth-rpc.publicnode.com',
      'https://megaeth.llamarpc.com',
      'https://rpc.megaeth.io',
      'https://mainnet.megaeth.io/rpc',
      'https://endpoints.omniatech.io/v1/megaeth/mainnet/public',
      'https://1rpc.io/megaeth',
      'https://megaeth.meowrpc.com',
    ],
    blockExplorerUrls: ['https://mega.etherscan.io'],
  },
  {
    chainId: 4663,
    name: 'Robinhood Chain',
    shortName: 'hood',
    kind: 'mainnet',
    logoSlug: 'robinhood',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://rpc.mainnet.chain.robinhood.com',
      'https://robinhood.drpc.org',
      'https://rpc.ankr.com/robinhood',
      'https://robinhood-rpc.publicnode.com',
      'https://endpoints.omniatech.io/v1/robinhood/mainnet/public',
      'https://1rpc.io/robinhood',
      'https://robinhood.llamarpc.com',
      'https://rpc.robinhoodchain.com',
      'https://mainnet.robinhoodchain.com/rpc',
      'https://rpc.hoodchain.io',
    ],
    blockExplorerUrls: ['https://robinhoodchain.blockscout.com'],
  },
  {
    chainId: 80094,
    name: 'Berachain',
    shortName: 'bera',
    kind: 'mainnet',
    logoSlug: 'berachain',
    nativeCurrency: { name: 'Bera', symbol: 'BERA', decimals: 18 },
    rpcUrls: [
      'https://rpc.berachain.com',
      'https://berachain.drpc.org',
      'https://rpc.ankr.com/berachain',
      'https://berachain-rpc.publicnode.com',
      'https://berachain.llamarpc.com',
      'https://1rpc.io/berachain',
      'https://berachain.meowrpc.com',
      'https://endpoints.omniatech.io/v1/berachain/mainnet/public',
      'https://berachain-mainnet.public.blastapi.io',
      'https://rpc.berachain-apis.com',
    ],
    blockExplorerUrls: ['https://berascan.com'],
  },
  {
    chainId: 146,
    name: 'Sonic',
    shortName: 'sonic',
    kind: 'mainnet',
    logoSlug: 'sonic',
    nativeCurrency: { name: 'Sonic', symbol: 'S', decimals: 18 },
    rpcUrls: [
      'https://rpc.soniclabs.com',
      'https://sonic.drpc.org',
      'https://rpc.ankr.com/sonic_mainnet',
      'https://sonic-rpc.publicnode.com',
      'https://sonic.llamarpc.com',
      'https://1rpc.io/sonic',
      'https://sonic.meowrpc.com',
      'https://endpoints.omniatech.io/v1/sonic/mainnet/public',
      'https://sonic-mainnet.public.blastapi.io',
      'https://rpc.sonic.game',
    ],
    blockExplorerUrls: ['https://sonicscan.org'],
  },
  {
    chainId: 130,
    name: 'Unichain',
    shortName: 'uni',
    kind: 'mainnet',
    logoSlug: 'unichain',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://mainnet.unichain.org',
      'https://unichain.drpc.org',
      'https://rpc.ankr.com/unichain',
      'https://unichain-rpc.publicnode.com',
      'https://unichain.llamarpc.com',
      'https://1rpc.io/unichain',
      'https://unichain.meowrpc.com',
      'https://endpoints.omniatech.io/v1/unichain/mainnet/public',
      'https://unichain-mainnet.public.blastapi.io',
      'https://rpc.unichain.org',
    ],
    blockExplorerUrls: ['https://uniscan.xyz'],
  },
  {
    chainId: 999,
    name: 'HyperEVM',
    shortName: 'hyperliquid',
    kind: 'mainnet',
    logoSlug: 'hyperliquid',
    nativeCurrency: { name: 'Hyperliquid', symbol: 'HYPE', decimals: 18 },
    rpcUrls: [
      'https://rpc.hyperliquid.xyz/evm',
      'https://hyperliquid.drpc.org',
      'https://rpc.ankr.com/hyperliquid',
      'https://hyperliquid-rpc.publicnode.com',
      'https://hyperliquid.llamarpc.com',
      'https://1rpc.io/hyperliquid',
      'https://hyperliquid.meowrpc.com',
      'https://endpoints.omniatech.io/v1/hyperliquid/mainnet/public',
      'https://hyperliquid-mainnet.public.blastapi.io',
      'https://rpc.hypurrscan.io',
    ],
    blockExplorerUrls: ['https://hyperevmscan.io'],
  },
  {
    chainId: 59144,
    name: 'Linea',
    shortName: 'linea',
    kind: 'mainnet',
    logoSlug: 'linea',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://rpc.linea.build',
      'https://linea-rpc.publicnode.com',
      'https://linea.drpc.org',
      'https://rpc.ankr.com/linea',
      'https://1rpc.io/linea',
      'https://linea.llamarpc.com',
      'https://linea-mainnet.public.blastapi.io',
      'https://linea.gateway.tenderly.co',
      'https://endpoints.omniatech.io/v1/linea/mainnet/public',
      'https://linea.meowrpc.com',
    ],
    blockExplorerUrls: ['https://lineascan.build'],
  },
  {
    chainId: 534352,
    name: 'Scroll',
    shortName: 'scroll',
    kind: 'mainnet',
    logoSlug: 'scroll',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://rpc.scroll.io',
      'https://scroll-rpc.publicnode.com',
      'https://scroll.drpc.org',
      'https://rpc.ankr.com/scroll',
      'https://1rpc.io/scroll',
      'https://scroll.llamarpc.com',
      'https://scroll-mainnet.public.blastapi.io',
      'https://scroll.gateway.tenderly.co',
      'https://endpoints.omniatech.io/v1/scroll/mainnet/public',
      'https://scroll.meowrpc.com',
    ],
    blockExplorerUrls: ['https://scrollscan.com'],
  },
  {
    chainId: 324,
    name: 'zkSync Era',
    shortName: 'zksync',
    kind: 'mainnet',
    logoSlug: 'zksync-era',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://mainnet.era.zksync.io',
      'https://zksync.drpc.org',
      'https://rpc.ankr.com/zksync_era',
      'https://zksync-era-rpc.publicnode.com',
      'https://1rpc.io/zksync2-era',
      'https://zksync.llamarpc.com',
      'https://zksync-era-mainnet.public.blastapi.io',
      'https://endpoints.omniatech.io/v1/zksync-era/mainnet/public',
      'https://zksync.meowrpc.com',
      'https://zksync-era.gateway.tenderly.co',
    ],
    blockExplorerUrls: ['https://explorer.zksync.io'],
  },
  {
    chainId: 81457,
    name: 'Blast',
    shortName: 'blast',
    kind: 'mainnet',
    logoSlug: 'blast',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://rpc.blast.io',
      'https://blast-rpc.publicnode.com',
      'https://blast.drpc.org',
      'https://rpc.ankr.com/blast',
      'https://1rpc.io/blast',
      'https://blast.llamarpc.com',
      'https://blast-mainnet.public.blastapi.io',
      'https://blast.gateway.tenderly.co',
      'https://endpoints.omniatech.io/v1/blast/mainnet/public',
      'https://blast.meowrpc.com',
    ],
    blockExplorerUrls: ['https://blastscan.io'],
  },
  {
    chainId: 5000,
    name: 'Mantle',
    shortName: 'mantle',
    kind: 'mainnet',
    logoSlug: 'mantle',
    nativeCurrency: { name: 'Mantle', symbol: 'MNT', decimals: 18 },
    rpcUrls: [
      'https://rpc.mantle.xyz',
      'https://mantle-rpc.publicnode.com',
      'https://mantle.drpc.org',
      'https://rpc.ankr.com/mantle',
      'https://1rpc.io/mantle',
      'https://mantle.llamarpc.com',
      'https://mantle-mainnet.public.blastapi.io',
      'https://endpoints.omniatech.io/v1/mantle/mainnet/public',
      'https://mantle.meowrpc.com',
      'https://mantle.gateway.tenderly.co',
    ],
    blockExplorerUrls: ['https://mantlescan.xyz'],
  },
  {
    chainId: 57073,
    name: 'Ink',
    shortName: 'ink',
    kind: 'mainnet',
    logoSlug: 'ink',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://rpc-gel.inkonchain.com',
      'https://ink.drpc.org',
      'https://rpc.ankr.com/ink',
      'https://ink-rpc.publicnode.com',
      'https://ink.llamarpc.com',
      'https://1rpc.io/ink',
      'https://ink.meowrpc.com',
      'https://endpoints.omniatech.io/v1/ink/mainnet/public',
      'https://ink-mainnet.public.blastapi.io',
      'https://rpc.inkonchain.com',
    ],
    blockExplorerUrls: ['https://explorer.inkonchain.com'],
  },
  {
    chainId: 2741,
    name: 'Abstract',
    shortName: 'abstract',
    kind: 'mainnet',
    logoSlug: 'abstract',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://api.mainnet.abs.xyz',
      'https://abstract.drpc.org',
      'https://rpc.ankr.com/abstract',
      'https://abstract-rpc.publicnode.com',
      'https://abstract.llamarpc.com',
      'https://1rpc.io/abstract',
      'https://abstract.meowrpc.com',
      'https://endpoints.omniatech.io/v1/abstract/mainnet/public',
      'https://abstract-mainnet.public.blastapi.io',
      'https://rpc.abs.xyz',
    ],
    blockExplorerUrls: ['https://abscan.org'],
  },
  {
    chainId: 100,
    name: 'Gnosis',
    shortName: 'gno',
    kind: 'mainnet',
    logoSlug: 'gnosis',
    nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
    rpcUrls: [
      'https://rpc.gnosischain.com',
      'https://gnosis-rpc.publicnode.com',
      'https://gnosis.drpc.org',
      'https://rpc.ankr.com/gnosis',
      'https://1rpc.io/gnosis',
      'https://gnosis.llamarpc.com',
      'https://gnosis-mainnet.public.blastapi.io',
      'https://endpoints.omniatech.io/v1/gnosis/mainnet/public',
      'https://gnosis.gateway.tenderly.co',
      'https://rpc.gnosis.gateway.fm',
    ],
    blockExplorerUrls: ['https://gnosisscan.io'],
  },
];

const TESTNET_CHAINS: ChainDefinition[] = [
  {
    chainId: 11155111,
    name: 'Sepolia',
    shortName: 'sep',
    kind: 'testnet',
    logoSlug: 'ethereum',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://sepolia.drpc.org',
      'https://rpc.sepolia.org',
      'https://rpc.ankr.com/eth_sepolia',
      'https://1rpc.io/sepolia',
      'https://sepolia.llamarpc.com',
      'https://eth-sepolia.public.blastapi.io',
      'https://endpoints.omniatech.io/v1/eth/sepolia/public',
      'https://sepolia.gateway.tenderly.co',
      'https://sepolia.meowrpc.com',
    ],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  },
  {
    chainId: 84532,
    name: 'Base Sepolia',
    shortName: 'base-sep',
    kind: 'testnet',
    logoSlug: 'base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://sepolia.base.org',
      'https://base-sepolia-rpc.publicnode.com',
      'https://base-sepolia.drpc.org',
      'https://rpc.ankr.com/base_sepolia',
      'https://1rpc.io/base-sepolia',
      'https://base-sepolia.llamarpc.com',
      'https://base-sepolia.public.blastapi.io',
      'https://endpoints.omniatech.io/v1/base/sepolia/public',
      'https://base-sepolia.gateway.tenderly.co',
      'https://base-sepolia.meowrpc.com',
    ],
    blockExplorerUrls: ['https://sepolia.basescan.org'],
  },
  {
    chainId: 421614,
    name: 'Arbitrum Sepolia',
    shortName: 'arb-sep',
    kind: 'testnet',
    logoSlug: 'arbitrum',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://sepolia-rollup.arbitrum.io/rpc',
      'https://arbitrum-sepolia-rpc.publicnode.com',
      'https://arbitrum-sepolia.drpc.org',
      'https://rpc.ankr.com/arbitrum_sepolia',
      'https://1rpc.io/arb-sepolia',
      'https://arbitrum-sepolia.llamarpc.com',
      'https://arbitrum-sepolia.public.blastapi.io',
      'https://endpoints.omniatech.io/v1/arbitrum/sepolia/public',
      'https://arbitrum-sepolia.gateway.tenderly.co',
      'https://arbitrum-sepolia.meowrpc.com',
    ],
    blockExplorerUrls: ['https://sepolia.arbiscan.io'],
  },
  {
    chainId: 11155420,
    name: 'Optimism Sepolia',
    shortName: 'op-sep',
    kind: 'testnet',
    logoSlug: 'optimism',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://sepolia.optimism.io',
      'https://optimism-sepolia-rpc.publicnode.com',
      'https://optimism-sepolia.drpc.org',
      'https://rpc.ankr.com/optimism_sepolia',
      'https://1rpc.io/op-sepolia',
      'https://optimism-sepolia.llamarpc.com',
      'https://optimism-sepolia.public.blastapi.io',
      'https://endpoints.omniatech.io/v1/op/sepolia/public',
      'https://optimism-sepolia.gateway.tenderly.co',
      'https://optimism-sepolia.meowrpc.com',
    ],
    blockExplorerUrls: ['https://sepolia-optimism.etherscan.io'],
  },
  {
    chainId: 80002,
    name: 'Polygon Amoy',
    shortName: 'amoy',
    kind: 'testnet',
    logoSlug: 'polygon',
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    rpcUrls: [
      'https://rpc-amoy.polygon.technology',
      'https://polygon-amoy-rpc.publicnode.com',
      'https://polygon-amoy.drpc.org',
      'https://rpc.ankr.com/polygon_amoy',
      'https://1rpc.io/amoy',
      'https://polygon-amoy.llamarpc.com',
      'https://polygon-amoy.public.blastapi.io',
      'https://endpoints.omniatech.io/v1/polygon/amoy/public',
      'https://polygon-amoy.gateway.tenderly.co',
      'https://polygon-amoy.meowrpc.com',
    ],
    blockExplorerUrls: ['https://amoy.polygonscan.com'],
  },
  {
    chainId: 97,
    name: 'BSC Testnet',
    shortName: 'bsc-test',
    kind: 'testnet',
    logoSlug: 'bsc',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: [
      'https://data-seed-prebsc-1-s1.binance.org:8545',
      'https://bsc-testnet-rpc.publicnode.com',
      'https://bsc-testnet.drpc.org',
      'https://rpc.ankr.com/bsc_testnet_chapel',
      'https://1rpc.io/bnb-testnet',
      'https://bsc-testnet.llamarpc.com',
      'https://bsc-testnet.public.blastapi.io',
      'https://endpoints.omniatech.io/v1/bsc/testnet/public',
      'https://bsc-testnet.gateway.tenderly.co',
      'https://bsc-testnet.meowrpc.com',
    ],
    blockExplorerUrls: ['https://testnet.bscscan.com'],
  },
  {
    chainId: 10143,
    name: 'Monad Testnet',
    shortName: 'monad-test',
    kind: 'testnet',
    logoSlug: 'monad',
    nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
    rpcUrls: [
      'https://testnet-rpc.monad.xyz',
      'https://rpc.ankr.com/monad_testnet',
      'https://rpc-testnet.monadinfra.com',
      'https://monad-testnet.drpc.org',
      'https://monad-testnet-rpc.publicnode.com',
      'https://monad-testnet.llamarpc.com',
      'https://1rpc.io/monad-testnet',
      'https://endpoints.omniatech.io/v1/monad/testnet/public',
      'https://monad-testnet.meowrpc.com',
      'https://testnet.monad.xyz/rpc',
    ],
    blockExplorerUrls: ['https://testnet.monadvision.com'],
  },
  {
    chainId: 6342,
    name: 'MegaETH Testnet',
    shortName: 'megaeth-test',
    kind: 'testnet',
    logoSlug: 'megaeth',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://carrot.megaeth.com/rpc',
      'https://timothy.megaeth.com/rpc',
      'https://megaeth-testnet.drpc.org',
      'https://rpc.ankr.com/megaeth_testnet',
      'https://megaeth-testnet-rpc.publicnode.com',
      'https://megaeth-testnet.llamarpc.com',
      'https://1rpc.io/megaeth-testnet',
      'https://endpoints.omniatech.io/v1/megaeth/testnet/public',
      'https://megaeth-testnet.meowrpc.com',
      'https://testnet.megaeth.com/rpc',
    ],
    blockExplorerUrls: ['https://megaeth-testnet.explorer.com'],
  },
  {
    chainId: 46630,
    name: 'Robinhood Testnet',
    shortName: 'hood-test',
    kind: 'testnet',
    logoSlug: 'robinhood',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://rpc.testnet.chain.robinhood.com',
      'https://robinhood-testnet.drpc.org',
      'https://rpc.ankr.com/robinhood_testnet',
      'https://robinhood-testnet-rpc.publicnode.com',
      'https://robinhood-testnet.llamarpc.com',
      'https://1rpc.io/robinhood-testnet',
      'https://endpoints.omniatech.io/v1/robinhood/testnet/public',
      'https://robinhood-testnet.meowrpc.com',
      'https://testnet.robinhoodchain.com/rpc',
      'https://rpc.hoodchain-testnet.io',
    ],
    blockExplorerUrls: ['https://explorer.testnet.chain.robinhood.com'],
  },
];

/**
 * Default Networks list: well-known chains first, then the rest of the catalog
 * in existing relative order. Users can drag to override (`chainOrder` in settings).
 */
export const DEFAULT_MAINNET_ORDER = [
  1, 8453, 4663, 999, 56, 43114, 42161, 137, 143, 4326, 100,
] as const;

/** Testnets aligned with {@link DEFAULT_MAINNET_ORDER} (no HyperEVM/Avalanche/Gnosis testnet). */
export const DEFAULT_TESTNET_ORDER = [
  11155111, 84532, 46630, 97, 421614, 80002, 10143, 6342,
] as const;

function withSpotlightOrder(
  chains: ChainDefinition[],
  spotlight: readonly number[],
): ChainDefinition[] {
  const rank = new Map(spotlight.map((id, i) => [id, i]));
  return [...chains].sort((a, b) => {
    const ra = rank.get(a.chainId) ?? spotlight.length;
    const rb = rank.get(b.chainId) ?? spotlight.length;
    return ra - rb;
  });
}

/** Curated spotlight chains — mainnets first, then popular testnets. */
export const CHAIN_CATALOG: ChainDefinition[] = [
  ...withSpotlightOrder(MAINNET_CHAINS, DEFAULT_MAINNET_ORDER),
  ...withSpotlightOrder(TESTNET_CHAINS, DEFAULT_TESTNET_ORDER),
];

const byId = new Map<number, ChainDefinition>();
for (const c of CHAIN_CATALOG) byId.set(c.chainId, c);

/** User-added chains (persisted) — overlays catalog by chain id. */
let customChainsById = new Map<number, ChainDefinition>();

export function setCustomChains(chains: ChainDefinition[]): void {
  const next = new Map<number, ChainDefinition>();
  for (const c of chains) {
    if (!c || !Number.isFinite(c.chainId) || c.chainId <= 0) continue;
    if (byId.has(c.chainId)) continue; /* curated entries win */
    next.set(c.chainId, c);
  }
  customChainsById = next;
}

export function getCustomChains(): ChainDefinition[] {
  return [...customChainsById.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function allChains(): ChainDefinition[] {
  if (customChainsById.size === 0) return CHAIN_CATALOG;
  return [...CHAIN_CATALOG, ...getCustomChains()];
}

/** Catalog + custom chains, ranked by user `chainOrder` (unknown ids ignored, new chains last). */
export function chainsOrdered(kind?: ChainKind, order?: number[]): ChainDefinition[] {
  const list = chainsByKind(kind);
  if (!order?.length) return list;
  const byChainId = new Map(list.map(c => [c.chainId, c]));
  return applyOrder(
    list.map(c => c.chainId),
    order,
  )
    .map(id => byChainId.get(id))
    .filter((c): c is ChainDefinition => !!c);
}

export function chainById(chainId: number): ChainDefinition | undefined {
  return byId.get(chainId) ?? customChainsById.get(chainId);
}

export function chainsByKind(kind?: ChainKind): ChainDefinition[] {
  const list = allChains();
  if (!kind) return list;
  return list.filter(c => c.kind === kind);
}

export function allCatalogChainIds(): number[] {
  return allChains().map(c => c.chainId);
}

export function isCuratedChain(chainId: number): boolean {
  return byId.has(chainId);
}

export const MAX_RPC_OPTIONS = 10;
