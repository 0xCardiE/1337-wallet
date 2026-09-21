# 1337 Wallet

### An EVM wallet for hackers.

**Privacy · Power · Open source**

1337 is a self-custodial browser wallet for developers, hackers, and power users.

See what a dapp is asking you to sign. Inspect the request, decode the call, simulate the transaction, check the contract, choose your RPC, and then decide whether to sign.

**Open source. No analytics. No 1337 server.**

<p align="center">
  <img src="https://1337wallet.io/screenshots/features/assets.png?v=8" width="420" alt="1337 Wallet" />
</p>

<p align="center">
  <a href="https://1337wallet.io/">Website</a>
  ·
  <a href="https://github.com/0xCardiE/1337-wallet">GitHub</a>
  ·
  <a href="https://1337wallet.io/">Install</a>
</p>

---

## See the request. Then sign.

Most wallets try to make signing as quick as possible.

1337 is built to make signing **understandable**.

When a dapp sends a transaction, 1337 can expose:

- Transaction summary
- Function selector
- Decoded function and parameters
- Full calldata
- Solidity source when available
- Local `eth_call` simulation
- Contract information
- Proxy information
- Risk signals
- Gas information
- Simulation success, failure, or revert

You decide what the transaction means.

You decide whether to sign.

---

# The wallet

The main interface gives you your accounts, balances, networks, RPC endpoint, and tools in one place.

<p align="center">
  <img src="https://1337wallet.io/screenshots/features/assets.png?v=8" width="500" alt="1337 Wallet Assets" />
</p>

Switch between mainnets and testnets, change RPC endpoints, inspect endpoint health, and manage your assets without leaving the wallet.

---

# Detailed transaction confirmation

Every dapp transaction goes through a detailed confirmation flow.

Before signing, inspect the request and see what is actually being sent to the network.

<p align="center">
  <img src="https://1337wallet.io/screenshots/features/confirm-summary.png?v=8" width="600" alt="1337 transaction confirmation" />
</p>

The confirmation flow can show:

- What contract is being called
- What function is being executed
- Decoded parameters
- Contract verification information
- Proxy implementation information
- Local simulation results
- Transaction calldata
- Solidity source when available

<p align="center">
  <img src="https://1337wallet.io/screenshots/features/confirm-decode.png?v=8" width="600" alt="1337 transaction decoder" />
</p>

The purpose is simple:

> **Understand the request before you sign it.**

---

# RPC control

Your RPC is your choice.

1337 does not operate its own RPC infrastructure. You can choose the endpoint you want to use for each network.

<p align="center">
  <img src="https://1337wallet.io/screenshots/features/rpc.png?v=8" width="500" alt="1337 RPC picker" />
</p>

You can:

- Select an RPC endpoint
- Switch RPCs without changing networks
- Reorder RPC endpoints
- Set a preferred endpoint
- Use public RPCs
- Use your own endpoints
- Switch between mainnet and testnet RPCs

---

# RPC Doctor

Not sure whether an RPC is actually working?

RPC Doctor probes the endpoints configured for the active chain and reports their status.

<p align="center">
  <img src="https://1337wallet.io/screenshots/features/doctor.png?v=8" width="600" alt="1337 RPC Doctor" />
</p>

It checks:

- RPC availability
- `eth_chainId`
- HTTP errors
- API authorization problems
- Preferred endpoint health
- Endpoint latency

When an endpoint is unavailable, healthy endpoints can be used for failover.

---

# Approvals

See and revoke token permissions directly from the wallet.

<p align="center">
  <img src="https://1337wallet.io/screenshots/features/approvals.png?v=8" width="600" alt="1337 token approvals" />
</p>

Supported:

- ERC-20 allowances
- NFT operator approvals
- Permit2 approvals

Revoking an approval uses the same transaction confirmation flow as other transactions.

---

# Swaps

Get token swap routes through **LI.FI**.

1337 does not operate its own swap backend.

<p align="center">
  <img src="https://1337wallet.io/screenshots/features/swap.png?v=8" width="500" alt="1337 token swap" />
</p>

The flow is:

1. Select the source token
2. Select the destination token
3. Enter the amount
4. Request a quote
5. Review the route
6. Review the transaction
7. Sign

Cross-chain routes are provided by LI.FI.

---

# ENS

Register and manage `.eth` names directly from the wallet.

<p align="center">
  <img src="https://1337wallet.io/screenshots/features/ens-register.png?v=8" width="600" alt="1337 ENS registration" />
</p>

ENS functionality includes:

- Registering names
- Managing names
- Renewing names
- Content hashes
- URLs
- ENS records

ENS registration follows the standard commit → wait → register flow.

---

# Multisend

Send native assets or ERC-20 tokens to multiple addresses in one transaction.

<p align="center">
  <img src="https://1337wallet.io/screenshots/features/multisend.png?v=8" width="600" alt="1337 Multisend" />
</p>

Paste recipient addresses, specify the amount, and send through Disperse.

---

# Gas Station

Need native gas on another network?

The Gas tool lets you quote a cross-chain gas top-up.

For example:

```text
USDC on Base
      ↓
    route
      ↓
ETH on Ethereum
```

Choose the destination chain, amount, source chain, and token you want to pay with.

---

# Multiple accounts

Manage different account types from the same interface.

<p align="center">
  <img src="https://1337wallet.io/screenshots/features/accounts-passport.png?v=8" width="500" alt="1337 account switcher" />
</p>

Supported accounts include:

- Seed-derived accounts
- Imported private keys
- Ledger
- Trezor

Seed-derived accounts use the standard Ethereum derivation path:

```text
m/44'/60'/0'/0/n
```

Hardware wallets continue to keep the private key on the device.

---

# Hardware wallets

1337 supports:

- Ledger
- Trezor

Hardware accounts use the same transaction inspection flow as software accounts.

1337 prepares and explains the transaction.

The hardware device still has to approve the signature.

---

# Burner mode

1337 includes an optional Burner Mode for disposable software-wallet accounts.

<p align="center">
  <img src="https://1337wallet.io/screenshots/features/burner.png?v=8" width="600" alt="1337 Burner Mode" />
</p>

Burner Mode can automatically sign ordinary dapp requests while still pausing on configurable risk gates such as:

- Unlimited token approvals
- Unknown contract calls
- High-value sends
- Permit / Permit2 signatures
- EIP-712 chain ID mismatches
- SIWE domain mismatches

Hardware wallets always require confirmation on the device.

---

# Transaction history

Inspect detailed transaction history when an explorer API key is configured.

History can include:

- Transaction hash
- Nonce
- From
- To
- Function
- Method ID
- Gas
- Explorer link

The wallet does not rely on public RPCs to discover your complete transaction history.

---

# Signings

1337 keeps a local history of messages and typed-data signatures made through the wallet.

Signing history stays on the device.

---

# Inspect

An optional inspection tool lets you investigate on-chain objects directly from the wallet.

You can inspect:

- Addresses
- Tokens
- ENS names
- Transaction hashes

Inspect can be enabled from:

```text
Settings → Tools
```

---

# Dapp compatibility

1337 provides a MetaMask-compatible `window.ethereum` provider.

Existing EVM dapps can therefore connect to 1337 without requiring a wallet-specific integration.

If a dapp supports MetaMask, it can generally work with 1337.

The extension opens in the browser side panel by default, with popup mode also available.

---

# Networks

1337 comes with a collection of popular EVM networks and public RPC endpoints.

Networks and RPC endpoints are user-configurable.

You can:

- Switch networks
- Use mainnets and testnets
- Reorder networks
- Reorder RPC endpoints
- Select a preferred RPC
- Add supported networks
- Switch RPC endpoints independently of the selected chain

---

# Privacy

1337 is designed so that the wallet does not need a central backend to operate.

### No analytics

There is no analytics or usage telemetry inside the extension.

### No 1337 backend

Your vault and settings remain in browser extension storage on your machine.

### No central account

There is no 1337 account that needs to know who you are or which addresses you use.

### Explicit network communication

External network requests happen when you use functionality that requires them, such as:

- Blockchain RPCs
- LI.FI swaps
- Explorer APIs
- Hardware wallet SDKs

The wallet does not operate its own RPC or indexing backend.

---

# Security

Security is part of the wallet architecture.

Software-wallet keys are password-encrypted before being stored in browser extension storage.

Ledger and Trezor accounts keep private keys on the hardware device.

The project also uses **LavaMoat** to isolate application components and reduce supply-chain risk.

The repository includes dedicated security documentation covering:

- Key storage
- Hardware wallets
- Supply-chain security
- LavaMoat
- Transaction signing
- Wallet architecture

See:

- [`docs/wallet-security.md`](docs/wallet-security.md)
- [`docs/signer.md`](docs/signer.md)

---

# Open source

1337 is open source and released under the **MIT License**.

The source code is available here:

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

The build uses Webpack and applies the project's LavaMoat configuration.

## Package for the Chrome Web Store

```bash
npm run package:store
```

The production extension is packaged into:

```text
release/1337-wallet-<version>.zip
```

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

Enable **Developer mode** and choose:

**Load unpacked**

Select:

```text
dist/
```

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

Run end-to-end tests:

```bash
npm run test:e2e
```

The project uses:

- Vitest for unit tests
- Playwright for browser-level tests

Hardware wallets and live dapp integrations require additional manual testing.

---

# LavaMoat

1337 uses LavaMoat to protect the extension's privileged bundles against dependency and supply-chain risks.

The protected components include:

- Background bundle
- Popup UI

The dapp-facing content and in-page provider components remain outside LavaMoat compartments where required for browser dapp compatibility.

After dependency changes:

```bash
npm run build:policy
npm run lavamoat:check
```

Review any policy changes before committing them.

---

# Project structure

```text
.
├── brand/
├── docs/
├── e2e/
├── lavamoat/
├── public/
├── release/
├── scripts/
├── src/
├── tests/
├── wallet-research/
├── webpack/
├── website/
├── package.json
├── webpack.config.cjs
└── README.md
```

---

# Design principles

### Understand before signing

Transactions should expose enough information for users to understand what they are approving.

### Self-custody

Users control their keys and signing devices.

### Privacy

A wallet should not require a central service to know what its users are doing.

### User-controlled infrastructure

Users should be able to choose their RPC endpoints instead of being locked into a wallet-operated RPC.

### Developer-first

EVM developers and power users often need more information than a simplified wallet interface provides.

1337 puts that information directly into the signing flow.

---

# Install

1337 runs on Chromium-based browsers including:

- Chrome
- Brave
- Opera
- Arc

<p align="center">
  <a href="https://1337wallet.io/">
    <img src="https://1337wallet.io/screenshots/features/assets.png?v=8" width="420" alt="Install 1337 Wallet" />
  </a>
</p>

<p align="center">
  <a href="https://1337wallet.io/"><strong>Get 1337 Wallet →</strong></a>
</p>

---

# Links

- **Website:** https://1337wallet.io/
- **GitHub:** https://github.com/0xCardiE/1337-wallet
- **Documentation:** [`docs/`](docs/)
- **Security:** [`docs/wallet-security.md`](docs/wallet-security.md)
- **Signer architecture:** [`docs/signer.md`](docs/signer.md)

---

# Disclaimer

1337 is self-custodial software.

You are responsible for your keys, signing decisions, transactions, and assets.

Always verify transaction details before signing.

Hardware wallets provide an additional signing boundary, but you should still review transactions carefully.

---

# License

MIT
