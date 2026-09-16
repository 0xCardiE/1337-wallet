export type RpcStatus = 'yes' | 'empty' | 'fallback' | 'no' | 'off';

export type RpcMethodRow = {
  method: string;
  status: RpcStatus;
  weDo: string;
  dappsUse: string;
};

export type RpcMethodGroup = {
  id: string;
  title: string;
  nav?: string;
  lead: string;
  rows: RpcMethodRow[];
};

export const RPC_STATUS_LABEL: Record<RpcStatus, string> = {
  yes: 'Supported',
  empty: 'Answers empty',
  fallback: 'Dapp fallback',
  no: 'Not implemented',
  off: 'Disabled',
};

export const RPC_METHOD_GROUPS: RpcMethodGroup[] = [
  {
    id: 'connect',
    title: 'Connect & accounts',
    lead: 'What Uniswap, Aave, Pendle, and Curve call first.',
    rows: [
      {
        method: 'eth_requestAccounts',
        status: 'yes',
        weDo: 'Unlock + connect this origin to the active account.',
        dappsUse: 'Connect button. Wagmi / RainbowKit injected connector.',
      },
      {
        method: 'eth_accounts',
        status: 'yes',
        weDo: 'Return the connected address, or [] if this site is not authorized.',
        dappsUse: 'Silent “already connected?” check.',
      },
      {
        method: 'wallet_requestPermissions / wallet_getPermissions / wallet_revokePermissions',
        status: 'yes',
        weDo: 'EIP-2255 around eth_accounts. Disconnect clears this origin.',
        dappsUse: 'Connect / disconnect in the dapp UI.',
      },
    ],
  },
  {
    id: 'chain',
    title: 'Chain',
    lead: 'Aave markets, Pendle, and Curve hop L2s constantly.',
    rows: [
      {
        method: 'eth_chainId / net_version',
        status: 'yes',
        weDo: 'Active chain as hex / decimal string.',
        dappsUse: 'Know which network the signer is on.',
      },
      {
        method: 'wallet_switchEthereumChain',
        status: 'yes',
        weDo: 'Switch if the chain is in the catalog.',
        dappsUse: '“Switch to Arbitrum” before a market.',
      },
      {
        method: 'wallet_addEthereumChain',
        status: 'yes',
        weDo: 'Switch if the chain is already in Networks. Ignores dapp RPCs. Unknown chain → 4902 (add it yourself).',
        dappsUse: 'Same as switch for catalog chains. New networks are added in the wallet, not by the page.',
      },
      {
        method: 'wallet_watchAsset',
        status: 'yes',
        weDo: 'Confirm sheet. ERC-20 on the active chain. On-chain symbol/decimals when RPC works; NFT types stay 4200.',
        dappsUse: '“Add token” after a swap or airdrop. Wagmi watchAsset / MetaMask EIP-747.',
      },
    ],
  },
  {
    id: 'sign',
    title: 'Sign & send',
    lead: 'The actual signer job. Confirm sheet + device on Ledger / Trezor.',
    rows: [
      {
        method: 'eth_sendTransaction',
        status: 'yes',
        weDo: 'Approve, swap, supply, lock, vote. One tx, local simulate.',
        dappsUse: 'Default write path for Aave, Pendle, Curve, Uniswap.',
      },
      {
        method: 'personal_sign',
        status: 'yes',
        weDo: 'SIWE / login messages. Hardware on the device.',
        dappsUse: 'Snapshot, some DAO logins.',
      },
      {
        method: 'eth_signTypedData / _v3 / _v4',
        status: 'yes',
        weDo: 'Permit2, EIP-2612 Permit, Pendle limit orders, Aave credit delegation. Nano S hashed EIP-712 if clear-sign is missing.',
        dappsUse: 'Gasless approve and off-chain orders.',
      },
      {
        method: 'eth_sign',
        status: 'off',
        weDo: 'Rejected (4200). Unsafe raw hash.',
        dappsUse: 'personal_sign or eth_signTypedData_v4.',
      },
    ],
  },
  {
    id: 'discover',
    title: 'Discovery (EIP-5792)',
    lead: 'Wagmi probes this after connect and after a swap.',
    rows: [
      {
        method: 'wallet_getCapabilities',
        status: 'empty',
        weDo: 'Always succeeds. Empty object per catalog chain. No atomic batch, no paymaster.',
        dappsUse: 'Falls back to eth_sendTransaction. We do not advertise wallet_sendCalls.',
      },
      {
        method: 'wallet_sendCalls / wallet_getCallsStatus / wallet_showCallsStatus',
        status: 'fallback',
        weDo: 'Not implemented (4200). Capabilities stay empty so honest dapps never call these.',
        dappsUse: 'Separate approve + send via eth_sendTransaction.',
      },
    ],
  },
  {
    id: 'read',
    title: 'Read RPC (proxied)',
    lead: 'Forwarded to the active chain RPC. Same as MetaMask’s built-in provider.',
    rows: [
      {
        method:
          'eth_call, eth_estimateGas, eth_getBalance, eth_getTransactionCount, eth_getCode, eth_getStorageAt, eth_blockNumber, eth_gasPrice, eth_maxPriorityFeePerGas, eth_feeHistory, eth_getBlockByNumber, eth_getBlockByHash, eth_getTransactionByHash, eth_getTransactionReceipt, eth_getLogs',
        status: 'yes',
        weDo: 'eth_call to the user’s preferred RPC for that chain.',
        dappsUse: 'Balances, quotes, receipts. Many dapps also hit their own RPC.',
      },
    ],
  },
  {
    id: 'missing',
    title: 'Not implemented. Dapp fallback',
    nav: 'Not implemented',
    lead: 'We do not stub these as success unless the spec allows a quiet no.',
    rows: [
      {
        method: 'web3_clientVersion / net_listening / eth_syncing / eth_coinbase',
        status: 'no',
        weDo: 'Not implemented. Cheap probes.',
        dappsUse: 'Ignored on error. Dapp already has accounts + chainId.',
      },
      {
        method: 'personal_ecRecover',
        status: 'no',
        weDo: 'Not implemented.',
        dappsUse: 'Dapp verifies the signature locally, or skips.',
      },
      {
        method: 'eth_subscribe / eth_unsubscribe',
        status: 'fallback',
        weDo: 'Not on the injected provider.',
        dappsUse: 'Dapp’s own WebSocket / HTTP RPC for new heads.',
      },
      {
        method: 'eth_getEncryptionPublicKey / eth_decrypt',
        status: 'off',
        weDo: 'Not implemented. Dead MetaMask APIs.',
        dappsUse: 'Nothing modern. Do not add.',
      },
    ],
  },
];
