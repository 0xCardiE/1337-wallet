# 1337 Wallet — Development TODO

Tracking ideas from [Rabby](https://github.com/RabbyHub/Rabby) and [Ambire](https://github.com/AmbireTech/extension) comparisons, plus follow-ups aligned with 1337's positioning (dev/power user, privacy-first, no 1337 server).

**Status key:** `[ ]` not started · `[~]` in progress · `[x]` done · `[-]` deferred / won't do

**Priority:** P0 quick win · P1 high value · P2 medium · P3 strategic / large bet

---

## P0 — Quick wins

| Done | Item | Source | Effort | Notes |
|------|------|--------|--------|-------|
| [ ] | LavaMoat unsafe-layer for content/inpage scripts | Ambire | Low | Formalize webpack `unsafe` layer so inpage/content stay outside LavaMoat wrapping without ad-hoc exclusions. See `webpack.config.cjs`, `webpack.content.config.cjs`, `lavamoat/`. |
| [ ] | CI LavaMoat policy drift check | Ambire | Low | Fail PRs when `lavamoat/webpack/policy.json` changes without explicit commit after `npm run build:policy`. |
| [ ] | Per-origin MetaMask-compat mode | Rabby | Low | Hide `is1337` / announce as MetaMask in EIP-6963 for broken dapps; per-site override in settings. See `src/inpage/provider.ts`, `src/lib/dappConnections.ts`. |
| [ ] | Document security invariants | Rabby | Low | Consent resets on lock/unlock/account/chain switch; fail-closed signing; no implicit consent via broadcasts. Add to `docs/wallet-security.md` or new `docs/security-invariants.md`. |
| [ ] | RPC middleware refactor (`@APPROVAL`-style) | Rabby | Medium | Replace inline branching in `src/lib/providerRpc.ts` with metadata-driven middleware (unlock → connect → approve → execute). |

---

## P1 — High value

| Done | Item | Source | Effort | Notes |
|------|------|--------|--------|-------|
| [ ] | Action-type approval components | Rabby | Medium | Refactor `TxApprovalSheet` / `approvalDetails.ts` into action views: Send, Approve, Swap, Unknown. Extend `KNOWN_SELECTORS`. |
| [ ] | Opt-in tx simulation / balance preview | Rabby | Medium | Show predicted balance changes in Normal mode. **Opt-in** if using DeBank/Rabby API (privacy). Alternative: local `eth_call` heuristics for common patterns. |
| [ ] | Risk-gated Turbo mode | 1337 + Rabby | Medium | Keep Turbo default for dev speed; force Normal + preview for unlimited approvals, unknown contracts, high value, permit2. See `src/lib/txConfirmMode.ts`, `providerRpc.ts`. |
| [ ] | Playwright E2E (extension load + bootstrap) | Ambire | Medium | `launchPersistentContext` + `--load-extension`; seed storage via service worker to skip onboarding. |
| [ ] | Secrets-leak E2E test | Ambire | Low | Scan network/request bodies for mnemonics, private keys, session material during tests. |
| [ ] | Lightweight tx humanizer (local) | Ambire | Medium | Modular decoders for ERC-20/721, common routers; embed in approval UI. Start in `src/lib/approvalDetails.ts` or new `src/lib/humanizer/`. |
| [ ] | LavaMoat unsafe-packages lockfile gate | Ambire | Low | Block lockfile bumps to packages excluded from LavaMoat unless PR is explicitly approved. |

---

## P2 — Medium term

| Done | Item | Source | Effort | Notes |
|------|------|--------|--------|-------|
| [ ] | Chain list sync + fallback pattern | Rabby | Medium | Remote-first catalog + local fallback + periodic refresh; unify `findChain()` across RPC, UI, provider. See `src/lib/chainCatalog.ts`, `chainRpcRegistry.ts`. |
| [ ] | Connect-time security hints | Rabby | Medium | On dapp connect, show origin reputation / basic rules (new site, suspicious domain). Lighter than full Rabby security engine. |
| [ ] | Typed data explainer UI | Rabby | Medium | Human-readable EIP-712 in `TxApprovalSheet` (domain, types, message) instead of raw JSON. |
| [ ] | Release pipeline: strip sourcemaps + zip | Ambire | Low | `build:extensions`-style script for store uploads; maps in GitHub release artifacts. |
| [ ] | Four-byte + contract source in approval (expand) | 1337 + Rabby | Low | Already partial via `fourByteDirectory.ts`, `explorerContractSource.ts` — expand coverage and surface in action UI. |
| [ ] | Architectural security review skill/checklist | Rabby | Low | Agent/human checklist for consent boundaries, Turbo paths, cross-context messaging. Optional `skills/` or `docs/`. |

---

## P3 — Strategic / large bets

| Done | Item | Source | Effort | Notes |
|------|------|--------|--------|-------|
| [ ] | Full Rabby security stack integration | Rabby | High | `@rabby-wallet/rabby-api`, `rabby-action`, `rabby-security-engine` — only if opt-in + acceptable third-party dependency. |
| [ ] | SecSDK / warden-for-js prod sandbox | Rabby | Medium | Build-time per-dependency global access policies on top of LavaMoat. |
| [ ] | EIP-7702 / smart-account path | Ambire | High | `AccountOp`-style abstraction, delegation UI, `sign7702` on signers. Needs relayer/bundler strategy. |
| [ ] | Cross-browser builds (Firefox / Safari) | Ambire | High | `WEB_ENGINE` env, gecko manifest transforms, Safari converter. Only if store expansion is a goal. |
| [ ] | Embedded Benzin-style explorer | Ambire | Medium | Standalone decode app + in-wallet preview; depends on humanizer investment. |
| [ ] | Shared logic submodule (`ambire-common` pattern) | Ambire | High | Only if mobile or multiple apps share vault/signing logic. |

---

## Explicitly not planned (unless scope changes)

| Item | Source | Reason |
|------|--------|--------|
| DeBank/Rabby backend as default | Rabby | Conflicts with "no 1337 server" / privacy claims |
| React Native Web monolith | Ambire | Heavy; current React + webpack stack is sufficient |
| Built-in Rabby swap/bridge | Rabby | LiFi already covers swaps |
| Ambire Gas Tank / relayer infra | Ambire | Custodial-ish UX + server dependency |
| Global MetaMask-only impersonation | Rabby | Prefer per-site override over hiding 1337 everywhere |

---

## Comparison matrix (for prioritization debates)

Use this when choosing between items in the same sprint.

| Dimension | Rabby-heavy items | Ambire-heavy items | 1337-native items |
|-----------|-------------------|--------------------|--------------------|
| **User-visible UX** | Simulation, action UI, security badges | Humanizer, Benzin decode | Turbo, multi-RPC, side panel |
| **Security engineering** | Rule engine, preExec, SecSDK | Unsafe-layer, E2E secrets leak, CI gates | LavaMoat, Turbo vs Normal, session model |
| **Privacy fit** | ⚠️ DeBank API needs opt-in | ⚠️ 4337/bundler needs opt-in | ✅ No telemetry, local-first |
| **Dev audience fit** | Tx explain, contract decode | AccountOp, 7702, debugging | Speed, RPC doctor, LiFi, hardware |
| **Effort vs impact** | Medium effort, high UX for Normal mode | Low–medium for infra; high for smart accounts | Low for docs/gates; medium for risk-gated Turbo |

---

## Related docs

- [README.md](./README.md) — features and build
- [docs/wallet-security.md](./docs/wallet-security.md) — security model
- [docs/wallet-comparison-metamask.md](./docs/wallet-comparison-metamask.md) — MetaMask comparison
- [website/src/app/integrate/page.tsx](./website/src/app/integrate/page.tsx) — dapp integration (EIP-6963)

---

---

## Security audit — MetaMask-style checklist

Benchmark from MetaMask security analysis (Dapp Permissions, Intent Verification, Physical Access, Threat Prevention). **1337 score is our implementation status**, not MetaMask's.

**Status key:** `[x]` implemented · `[~]` partial · `[ ]` missing

**1337 posture:** speed-first — Turbo auto-sign is default; many controls only apply in Normal mode or are absent entirely.

### Dapp Permissions (MetaMask ref: 35/35)

| Done | Feature | Weight | 1337 status | Notes / target |
|------|---------|--------|-------------|----------------|
| [~] | User confirmation before processing requests | 8.7 | Partial | Normal mode queues in `TxApprovalSheet`; **Turbo (default) auto-signs**. Hardware always confirms. `txConfirmMode.ts`, `providerRpc.ts` |
| [~] | User consent for dApp access | 7.7 | Partial | Manual connect via `DappConnectionBar` requires click; **`eth_requestAccounts` silently connects** with no dialog. `providerRpc.ts` |
| [x] | Wallet unlock before requests | 5.6 | Done | Locked wallet returns `4100`; unlock UI opens on account request. `providerRpc.ts`, `background.ts` |
| [ ] | Mismatching EIP-712 chainId detection | 3.5 | Missing | Typed data parsed/displayed but **`domain.chainId` never compared** to active chain. `approvalDetails.ts` |
| [ ] | `eth_sign` method disabled | 3.3 | Missing | **`eth_sign` enabled** and treated like `personal_sign`. `providerRpc.ts`, `pendingApprovals.ts` |
| [ ] | Mismatching SIWE domain detection | 1.8 | Missing | No SIWE parser; no domain/uri vs page-origin check |
| [~] | Connected dApp management | 1.5 | Partial | Per-origin connect/disconnect + `wallet_revokePermissions`; **no full connected-sites list** or per-site settings. `dappConnections.ts` |
| [x] | Token approval management | 1.5 | Done | Scan, view, revoke in Tools → Approvals. `ApprovalsPanel.tsx`, `tokenApprovals.ts` |
| [ ] | User confirmation before switching chains | 1.1 | Missing | `wallet_switchEthereumChain` / `wallet_addEthereumChain` apply immediately. `providerRpc.ts` |

### Intent Verification (MetaMask ref: 15.6/25)

| Done | Feature | Weight | 1337 status | Notes / target |
|------|---------|--------|-------------|----------------|
| [~] | Transaction simulation | 6.7 | Partial | DApp RPC proxy + gas estimate in approval UI; **no balance-change / outcome preview**. See P1 "Opt-in tx simulation" |
| [~] | Clear message signing dialog | 3.8 | Partial | Normal mode shows decoded fields; **dev-oriented UI**, skipped in Turbo. `TxApprovalSheet.tsx` |
| [x] | EIP-712 message parsing | 2.4 | Done | Domain, types, message fields, raw JSON. `approvalDetails.ts` |
| [~] | Invalid address checksum detection | 2.2 | Partial | Viem `getAddress()` validates on parse; **no explicit checksum warning** in approval/send UI |
| [~] | Clear token approval dialog | 6.7 | Partial | `approve()` decoded in tx overview; unlimited allowance warned in Approvals panel; **no dedicated approval action view**. See P1 "Action-type approval components" |
| [~] | Mandatory message review | 2.1 | Partial | Required in Normal mode only; **Turbo skips review entirely (default)**. `txConfirmMode.ts` |
| [x] | Links to blockchain explorers | 1.2 | Done | Address/tx/contract links across approvals, history, gas, swap. `explorerUrls.ts`, `tokenApprovals.ts` |

### Physical Access (MetaMask ref: 11.7/20)

| Done | Feature | Weight | 1337 status | Notes / target |
|------|---------|--------|-------------|----------------|
| [~] | Seed phrase access control | 5.4 | Partial | PBKDF2 + AES-GCM vault; mnemonic in UI memory while unlocked; **no post-onboarding seed reveal UI**. `vault.ts`, `accountSession.ts` |
| [x] | Manual wallet lock | 3.9 | Done | Settings Lock clears session + in-memory keys. `SettingsView.tsx`, `sessionBridge.ts` |
| [~] | Seed phrase access warning | 1.8 | Partial | One-time backup warning at wallet creation only; **none on import or later account derive**. `Onboarding.tsx` |
| [~] | Automatic wallet lock | 3.4 | Partial | **Implemented but off by default** (5/15/30/60 min idle). `SettingsView.tsx`, `background.ts` |
| [ ] | Robust authentication (biometrics / passkeys) | 3.3 | Missing | Password-only unlock; no WebAuthn or biometrics |
| [ ] | Clipboard seed phrase leak prevention | 1.8 | Missing | Private key copy allowed with **no auto-clear or leak warnings**. `WalletsView.tsx` |

### Threat Prevention (MetaMask ref: 20/20)

| Done | Feature | Weight | 1337 status | Notes / target |
|------|---------|--------|-------------|----------------|
| [ ] | Phishing dApp detection | 5.1 | Missing | No blocklists, domain reputation, or heuristics. See P2 "Connect-time security hints" |
| [ ] | Malicious address detection | 5.1 | Missing | No blocklists or drainer/scam databases |
| [ ] | Trusted dApp detection | 3.3 | Missing | No allowlist or known-good dApp registry |
| [~] | Unknown address detection | 2.8 | Partial | Unknown function selectors flagged `warn`; **no never-seen recipient / address-book checks**. `approvalDetails.ts` |
| [~] | Full dApp URL display | 1.5 | Partial | Approval shows hostname + origin; **not full path/query**. `TxApprovalSheet.tsx` |
| [~] | Malicious or spam token filtering | 1.3 | Partial | Approvals scoped to wallet token list; unlimited approvals warned, not blocked. `tokenApprovals.ts` |
| [ ] | dApp access disclosure dialog | 1.0 | Missing | No modal explaining granted access on connect; silent `eth_requestAccounts` |

### Security audit summary

| Category | Done | Partial | Missing |
|----------|------|---------|---------|
| Dapp Permissions | 2 | 3 | 4 |
| Intent Verification | 2 | 5 | 0 |
| Physical Access | 1 | 4 | 2 |
| Threat Prevention | 0 | 3 | 4 |
| **Total (29 items)** | **5** | **15** | **10** |

### Recommended security sprint (ordered by weight × gap)

1. **[ ] Disable or gate `eth_sign`** — high phishing risk; block by default, opt-in for devs
2. **[ ] EIP-712 chainId mismatch warning** — block or warn when `domain.chainId ≠ active chain`
3. **[ ] SIWE domain/uri mismatch detection** — parse SIWE messages, compare to page origin
4. **[ ] Connect consent dialog** — require explicit approval on `eth_requestAccounts` (not just manual bar)
5. **[ ] Chain switch confirmation** — approval sheet for `wallet_switchEthereumChain` / add chain
6. **[ ] Clear token approval action UI** — dedicated Approve view with spender, amount, unlimited flag
7. **[ ] Risk-gated Turbo** — force Normal + preview for unlimited approvals, unknown contracts, high value (see P1)
8. **[ ] Phishing / malicious address checks** — local blocklist or opt-in Rabby/DeBank API
9. **[ ] dApp access disclosure dialog** — explain permissions on first connect
10. **[ ] Clipboard hygiene** — auto-clear copied secrets, warn on seed/key copy
11. **[ ] Auto-lock on by default** — or prompt during onboarding
12. **[ ] Full URL display in approval** — show path + query, not just hostname
13. **[ ] Explicit checksum warnings** — surface invalid/mixed-case addresses before sign
14. **[ ] Connected sites manager** — list all origins, per-site revoke and settings
15. **[ ] Robust auth (WebAuthn)** — optional passkey/biometric unlock layer

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-09 | MetaMask-style security audit checklist (29 items) |
| 2026-08-09 | Initial list from Rabby + Ambire repo analysis |
