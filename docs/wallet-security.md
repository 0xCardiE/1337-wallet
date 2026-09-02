# Wallet security model (1337 extension)

This note describes how signing works in 1337 and how to keep risk lower in practice. Product scope — **1337 is a signer, not a lab** — lives in **[signer.md](./signer.md)**. For a full comparison of **all account types vs MetaMask equivalents**, see **[wallet-comparison-metamask.md](./wallet-comparison-metamask.md)**.

**Privacy:** 1337 does not run analytics or store wallet data on a central server. See **[brand/product.manifest.json](../brand/product.manifest.json)** for positioning and privacy claims used in the UI and future promo material.

## What the extension does today

- **Local accounts** — BIP-39 seed (create/import) and/or hex private keys, encrypted in the vault (`src/lib/vault.ts`). Seed wallets can derive more HD accounts (`m/44'/60'/0'/0/n`).
- **Hardware accounts** — Ledger (WebHID) and Trezor Connect; only address + path are stored. Signing uses the device SDK.
- After unlock, local signing uses a **Viem account** and **`eth_sendRawTransaction`** over your RPC (`src/lib/ethereum.ts`).
- A full **EIP-1193 provider** is injected (`window.ethereum`), with optional MetaMask replacement.
- **Normal mode (default):** each dApp sign/send request is queued in `TxApprovalSheet` with a human summary, local `eth_call` simulation (pass / fail / revert), and contract danger flags when source is available. **Burner Mode:** ordinary requests execute automatically while a **local** account is unlocked. Burner Mode is **gated by default** — unlimited approvals, unknown contract calls, high-value sends, permits, EIP-712 chainId mismatches, and SIWE domain mismatches still open the approval sheet unless you ungate them in Settings. **Hardware** always requires device confirmation (and UI approval for dApp txs). Disperse `disperseEther` / `disperseToken` are treated as known-safe selectors; CreateX `deployCreate2` (first-user plant of Disperse) is not — Burner Mode still pauses unless that unknown-contract gate is off.
- **`eth_sign` is disabled.** Use `personal_sign` or `eth_signTypedData_v4`.
- The unlocked **active private key** (local only) is kept in the MV3 **service worker** and as **plaintext in `chrome.storage.session`**. Seed phrase (if any) stays in UI memory for the unlock session, not in session storage. **Lock** / **auto-lock** clears the session.

## Compared to MetaMask (short)

MetaMask’s main end-user advantage is **separation + explicit review**: the dapp is untrusted, and the wallet UI confirms every sign/send by default. 1337 matches that for signing (Normal by default) while still favoring session convenience — stay unlocked and persist across UI close; opt into Burner Mode for auto-sign, with risk gates on by default. Both are **hot software wallets** for local accounts; hardware accounts keep keys on device.

| | MetaMask | 1337 |
|---|----------|------|
| Software default | Confirm every request | Confirm every request (Burner Mode opt-in, gated) |
| HD seed | Yes (SRP) | Yes (optional; create default) |
| Private key import | Yes | Yes |
| Hardware | Ledger / Trezor | Ledger / Trezor |
| Unlocked PK on disk | Typically memory-only | Active PK in `chrome.storage.session` |
| Runtime supply chain | LavaMoat compartments (UI + background) | LavaMoat compartments (popup + background; inpage outside) |

See the [full multi-type table](./wallet-comparison-metamask.md).

## Supply chain & LavaMoat (what we have now)

1337 uses [LavaMoat](https://lavamoat.github.io/) in two layers. This is the same open-source stack MetaMask builds on; we do not need MetaMask’s full multi-year webpack layering to get real compartment isolation.

### Install time (`@lavamoat/allow-scripts`)

- `.npmrc` sets `ignore-scripts=true` so dependency lifecycle scripts do not run by default.
- Allowed scripts are listed under `lavamoat.allowScripts` in `package.json` (deny by default).
- `postinstall` runs `allow-scripts run` so only allowlisted packages execute install scripts (today: `esbuild` via `esbuild-loader`).

### Runtime (Webpack + `@lavamoat/webpack`)

| Bundle | Build config | LavaMoat? | Why |
|--------|--------------|-----------|-----|
| Service worker (`background.js`) | `webpack.config.cjs` | Yes | Session key, signing, Trezor bridge — highest sensitivity |
| Popup / side panel UI | `webpack.ui.config.cjs` | Yes | Vault UI and in-memory seed during unlock; React needs DOM endowments |
| `content.js` / `inpage.js` | `webpack.content.config.cjs` | No | Runs in page MAIN / isolated worlds; SES lockdown would break dapps |

**What compartments do:** each npm package in a LavaMoat-protected bundle runs in its own SES Compartment. Policy files decide which globals and which other packages it may touch. A compromised dependency cannot freely reach `chrome.storage`, `fetch`, or your vault code unless the policy allows it.

**Scuttling (`scuttleGlobalThis`):** after endowments are copied into compartments, the real `globalThis` is stripped of most properties so a leaked reference is mostly useless. Exception lists live in `webpack/lavamoat-options.cjs` (background vs popup). Dangerous APIs like `eval` stay scuttled.

**Policy files (commit after regenerating):**

- Background: `lavamoat/webpack/policy.json` + `policy-override.json`
- Popup UI: `lavamoat/webpack-ui/policy.json` + `policy-override.json` (includes React/DOM endowments such as `window` / `HTMLIFrameElement`)

```bash
npm run build:policy   # regenerate after dependency changes
npm run lavamoat:check # regenerate + fail if lavamoat/ is dirty (CI)
npm run build          # background → UI → content/inpage
```

CI: `.github/workflows/lavamoat-policy.yml` runs `lavamoat:check` and a production build on push/PR.

**Not yet (optional MetaMask extras):** `@lavamoat/snow` (DOM lockdown helper MetaMask pairs with UI scuttling) and webpack “unsafe vs safe” entry layers for a split SW bootstrap. Compartments + scuttling cover the main Layer 3 controls.

Extension CSP remains `script-src 'self'` for extension pages (`public/manifest.json`).

## Remaining risks (even extension-only)

- **Bug or malicious dependency** → compartments shrink the blast radius but do not replace review of policy overrides or hardware for high-value funds.
- **Compromised developer machine / supply chain** when building or installing the unpacked extension.
- **Physical access** to an **unlocked** browser profile → attacker may use local accounts until lock; hardware still needs the device.
- **`<all_urls>` host permission** — trust your RPC and quote paths.
- **Content/inpage scripts** are intentionally outside LavaMoat; keep them thin and review carefully.

## Ways to keep risk lower

1. **Use Lock** when you step away; enable **auto-lock** (off by default).
2. Keep **Normal** (default) for MetaMask-style per-request confirmation; Burner Mode still pauses on gated risks unless you fully ungate it in Settings.
3. Prefer **Ledger/Trezor** for high-value funds or when you want device-backed signing.
4. Back up **seed phrases** offline; never paste them into websites.
5. **Install from a trustworthy build** (`npm run build` from this repo).
6. After adding or upgrading dependencies, run **`npm run lavamoat:check`** (or `build:policy`), review policy diffs, and commit them with the lockfile.

## Related docs

- [signer.md](./signer.md) — signer-not-a-lab guideline (confirm sheet, Tools, what not to build)
- [testing.md](./testing.md) — unit + extension E2E
- [release-manual-testing.md](./release-manual-testing.md) — Ledger / Trezor / live dapps before release

## Related source files

- `src/lib/walletCore.ts` — seed + private key parsing/derivation
- `src/lib/walletManager.ts` — account lifecycle
- `src/lib/accountSession.ts` — in-memory session
- `src/lib/sessionBridge.ts` / `src/background.ts` — background session / lock
- `src/lib/txConfirmMode.ts` / `src/lib/instantGates.ts` / `src/lib/txRisk.ts` / `src/lib/siwe.ts` — Burner Mode gates, SIWE, EIP-712 chain checks
- `src/lib/disperse.ts` / `src/lib/disperseCreate2.ts` — Multisend Disperse probe + CreateX first-user deploy (`docs/signer.md`)
- `src/lib/ledger.ts` / `src/lib/trezor.ts` — hardware signing
- `webpack.config.cjs` / `webpack.ui.config.cjs` / `webpack.content.config.cjs` — LavaMoat vs plain bundles
- `webpack/lavamoat-options.cjs` — shared lockdown + scuttle exception lists
- `lavamoat/webpack*` — runtime policies
- `scripts/check-lavamoat-policy.mjs` — CI policy freshness check
- `.github/workflows/lavamoat-policy.yml` — GitHub Actions policy + build