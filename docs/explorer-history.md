# Transaction history and explorer APIs

1337 History (and Approvals log discovery) is **indexed explorer data**, not something a public RPC can list by address. One optional Etherscan v2 key in Settings is the default path. Blockscout-hosted explorers skip the key.

Checked against [Etherscan supported chains](https://docs.etherscan.io/supported-chains) on **2026-08-19**. That page is the live source of truth — coverage changes.

## What changed

This is **not a per-address fee**. `account.txlist` has always been “give me this address.” What changed (announced 22 Nov 2025): the **Free** plan no longer covers every chain. High-volume networks were pulled off Free so the remaining ~90% stay usable. The error you see on Optimism is:

> Free API access is not supported for this chain. Please upgrade your api plan for full chain coverage.

Paid **Lite** (all chains, community endpoints) and **Pro** are unaffected. **Verified source / ABI stay free on every Etherscan chain**, including OP and Base — confirm-sheet contract hints can still work when History does not.

Gnosis (100): community endpoints stay Free through **31 Aug 2026**, then Lite+ from **1 Sep 2026**. Gnosisscan UI itself shuts **11 Aug 2026**.

Scroll (534352): Etherscan API **deprecated 16 Apr 2026**. 1337 still links `scrollscan.com` for the browser; History via Etherscan v2 will fail.

Full Etherscan list is 60+ chains. Below is **1337’s catalog only**.

## 1337 catalog vs Etherscan Free

| Chain | ID | Etherscan community API | Notes |
| --- | ---: | --- | --- |
| Ethereum | 1 | Free | |
| Sepolia | 11155111 | Free | |
| Arbitrum One | 42161 | Free | |
| Arbitrum Sepolia | 421614 | Free | |
| Polygon | 137 | Free | |
| Polygon Amoy | 80002 | Free | |
| Linea | 59144 | Free | |
| Blast | 81457 | Free | |
| Mantle | 5000 | Free | |
| Unichain | 130 | Free | |
| Abstract | 2741 | Free | |
| Sonic | 146 | Free | |
| Berachain | 80094 | Free | |
| Monad | 143 | Free | Explorer is MonadVision, not *scan — History still hits Etherscan v2 by chain id |
| Monad Testnet | 10143 | Free | |
| MegaETH | 4326 | Free | |
| HyperEVM | 999 | Free | |
| **Optimism** | **10** | **Paid only** | Matches the screenshot |
| **Optimism Sepolia** | **11155420** | **Paid only** | |
| **Base** | **8453** | **Paid only** | |
| **Base Sepolia** | **84532** | **Paid only** | |
| **BNB Smart Chain** | **56** | **Paid only** | |
| **BSC Testnet** | **97** | **Paid only** | |
| **Avalanche** | **43114** | **Paid only** | Snowtrace / Routescan family |
| Gnosis | 100 | Free → paid 1 Sep 2026 | Prefer Blockscout after Gnosisscan shutdown |
| Scroll | 534352 | Deprecated | Use Blockscout |
| zkSync Era | 324 | Not on Etherscan v2 | Official UI is `explorer.zksync.io` |
| Ink | 57073 | Not on Etherscan v2 | Official explorer **is** Blockscout |
| Robinhood Chain | 4663 | Not on Etherscan | Catalog already uses Blockscout |
| Robinhood Testnet | 46630 | Not on Etherscan | `explorer.testnet.chain.robinhood.com` |
| MegaETH Testnet | 6342 | Check | Etherscan lists MegaETH testnet as **6343**; 1337 catalogs **6342** |

Etherscan paid-only (entire product, not just 1337): OP, OP Sepolia, Base, Base Sepolia, BSC, BSC testnet, Avalanche C-Chain, Avalanche Fuji.

## What 1337 does

`src/lib/explorerApis.ts` + `src/lib/explorerTxHistory.ts`:

1. Catalog explorer is already Blockscout (Robinhood, Ink hostnames) → Blockscout `txlist`, no key.
2. Etherscan v2 when a key is present and the chain is on Etherscan (Free or paid).
3. If Etherscan returns the Free-tier coverage error **and** we have a Blockscout instance → retry there. Same for Approvals `getLogs`.
4. No key, but a Blockscout instance is mapped → Blockscout directly (Optimism, Base, Scroll, zkSync, Ink, Gnosis).

“Open on explorer” still uses the catalog URL (Optimistic Etherscan, Basescan, …). The Etherscan key is never sent to Blockscout.

Mapped Blockscout API origins:

| Chain | ID | API origin |
| --- | ---: | --- |
| Optimism | 10 | https://explorer.optimism.io |
| OP Sepolia | 11155420 | https://optimism-sepolia.blockscout.com |
| Base | 8453 | https://base.blockscout.com |
| Base Sepolia | 84532 | https://base-sepolia.blockscout.com |
| Scroll | 534352 | https://scroll.blockscout.com |
| zkSync Era | 324 | https://zksync.blockscout.com |
| Ink | 57073 | https://explorer.inkonchain.com |
| Gnosis | 100 | https://gnosis.blockscout.com |
| Robinhood | 4663 | catalog (`robinhoodchain.blockscout.com`) |

**No public Blockscout instance** for BSC (56) or Avalanche (43114). Those stay Etherscan Lite/Pro.

Source/ABI stay on Etherscan v2 (still Free on every Etherscan chain).

## RPC scan instead of an explorer? Don’t.

JSON-RPC has **no** `getTransactionsByAddress`. Public RPCs in the catalog are for `eth_call` / send / receipts, not an address index.

| Idea | Why it fails as History |
| --- | --- |
| Walk every block, inspect `from`/`to` | Ethereum is tens of millions of blocks; L2s are faster. A browser + public RPC will rate-limit, timeout, and still take days. |
| `eth_getLogs` for `Transfer` to/from the wallet | ERC-20/721 activity only. Misses native sends, many contract calls, failed txs with no logs, internals. |
| `trace_filter` / `debug_trace*` / Alchemy `getAssetTransfers` | Archive/vendor APIs. Not on `mainnet.optimism.io` and friends. Would be a new paid backend. |
| Txs this wallet already sent | Fine as a **local supplement** (we have the hash). Does not show incoming, other devices, or dapp-only activity. |

Honest History needs an indexer (Etherscan, Blockscout, Routescan). RPC stays for confirm-time simulate, receipts, and maybe merging locally sent hashes. Do not ship a block walker.

## Related

- Implementation: `src/lib/explorerApis.ts`, `src/lib/explorerTxHistory.ts`, `src/lib/etherscanV2.ts`, `src/ui/HistoryPanel.tsx`
- [Etherscan supported chains](https://docs.etherscan.io/supported-chains) · [Free-tier coverage note](https://info.etherscan.com/whats-changing-in-the-free-api-tier-coverage-and-why/) · [changelog](https://docs.etherscan.io/changelog)
- [Blockscout vs Etherscan chain table](https://docs.blockscout.com/devs/migrate-from-etherscan) · [instance list](https://github.com/blockscout/chainscout/blob/main/data/chains.json)
- [signer.md](./signer.md) — History is a signer surface; this is not an explorer lab
