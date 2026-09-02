# Pre-release manual testing

Automated tests (`npm run test:unit` and `npm run test:e2e`) catch signer logic and the Chromium extension shell. CI already runs a fresh install, icons, production build, LavaMoat policy, unit, and E2E on the same commit. They **cannot** replace a human pass with real devices, store packaging, and live dapps.

Walk this list before uploading to the Chrome Web Store or tagging a release. Check a box only after you did it on the **release build** (`npm run build`, unpacked `dist/` or the zip you will upload).

Use a **throwaway** seed / small balances. Never paste a production mnemonic into a dapp or a screenshot.

---

## 0. Build and install

Covered by CI: `npm ci`, `npm run icons`, `npm run build`, `npm run lavamoat:check`, `npm run test:unit`, and `npm run test:e2e` (`.github/workflows/test.yml`, `.github/workflows/lavamoat-policy.yml`). Name, version, and icon files are asserted in `tests/unit/extensionPackaging.test.ts`.

- [x] Load unpacked production `dist/` in a clean Chrome profile (or the store zip, not `npm run dev`) — name, version, and icons look right on `chrome://extensions`

---

## 1. Onboarding and vault (software)

- [ ] **Create seed** — 12 words shown once; Continue lands on Assets; closing the UI and reopening asks for the password
- [ ] **Wrong password** — rejected; vault still there
- [ ] **Create private key** — backup screen shows the hex key once
- [ ] **Import seed** (12 and, if you have one, 24 words) — first HD address matches MetaMask on `m/44'/60'/0'/0/0`
- [ ] **Import private key** — checksummed address matches a known tool
- [ ] **Lock** from Settings, then unlock
- [ ] **Wipe wallet** — after confirm, onboarding is back; old vault is gone
- [ ] Password of 7 characters is rejected; 8+ is accepted

---

## 2. Accounts and session

- [ ] Add a second HD account from Wallets; switcher changes the header address
- [ ] Import a second key into the same vault
- [ ] Active account survives popup / side panel close while unlocked
- [ ] Lock clears the session: dapp `eth_accounts` is empty until unlock + reconnect
- [ ] Auto-lock (Settings → 5 min) fires after idle; leave it **off** again if that is still the product default

---

## 3. Networks and RPC

- [ ] Switch among Ethereum, a popular L2 (Base or OP), and a testnet
- [ ] Assets / History / Tools stay consistent with the selected chain
- [ ] Swap / ENS / Gas hide on testnets; Inspect, Approvals, Multisend stay
- [ ] Add a custom RPC for a catalog chain; Doctor can mark it preferred
- [ ] Add a custom chain; it appears in the selector and `eth_chainId` matches
- [ ] Bad RPC: Doctor opens or a readable error — no blank hang

---

## 4. Confirm sheet (Normal mode)

On a **software** account, from a real page (not the E2E `example.com` stub):

- [ ] **Connect** — `eth_requestAccounts` connects; site shows in the dock / Connected sites
- [ ] **personal_sign** — human line + origin (host + path/query); reject (4001) and approve both work
- [ ] **SIWE** from the same origin — “Sign in to …”
- [ ] **SIWE** with a mismatched domain (or a phishing demo) — warning, not a silent sign
- [ ] **EIP-712** (Permit or a login typed-data) — domain / types / message readable
- [ ] **EIP-712 chainId ≠ active chain** — mismatch warning
- [ ] **Send native** — “Send X ETH to 0x…”; checksum warning if you paste mixed-case junk
- [ ] **Unlimited approve** — Approve card, not a raw selector
- [ ] **Unknown calldata** — Unknown card + selector
- [ ] Local simulate line shows pass / revert / gas (or a clear RPC failure) — no fake balance diff
- [ ] `eth_sign` from a console is rejected (4200)

---

## 5. Burner Mode

- [ ] Default remains **Normal**
- [ ] Enable Burner on one software account only
- [ ] Ordinary `personal_sign` / small transfer auto-signs
- [ ] Unlimited approve, unknown contract, high-value send, Permit, SIWE mismatch still open the sheet
- [ ] Settings → Burner Mode: ungate one risk and confirm only that path auto-signs
- [ ] Fully ungate: every software request auto-signs; hardware still cannot
- [ ] Hardware account never shows Burner as active

---

## 6. Hardware — Ledger

Physical Nano + current Ledger Live Ethereum app. WebHID prompt must stay accepted.

- [ ] Connect Ledger from Wallets — opens a full 1337 tab if HID is not granted; Allow Ledger shows Chrome's HID picker; then a list of addresses (Ledger Live / BIP-44 / Legacy, Next 5); import one or more; addresses match Ledger Live
- [ ] Disconnect / reject WebHID — readable error, no unsigned tx
- [ ] **Dapp send** — confirm sheet, then device screens; approve on device
- [ ] **Reject on device** — request fails; no broadcast
- [ ] **personal_sign** and **EIP-712** on device (blind-sign if the app requires it — note which)
- [ ] **Quick Send** from Assets
- [ ] **Swap** (tiny amount) — quote, confirm sheet, device, receipt / History
- [ ] **Gas Station** top-up to another chain
- [ ] **Multisend** native (and ERC-20 if you have a test token) — one device confirm (+ approve)
- [ ] **ENS** record or register path opens the device confirm (skip paying if you do not intend to)
- [ ] Unplug mid-sign — error, not a hang; replug works
- [ ] Switch back to a software account; Ledger is not left as the silent signer

---

## 7. Hardware — Trezor

Physical Trezor + Trezor Connect popup (`connect.trezor.io`). Signing pass 2026-09-02 (production `dist/`, including the Permit2 `domain_separator_hash` fix).

- [x] Connect Trezor from Wallets; export addresses; pick one or more (BIP-44 / Ledger Live / Legacy); address matches Trezor Suite
- [ ] Connect popup blocked / closed — readable error
- [x] **ERC-20 send** — Ethereum and Arbitrum
- [x] **Native send** — dust; empty `data` / value on device
- [x] **Reject on device** — request fails; no broadcast
- [x] **personal_sign** — Chrome console
- [x] **EIP-712** — Uniswap Permit2 (`PermitSingle`) on Arbitrum; Snapshot.org `Alias` typed data
- [x] **Quick Send** from Assets — native + ERC-20 above
- [ ] **Swap** (tiny amount) — quote, confirm sheet, device, receipt / History
- [ ] **Gas Station** top-up to another chain
- [ ] **Multisend** native (and ERC-20 if you have a test token) — one device confirm (+ approve)
- [ ] **ENS** record or register path opens the device confirm (skip paying if you do not intend to)
- [ ] Suite / Connect version notes if something needs a firmware bump

### Reset hardware pairing (unpacked only)

Chrome keeps the Ledger WebHID grant on the **extension**, not on the imported account. Removing a Ledger wallet does not revoke it, so the next Connect skips the device list. Trezor Connect keeps an init session in the service worker.

Do **not** run this on a website tab (or MetaMask). `__1337` is not there. Use one of:

1. `chrome://extensions` → 1337 → **Service worker** → Inspect → Console
2. Open the 1337 side panel or popup, right-click **inside 1337** → Inspect. Console context must be `chrome-extension://…` (not `top` of a web page).

```js
await chrome.runtime.sendMessage({ type: 'HW_RESET' })
// { ledgerForgotten: 1, trezorReset: true }
```

From the service worker console this also works: `await __1337.resetHardware()`.

Then Connect Ledger again — Chrome should show the HID list. Connect Trezor re-inits Connect (the popup still comes from `connect.trezor.io`).

Store builds reject `HW_RESET`. Manual fallbacks: `chrome://settings/content/hidDevices` → remove 1337; for a sticky Trezor popup, close Suite and clear site data for `https://connect.trezor.io`.

---

## 8. Live dapps (MetaMask-compat)

Use small amounts. After each, check History + the site.

- [ ] Uniswap (or another AMM) — swap; unlimited approve warning is visible
- [ ] Aave / similar — supply or approve
- [ ] OpenSea or an NFT marketplace — `setApprovalForAll` card
- [ ] Snapshot / another SIWE login
- [ ] A site that **requires** `window.ethereum.isMetaMask` — Settings → Connected sites → Announce as MetaMask; reload the tab; connect works; 1337 still signs
- [ ] A site that should stay 1337-only — override “1337 only”; `is1337` visible in console
- [ ] `wallet_revokePermissions` or Connected sites → Disconnect; site loses accounts
- [ ] Two tabs, two origins — permissions do not leak across sites

---

## 9. Signer tools (in-wallet)

- [ ] **Inspect** — address, `.eth` name, tx hash; explorer link opens the right chain
- [ ] **Approvals** — list ERC-20 / NFT / Permit2; revoke one dummy approval
- [ ] **Swap** — quote, confirm, History title is human
- [ ] **Multisend** — paste ≥2 recipients; on a chain without legacy Disperse but with CreateX, first-user **Deploy Disperse** copy is honest (skip deploy unless you mean to)
- [ ] **Gas Station** — quote + execute to a chain where the account needs gas
- [ ] **ENS** — resolve a name; portfolio loads if The Graph key is set
- [ ] Settings → Tools: hide Swap; it disappears; defaults come back if you reset the list

---

## 10. History, Assets, privacy

- [ ] History fills from explorer (Etherscan key and/or Blockscout fallback on OP/Base/etc.)
- [ ] Failed tx shows as failed, not a success
- [ ] Assets: native row; hide a junk token; it stays in Other / hidden
- [ ] Quick Send to a checksummed address; reject once, then a dust send
- [ ] No analytics / mystery 1337 backend hosts in the Network panel (RPC, LiFi, explorer, hardware Connect only)
- [ ] Side panel vs popup (Settings) both render; confirm sheet still works in the chosen surface

---

## 11. Store / release packaging

- [ ] Zip is production `dist/` only (no `.map` if you strip them for the store; keep maps in a GitHub release if you want them)
- [ ] Store listing: name, screenshots, privacy text match [brand/product.manifest.json](../brand/product.manifest.json) — no analytics, no 1337 server
- [ ] Permissions still match `public/manifest.json` (`storage`, `sidePanel`, `windows`, `tabs`, `scripting`, `<all_urls>`)
- [ ] Version bump in `package.json` + `public/manifest.json`
- [ ] Firefox / Safari **not** required until those builds exist (TODO)

---

## 12. Sign-off

| Role | Name | Date | Build / commit |
|------|------|------|----------------|
| Automated suite | | | |
| Software + dapp pass | | | |
| Ledger pass | | | |
| Trezor pass | signing (connect, native, ERC-20 ETH+Arb, reject, personal_sign, Permit2, Snapshot Alias) | 2026-09-02 | unpacked `dist/` |
| Store zip review | | | |

Known issues found this pass (link issues or list here):

- Trezor EIP-712 / Uniswap Permit2 failed with missing `domain_separator_hash` until hashed locally (`src/lib/eip712Hashes.ts`). Fixed; retested on Arbitrum.
