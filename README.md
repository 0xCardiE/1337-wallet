# 1337 Wallet (Chrome extension)

**1337** — a **signer** for developers, hackers, and power users: understand the request, judge the risk, sign or reject. Multi-RPC, LiFi swaps, hardware signing, and MetaMask-compatible dapps. **No analytics. No 1337 server.** Not a Foundry/Etherscan lab — see **[docs/signer.md](docs/signer.md)**. Styled after [1337 Skulls Wallet](https://chromewebstore.google.com/detail/1337-skulls-wallet/maggcienpliglmghmmfbnnmjclmopglk).

Product positioning, privacy claims, and promo copy live in **[brand/product.manifest.json](brand/product.manifest.json)** (imported in the app via `src/lib/productManifest.ts`).

## Features

- **Multi-account** — seed-derived HD accounts and/or imported keys; pick the active account in the header
- **Seed phrase** — create or import BIP-39 (12–24 words), same path style as MetaMask (`m/44'/60'/0'/0/n`)
- **Private key** — generate or import a single hex key for focused accounts
- **Hardware wallets** — connect Ledger (WebHID) or Trezor Connect; sign txs on-device
- **Security docs** — [MetaMask comparison by wallet type](docs/wallet-comparison-metamask.md)
- **Signer confirms** — human summary, local `eth_call` simulation, and contract danger flags before you sign
- **Signings** — local history of messages and typed data this wallet signed (device only)
- **Approvals** — review and revoke ERC-20, NFT operators, and Permit2
- **Inspect** — paste an address, token, ENS name, or tx hash (opt-in in Settings → Tools)
- **Swaps** — cross-chain token swaps powered by LI.FI
- **Multi-send** — paste a list of addresses and batch native or ERC-20 via [Disperse.app](https://disperse.app) (local and hardware). If Disperse is missing but [CreateX](https://createx.rocks) is on the chain, the first user can deploy it once for everyone — [docs/signer.md](docs/signer.md#multisend-is-disperseapp-not-a-create2-lab)
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
npm run icons   # generate PNG icons from SVG (needs Python Pillow: `python3 -m pip install Pillow` or `python3-pil`)
npm run build   # Webpack + LavaMoat (popup, background) + content scripts
npm run package:store   # production dist/ → release/1337-wallet-<version>.zip
```

Load the unpacked extension from `dist/` in Chrome (Developer mode → Load unpacked).

Chrome Web Store uploads are zips of production `dist/` (`manifest.json` at the zip root, no source maps, no unpacked-only `dev-reload` files). `npm run package:store` writes that file under `release/` (gitignored). Upload the zip, not a `.crx`. Listing images: `npm run store:assets` → `brand/chrome-web-store/`.

`npm install` installs git hooks that rebuild `dist/` after **commit** and **push**, then open a tiny extension page that calls `chrome.runtime.reload()` (unpacked only). Run `npm run ext:rebuild` yourself if you want that without git. If Chrome does not pick it up, click Reload on `chrome://extensions`.

### Tests

```bash
npx playwright install chromium   # once
npm run test:unit                 # signer logic (Vitest)
npm run icons && npm run build
npm run test:e2e                  # Chrome extension + dapp provider (Playwright)
```

See [docs/testing.md](docs/testing.md). Hardware wallets and live dapps are a human pass: [docs/release-manual-testing.md](docs/release-manual-testing.md).

### LavaMoat policy

| Bundle | Protection |
|--------|------------|
| `background.js` | LavaMoat compartments + globalThis scuttling |
| Popup UI (`index.html`) | LavaMoat compartments + scuttling (DOM/chrome exceptions in `webpack/lavamoat-options.cjs`) |
| `content.js` / `inpage.js` | Outside LavaMoat (page MAIN / isolated worlds — lockdown would break dapps) |

After dependency changes, regenerate and verify policies:

```bash
npm run build:policy
npm run lavamoat:check   # fails if lavamoat/ would change
```

Review and commit:
- `lavamoat/webpack/policy.json` (+ override) — background
- `lavamoat/webpack-ui/policy.json` (+ override) — popup


## Security

Local keys are password-encrypted in extension storage. Ledger/Trezor accounts keep private keys on the device.

**Supply chain:** install scripts are allowlisted; popup and background bundles run in LavaMoat SES compartments. Details: [docs/wallet-security.md](docs/wallet-security.md) (see “Supply chain & LavaMoat”). Also [MetaMask comparison](docs/wallet-comparison-metamask.md).

**Product scope:** [docs/signer.md](docs/signer.md) — 1337 is a signer, not a Foundry/Etherscan lab. History coverage: [docs/explorer-history.md](docs/explorer-history.md).

## Wallet pain research tool

Separate local app for mining Reddit/X/Google for crypto wallet user complaints:

```bash
cd wallet-research && npm install && npm run dev
```

See [wallet-research/README.md](wallet-research/README.md).
