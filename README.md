# 1337 Wallet

### An open-source EVM wallet for developers, hackers, and power users.

1337 is a self-custodial browser wallet built around one simple idea:

> **See the request. Understand the risk. Then sign.**

Instead of hiding transaction details behind a generic confirmation button, 1337 gives you the information you need to understand what a dapp is asking you to sign — including decoded calldata, contract information, local simulation results, and risk signals.

Open source. Self-custodial. No analytics. No 1337 backend.

<p align="center">
  <img src="brand/screenshots/wallet.png" width="380" alt="1337 Wallet" />
</p>

<p align="center">
  <a href="https://1337wallet.io/">Website</a>
  ·
  <a href="https://github.com/0xCardiE/1337-wallet">GitHub</a>
  ·
  <a href="docs/">Documentation</a>
</p>

---

## Why 1337?

Most wallets are designed around making signing as quick as possible.

1337 is designed around making signing **understandable**.

When a dapp asks you to sign a transaction, 1337 can show:

- What contract you're calling
- What function is being called
- Decoded parameters
- Full calldata
- Solidity source when available
- Local `eth_call` simulation
- Gas information
- Contract and transaction risk signals
- Whether the simulation succeeds, fails, or reverts

You decide whether the request makes sense.

**No blind signing.**

---

# See 1337 in action

## Understand what you're signing

Transaction confirmations are designed to expose what a dapp is actually asking you to do.

Inspect the decoded function, calldata, contract information, simulation result, and risk signals before signing.

<p align="center">
  <img src="brand/screenshots/confirm.png" width="800" alt="1337 transaction confirmation" />
</p>

---

## Control your RPC

Choose exactly which RPC endpoint your wallet uses.

1337 does not operate its own RPC infrastructure. You can select, reorder, test, and switch between endpoints directly from the wallet.

<p align="center">
  <img src="brand/screenshots/rpc.png" width="800" alt="1337 RPC management" />
</p>

---

## Check RPC health

RPC Doctor lets you test endpoints and see whether they are responding correctly.

When an endpoint becomes unavailable or unreliable, you can switch to another endpoint without changing your wallet or dapp setup.

<p align="center">
  <img src="brand/screenshots/rpc-doctor.png" width="800" alt="1337 RPC Doctor" />
</p>

---

## Manage approvals

Review token permissions directly from the wallet.

Supported approvals include:

- ERC-20 allowances
- NFT operator approvals
- Permit2 approvals

<p align="center">
  <img src="brand/screenshots/approvals.png" width="800" alt="1337 token approvals" />
</p>

---

## Swap across chains

Get token routes through **LI.FI**, inspect the resulting transaction, and sign it from the wallet.

<p align="center">
  <img src="brand/screenshots/swap.png" width="800" alt="1337 swaps" />
</p>

---

# Built for power users

<table>
<tr>
<td width="50%">

### Transaction inspection

<img src="brand/screenshots/confirm.png" width="100%" alt="Transaction inspection" />

Decode calls, inspect calldata, view Solidity source, and simulate transactions before signing.

</td>

<td width="50%">

### RPC control

<img src="brand/screenshots/rpc.png" width="100%" alt="RPC control" />

Choose your RPC per chain and check endpoint health with RPC Doctor.

</td>
</tr>

<tr>
<td width="50%">

### Approvals

<img src="brand/screenshots/approvals.png" width="100%" alt="Token approvals" />

Review and revoke ERC-20, NFT, and Permit2 permissions.

</td>

<td width="50%">

### Swaps

<img src="brand/screenshots/swap.png" width="100%" alt="Token swaps" />

Get cross-chain routes through LI.FI and review the transaction before signing.

</td>
</tr>
</table>

---

# Features

## Transaction confirmation

Every dapp transaction goes through a detailed confirmation flow.

Inspect the request before signing and see what is actually being sent to the network.

- Human-readable transaction summaries
- Function and selector decoding
- Solidity source when available
- Full calldata inspection
- Local transaction simulation
- Contract information
- Risk and danger flags
- Simulation success, failure, or revert state
- Hardware confirmation when using Ledger or Trezor

The goal is not to tell you what to sign.

The goal is to give you enough information to decide yourself.

---

## Multiple accounts

Manage multiple accounts from a single wallet.

Supported account types include:

- HD accounts derived from a seed phrase
- Imported private keys
- Ledger accounts
- Trezor accounts

Seed-based accounts use the standard Ethereum derivation path:

```text
m/44'/60'/0'/0/n
```

Switch between accounts directly from the wallet interface.

---

## Hardware wallets

1337 works with hardware wallets while keeping the signing operation on the device.

Supported:

- Ledger
- Trezor

Hardware accounts use the same transaction confirmation interface as software accounts.

The wallet prepares and explains the transaction, while the hardware device remains responsible for signing.

---

## RPC control

Choose exactly which RPC endpoint your wallet uses.

For each network you can:

- Select an RPC endpoint
- Switch between endpoints
- Reorder RPCs
- Set a preferred endpoint
- Test endpoint health
- Detect incorrect or unavailable endpoints
- Fail over to another healthy endpoint

The built-in **RPC Doctor** checks endpoints by probing the chain and reports their current status.

Mainnets and testnets use the same network interface.

---

## Approvals

Review token permissions directly from the wallet.

The approvals tool supports:

- ERC-20 allowances
- NFT operator approvals
- Permit2 approvals

You can inspect the spender and allowance and revoke permissions through the same confirmation flow used for normal transactions.

---

## Swaps

Swap tokens across networks using **LI.FI** routing.

1337 does not operate its own swap backend.

Instead:

1. Request a quote
2. Review the route
3. Review the transaction
4. Confirm the transaction
5. Sign with your wallet or hardware device

Cross-chain routes are provided by LI.FI.

---

## ENS

Register and manage `.eth` names directly from the wallet.

The ENS tools support:

- Name registration
- Name management
- Renewals
- Content hashes
- URLs
- ENS records

ENS operations go through the normal ENS controller flow and use the same transaction confirmation system.

---

## Multisend

Send assets to multiple addresses in a single transaction.

Paste a list of recipients and send:

- Native assets
- ERC-20 tokens

Multisend uses [Disperse](https://disperse.app/) where available.

Hardware wallets are supported through the same signing flow.

---

## Gas station

Need native gas on another network?

The Gas tool lets you quote a cross-chain gas top-up.

For example:

```text
Pay with USDC on Base
        ↓
Receive ETH on Ethereum
```

Select the destination chain, amount, source chain, and token, then review and sign the resulting transaction.

---

## Transaction history

Inspect detailed transaction history when an explorer API key is configured.

History includes fields such as:

- Transaction hash
- Nonce
- Sender
- Recipient
- Function
- Method ID
- Gas
- Explorer link

The wallet does not claim to retrieve transaction history through public RPCs alone. Explorer history uses the API key configured by the user.

---

## Inspect

An optional inspection tool lets you investigate on-chain objects directly from the wallet.

You can inspect:

- Addresses
- Tokens
- ENS names
- Transaction hashes

The tool is opt-in and can be enabled from **Settings → Tools**.

---

## Signings

Keep a local history of messages and typed-data signatures made through the wallet.

Signing history stays on the device.

---

## Burner mode

1337 includes an optional burner mode for disposable software-wallet accounts.

Useful for:

- Testing dapps
- Experimental interactions
- Automated workflows
- Temporary accounts

Risk gates can still pause potentially dangerous requests, including:

- Unlimited approvals
- Unknown contracts
- High-value transfers
- Permits
- SIWE/domain mismatches

Hardware wallets always require confirmation on the device.

---

# Privacy

1337 is designed so that the wallet does not need a central backend to operate.

### No analytics

There is no analytics or usage telemetry inside the extension.

### No 1337 backend

Wallet vaults and settings remain in the browser's local extension storage.

There is no 1337 server receiving your wallet data.

### No central account

There is no 1337 account that needs to know who you are or what addresses you use.

### Network requests are explicit

The extension communicates with external services only when functionality requires it, such as:

- Blockchain RPC endpoints
- LI.FI for swap routing
- Explorer APIs when you configure an API key
- Hardware-wallet SDKs
- Other explicitly used third-party services

The wallet itself does not operate an RPC, swap, or blockchain-indexing backend.

---

# Security

Security is treated as part of the wallet architecture rather than just a UI feature.

Software-wallet keys are encrypted with a user password before being stored in browser extension storage.

Hardware-wallet accounts keep their private keys on the hardware device.

The extension also uses [LavaMoat](https://github.com/LavaMoat/LavaMoat) to isolate application components and reduce supply-chain risk.

The project maintains dedicated documentation covering:

- Wallet security
- Key custody
- Hardware wallets
- Supply-chain protection
- LavaMoat
- Transaction signing
- Explorer integrations

See:

- [`docs/wallet-security.md`](docs/wallet-security.md)
- [`docs/signer.md`](docs/signer.md)

---

# Dapp compatibility

1337 provides a MetaMask-compatible `window.ethereum` provider.

This means existing EVM dapps can connect to 1337 without requiring a wallet-specific integration.

If a dapp already supports MetaMask, it can generally work with 1337.

The wallet can be opened as a browser side panel by default, with popup mode also available.

---

# Browser extension

1337 is built as a browser extension and integrates directly with the EVM dapp ecosystem.

The extension provides:

- An in-browser wallet interface
- Dapp connection support
- Transaction interception and confirmation
- Message and typed-data signing
- Network and RPC management
- Hardware-wallet support
- On-chain inspection
- Wallet tools

The extension can be installed on Chromium-based browsers including:

- Chrome
- Brave
- Opera
- Arc

<p align="center">
  <img src="brand/screenshots/wallet.png" width="380" alt="1337 browser extension" />
</p>

**[Install 1337 Wallet](https://1337wallet.io/)**

---

# Networks

1337 ships with a collection of popular EVM networks and public RPC endpoints.

Networks and RPC endpoints are user-configurable.

You can:

- Add supported networks
- Reorder networks
- Reorder RPC endpoints
- Select preferred endpoints
- Switch RPCs without changing networks
- Use mainnets and testnets from the same interface

The wallet does not force you to use a proprietary RPC.

---

# Open source

1337 is fully open source and released under the **MIT License**.

The source code is available on GitHub:

https://github.com/0xCardiE/1337-wallet

Contributions, issues, security reviews, integrations, and feedback are welcome.

---

# Development

## Requirements

- Node.js
- npm
- Python + Pillow for icon generation

## Install

```bash
npm install
```

## Generate icons

```bash
npm run icons
```

Icon generation requires Pillow:

```bash
python3 -m pip install Pillow
```

or on Debian/Ubuntu:

```bash
sudo apt install python3-pil
```

## Build

```bash
npm run build
```

This builds the extension using Webpack and applies the project's LavaMoat configuration.

## Package for the Chrome Web Store

```bash
npm run package:store
```

The production extension is packaged into:

```text
release/1337-wallet-<version>.zip
```

Upload the generated ZIP to the Chrome Web Store.

---

# Running locally

Build the extension:

```bash
npm install
npm run build
```

Then open:

```text
chrome://extensions
```

Enable **Developer mode** and choose **Load unpacked**.

Select the generated:

```text
dist/
```

directory.

---

# Testing

Install Playwright's Chromium browser:

```bash
npx playwright install chromium
```

Run unit tests:

```bash
npm run test:unit
```

Run the extension end-to-end tests:

```bash
npm run test:e2e
```

The project uses Vitest for unit testing and Playwright for browser-level testing.

Hardware wallets and live dapp integrations require additional manual testing.

---

# Architecture

The extension is composed of several browser-extension components, including:

- Wallet UI
- Background service
- Content scripts
- In-page dapp provider
- Transaction signer
- Network/RPC management
- Hardware wallet integrations

The build uses Webpack and LavaMoat.

LavaMoat protections are applied to the background and UI bundles, while the dapp-facing content/in-page components operate outside those compartments where required for browser dapp compatibility.

---

# Project structure

```text
.
├── brand/                 # Brand and product assets
│   └── screenshots/       # README product screenshots
├── docs/                  # Documentation
├── e2e/                   # End-to-end tests
├── lavamoat/              # LavaMoat security policies
├── public/                # Static assets
├── release/               # Packaged releases
├── scripts/               # Build and development scripts
├── src/                   # Extension source
├── tests/unit/             # Unit tests
├── wallet-research/        # Local wallet research tooling
├── webpack/               # Webpack configuration
├── website/               # Website
├── package.json
└── README.md
```

---

# Design philosophy

1337 is built around a few principles.

### Understand before signing

Transactions should expose enough information for users to understand what they are approving.

### Self-custody

Users control their keys and signing devices.

### Privacy

A wallet should not need a central service to know what its users are doing.

### User-controlled infrastructure

Users should be able to choose their RPC endpoints instead of being locked into a wallet-operated RPC.

### Developer-first

EVM developers and power users often need more information than a simplified consumer wallet provides.

1337 puts that information directly in the signing flow.

---

# Disclaimer

1337 is self-custodial software.

You are responsible for your keys, signing decisions, transactions, and assets.

Always verify transaction details before signing. Hardware wallets provide an additional signing boundary, but you should still review transactions carefully.

---

# Links

- **Website:** https://1337wallet.io/
- **GitHub:** https://github.com/0xCardiE/1337-wallet
- **Documentation:** [`docs/`](docs/)
- **Security:** [`docs/wallet-security.md`](docs/wallet-security.md)
- **Signer architecture:** [`docs/signer.md`](docs/signer.md)

---

# License

MIT
