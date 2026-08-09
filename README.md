# 1337 Wallet (Chrome extension)

**1337** — advanced Ethereum wallet for developers, hackers, and power users. Multi-RPC, LiFi swaps, hardware signing, and MetaMask-compatible dapps. **No analytics. No 1337 server.** Styled after [1337 Skulls Wallet](https://chromewebstore.google.com/detail/1337-skulls-wallet/maggcienpliglmghmmfbnnmjclmopglk).

Product positioning, privacy claims, and promo copy live in **[brand/product.manifest.json](brand/product.manifest.json)** (imported in the app via `src/lib/productManifest.ts`).

## Features

- **Multi-account** — seed-derived HD accounts and/or imported keys; pick the active account in the header
- **Seed phrase** — create or import BIP-39 (12–24 words), same path style as MetaMask (`m/44'/60'/0'/0/n`)
- **Private key** — generate or import a single hex key for focused accounts
- **Hardware wallets** — connect Ledger (WebHID) or Trezor Connect; sign txs on-device
- **Security docs** — [MetaMask comparison by wallet type](docs/wallet-comparison-metamask.md)
- **Swaps** — cross-chain token swaps powered by LI.FI
- **Multi-send** — paste a list of addresses and send native or ERC-20 to each (local key accounts)
- **Networks** — 20 popular chains with pre-filled public RPCs; switch endpoint from a dropdown
- **Dapp connect** — optional MetaMask drop-in (`window.ethereum`) for connecting to websites
- **UI** — opens in the **side panel** by default; switch to popup in Settings

## Privacy

- No analytics or usage telemetry in the extension
- No 1337 backend — vault and settings stay in Chrome extension storage on your machine
- Network calls only when **you** use RPCs, swaps (LI.FI), explorer history (your API key), or hardware SDKs

See [brand/product.manifest.json](brand/product.manifest.json) for the full manifest (website / store / promo ready).

## Development

```bash
npm install
npm run icons   # generate PNG icons from SVG
npm run build   # Webpack + LavaMoat (popup, background) + content scripts
```

Load the unpacked extension from `dist/` in Chrome (Developer mode → Load unpacked).

### LavaMoat policy

Runtime compartments protect the **popup UI** and **service worker** (`background.js`). Content/inpage scripts stay outside LavaMoat because they run in web page contexts where SES lockdown would break dapps.

After dependency changes, regenerate the webpack policy:

```bash
npm run build:policy
```

Review `lavamoat/webpack/policy.json` and `lavamoat/webpack/policy-override.json`, then commit both.

## Security

Local keys are password-encrypted in extension storage. Ledger/Trezor accounts keep private keys on the device. See [docs/wallet-security.md](docs/wallet-security.md) and [MetaMask comparison](docs/wallet-comparison-metamask.md).

## Wallet pain research tool

Separate local app for mining Reddit/X/Google for crypto wallet user complaints:

```bash
cd wallet-research && npm install && npm run dev
```

See [wallet-research/README.md](wallet-research/README.md).
