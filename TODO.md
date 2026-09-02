# 1337 Wallet — Development TODO

Tracking ideas from [Rabby](https://github.com/RabbyHub/Rabby) and [Ambire](https://github.com/AmbireTech/extension), plus 1337-native follow-ups (dev/power user, privacy-first, no 1337 server).

**Status key:** `[ ]` not started · `[~]` in progress / partial · `[x]` done · `[-]` deferred / won't do

**Priority:** P0 quick win · P1 high value · P2 medium · P3 strategic / large bet

---

## Security

Signing, consent, supply chain, physical access, and threat prevention.

**1337 posture:** Normal (confirm every request) is default. Burner Mode auto-signs ordinary requests but is **gated by default**; Settings can fully ungate or ungate individual risks.

### Backlog

| Done | P | Item | Source | Effort | Notes |
|------|---|------|--------|--------|-------|
| [x] | P1 | Risk-gated Instant mode | 1337 + Rabby | Medium | Pauses on unlimited approvals, unknown contracts, high value, permit, EIP-712 chain mismatch, SIWE mismatch. Fully ungate or per-gate in Settings. `instantGates.ts`, `txRisk.ts`, `txConfirmMode.ts` |
| [ ] | P0 | LavaMoat unsafe-layer for content/inpage scripts | Ambire | Low | Formalize webpack `unsafe` layer so inpage/content stay outside LavaMoat wrapping without ad-hoc exclusions. See `webpack.config.cjs`, `webpack.content.config.cjs`, `lavamoat/` |
| [ ] | P0 | CI LavaMoat policy drift check | Ambire | Low | Fail PRs when `lavamoat/webpack/policy.json` changes without explicit commit after `npm run build:policy` |
| [ ] | P0 | Document security invariants | Rabby | Low | Consent resets on lock/unlock/account/chain switch; fail-closed signing; no implicit consent via broadcasts. Add to `docs/wallet-security.md` or `docs/security-invariants.md` |
| [ ] | P0 | RPC middleware refactor (`@APPROVAL`-style) | Rabby | Medium | Replace inline branching in `src/lib/providerRpc.ts` with metadata-driven middleware (unlock → connect → approve → execute) |
| [x] | P1 | Action-type approval components | Rabby | Medium | Approve / Permit / Send / Swap / Unknown cards in `TxApprovalSheet`. |
| [~] | P1 | Opt-in tx simulation / balance preview | Rabby | Medium | Local `eth_call` pass/fail/revert/gas on confirm (`txSimulate.ts`). Full asset-diff needs a sim API — **not planned** as default (signer.md) |
| [x] | P1 | Secrets-leak E2E test | Ambire | Low | `e2e/secrets-leak.spec.ts` — fails if mnemonic/private key appear on the wire |
| [ ] | P1 | LavaMoat unsafe-packages lockfile gate | Ambire | Low | Block lockfile bumps to packages excluded from LavaMoat unless PR is explicitly approved |
| [ ] | P2 | Connect-time security hints | Rabby | Medium | On dapp connect, show origin reputation / basic rules (new site, suspicious domain). Lighter than full Rabby security engine |
| [~] | P2 | Typed data explainer UI | Rabby | Medium | Domain / types / message + chainId mismatch warning done. Remaining: consumer-readable Permit/login copy beyond action cards |
| [ ] | P2 | Architectural security review skill/checklist | Rabby | Low | Agent/human checklist for consent boundaries, Instant gates, cross-context messaging. Optional `skills/` or `docs/` |
| [ ] | P3 | Full Rabby security stack integration | Rabby | High | `@rabby-wallet/rabby-api`, `rabby-action`, `rabby-security-engine` — only if opt-in + acceptable third-party dependency |
| [ ] | P3 | SecSDK / warden-for-js prod sandbox | Rabby | Medium | Build-time per-dependency global access policies on top of LavaMoat |

### MetaMask-style checklist

Benchmark from MetaMask security analysis. **1337 score is our implementation status**, not MetaMask's.

#### Dapp Permissions (MetaMask ref: 35/35)

| Done | Feature | Weight | 1337 status | Notes |
|------|---------|--------|-------------|-------|
| [~] | User confirmation before processing requests | 8.7 | Partial | Normal queues in `TxApprovalSheet`; Instant auto-signs ordinary requests, gated risks still confirm. Hardware always confirms. `txConfirmMode.ts` |
| [~] | User consent for dApp access | 7.7 | Partial | Manual connect via `DappConnectionBar`; **`eth_requestAccounts` silently connects**. Kept by design (site stays connected). `providerRpc.ts` |
| [x] | Wallet unlock before requests | 5.6 | Done | Locked wallet returns `4100`; unlock UI opens on account request |
| [x] | Mismatching EIP-712 chainId detection | 3.5 | Done | Warns in approval UI; Instant pauses unless ungated. `txRisk.ts` |
| [x] | `eth_sign` method disabled | 3.3 | Done | Rejected with `4200`. Use `personal_sign` / `eth_signTypedData_v4` |
| [x] | Mismatching SIWE domain detection | 1.8 | Done | Parses EIP-4361; domain/URI/chain vs page origin. `siwe.ts` |
| [x] | Connected dApp management | 1.5 | Done | Per-origin connect/disconnect + `wallet_revokePermissions` + Settings → Connected sites |
| [x] | Token approval management | 1.5 | Done | ERC-20, NFT `setApprovalForAll`, Permit2 in Tools → Approvals |
| [-] | User confirmation before switching chains | 1.1 | Deferred | Auto-switch kept (no reconnect required) |

#### Intent Verification (MetaMask ref: 15.6/25)

| Done | Feature | Weight | 1337 status | Notes |
|------|---------|--------|-------------|-------|
| [~] | Transaction simulation | 6.7 | Partial | Local `eth_call` pass/fail/revert on confirm. No balance-change preview (signer.md) |
| [~] | Clear message signing dialog | 3.8 | Partial | SIWE + permit + token-approval cards; remaining views still developer-oriented |
| [x] | EIP-712 message parsing | 2.4 | Done | Domain, types, message fields, raw JSON |
| [x] | Invalid address checksum detection | 2.2 | Done | Mixed-case EIP-55 mismatch warned on confirm (`addressChecksum.ts`) |
| [x] | Clear token approval dialog | 6.7 | Done | Dedicated Approve / Permit cards. Instant still auto-signs unless that gate is on |
| [~] | Mandatory message review | 2.1 | Partial | Required in Normal; Instant skips ordinary requests but not gated risks (default) |
| [x] | Links to blockchain explorers | 1.2 | Done | Address/tx/contract links across approvals, history, gas, swap |

#### Physical Access (MetaMask ref: 11.7/20)

| Done | Feature | Weight | 1337 status | Notes |
|------|---------|--------|-------------|-------|
| [~] | Seed phrase access control | 5.4 | Partial | PBKDF2 + AES-GCM vault; mnemonic in UI memory while unlocked; **no post-onboarding seed reveal UI** |
| [x] | Manual wallet lock | 3.9 | Done | Settings Lock clears session + in-memory keys |
| [~] | Seed phrase access warning | 1.8 | Partial | One-time backup warning at wallet creation only |
| [~] | Automatic wallet lock | 3.4 | Partial | Implemented but **off by default** (5/15/30/60 min idle) |
| [ ] | Robust authentication (biometrics / passkeys) | 3.3 | Missing | Password-only unlock |
| [ ] | Clipboard seed phrase leak prevention | 1.8 | Missing | Private key copy allowed with no auto-clear |

#### Threat Prevention (MetaMask ref: 20/20)

| Done | Feature | Weight | 1337 status | Notes |
|------|---------|--------|-------------|-------|
| [ ] | Phishing dApp detection | 5.1 | Missing | No blocklists or domain reputation. See "Connect-time security hints" |
| [ ] | Malicious address detection | 5.1 | Missing | No blocklists or drainer/scam databases |
| [ ] | Trusted dApp detection | 3.3 | Missing | No allowlist or known-good dApp registry |
| [~] | Unknown address detection | 2.8 | Partial | Unknown function selectors flagged `warn`; no address-book checks |
| [x] | Full dApp URL display | 1.5 | Done | Confirm sheet shows hostname + path/query from `pageUrl` |
| [~] | Malicious or spam token filtering | 1.3 | Partial | Approvals scoped to wallet token list; unlimited warned, not blocked |
| [ ] | dApp access disclosure dialog | 1.0 | Missing | Silent `eth_requestAccounts`; kept by design for now |

#### Scorecard

| Category | Done | Partial | Missing |
|----------|------|---------|---------|
| Dapp Permissions | 5 | 3 | 0 (1 deferred) |
| Intent Verification | 3 | 4 | 0 |
| Physical Access | 1 | 4 | 2 |
| Threat Prevention | 0 | 3 | 4 |
| **Total (29 items)** | **9** | **14** | **5** (+1 deferred) |

#### Open follow-ups (from the last sprint)

Done this round: disable `eth_sign`, EIP-712 chainId mismatch, SIWE mismatch, token approval UI, risk-gated Instant. Deferred: connect consent dialog, chain-switch confirmation.

| Done | Item | Notes |
|------|------|-------|
| [ ] | Phishing / malicious address checks | Local blocklist or opt-in Rabby/DeBank API |
| [ ] | Clipboard hygiene | Auto-clear copied secrets; warn on seed/key copy |
| [ ] | Auto-lock on by default | Or prompt during onboarding |
| [x] | Full URL display in approval | Show path + query, not just hostname |
| [x] | Explicit checksum warnings | Surface invalid/mixed-case addresses before sign |
| [x] | Connected sites manager | List all origins, per-site revoke and settings |
| [x] | Per-origin MetaMask-compat | Hide is1337 / announce as MetaMask per origin; reload tab after change |
| [ ] | Robust auth (WebAuthn) | Optional passkey/biometric unlock |
| [-] | dApp access disclosure dialog | Deferred with silent connect |

---

### Hardware wallet gaps

Ledger/Trezor work for dapp signing, Quick Send, Multisend, Swap, Gas, and ENS. Device confirm goes through the approval sheet.

| Done | P | Item | Notes |
|------|---|------|-------|
| [x] | P1 | Multisend on hardware | Disperse.app batch (`MultiSendView`). One device confirm (plus ERC-20 approve). First-user CreateX deploy when the contract is missing — `docs/signer.md`. |
| [x] | P1 | ENS register / records on hardware | Routes through `sendTransactionRequest` → device confirm. Ledger may still need blind-sign on some controllers. `EnsView.tsx` |
| [x] | P2 | Gas Station execute on hardware | LiFi path via `executeLiFiStep` + device confirm sheet |
| [x] | P2 | Swap execute on hardware | Same LiFi + HW confirm path as Gas Station |
| [x] | P2 | Unified “HW unsupported” empty states | Shared `HardwareSignHint` for Swap/Gas; remaining Tools use the same device confirm sheet |

---

## Features

Product, UX, infra, and platform work that is not a security control.

### Backlog

| Done | P | Item | Source | Effort | Notes |
|------|---|------|--------|--------|-------|
| [x] | P0 | Per-origin MetaMask-compat mode | Rabby | Low | Hide `is1337` / announce as MetaMask in EIP-6963 per origin. Settings → Connected sites. `dappCompat.ts` |
| [x] | P1 | Playwright E2E (extension load + bootstrap) | Ambire | Medium | `e2e/` + `docs/testing.md`. Hardware / live dapps: `docs/release-manual-testing.md` |
| [~] | P1 | Lightweight tx humanizer (local) | Ambire | Medium | Confirm sheet + History titles. See `src/lib/txHumanize.ts`. Expand known selectors as needed |
| [ ] | P2 | Chain list sync + fallback pattern | Rabby | Medium | Remote-first catalog + local fallback + periodic refresh; unify `findChain()` across RPC, UI, provider. See `src/lib/chainCatalog.ts`, `chainRpcRegistry.ts` |
| [ ] | P2 | Release pipeline: strip sourcemaps + zip | Ambire | Low | `build:extensions`-style script for store uploads; maps in GitHub release artifacts |
| [x] | P1 | Blockscout fallback when Etherscan Free excludes the chain | 1337 | Medium | OP/Base/Scroll/zkSync/Ink/Gnosis via per-instance Blockscout. BSC/Avalanche have no instance. `explorerApis.ts`. See `docs/explorer-history.md` |
| [ ] | P2 | Four-byte + contract source in approval (expand) | 1337 + Rabby | Low | Already partial via `fourByteDirectory.ts`, `explorerContractSource.ts` — expand coverage and surface in action UI |
| [ ] | P3 | EIP-7702 / smart-account path | Ambire | High | `AccountOp`-style abstraction, delegation UI, `sign7702` on signers. Needs relayer/bundler strategy |
| [ ] | P3 | Cross-browser builds (Firefox / Safari) | Ambire | High | `WEB_ENGINE` env, gecko manifest transforms, Safari converter. Only if store expansion is a goal |
| [ ] | P3 | Embedded Benzin-style explorer | Ambire | Medium | Standalone decode app + in-wallet preview; depends on humanizer investment |
| [ ] | P3 | Shared logic submodule (`ambire-common` pattern) | Ambire | High | Only if mobile or multiple apps share vault/signing logic |

---

## Signer backlog (only if users ask)

1337 is a **signer**, not a lab. See [docs/signer.md](./docs/signer.md). Do not build these as Tools tabs unless someone asks — then opt-in, default off.

| Done | Item | Why it waits |
|------|------|--------------|
| [ ] | ABI encode/decode, selector / event lookup | `cast` / 4byte.directory |
| [ ] | Read / Write Contract | Etherscan or `cast call` / `cast send` |
| [ ] | Storage slot / layout | `cast storage` |
| [ ] | CREATE / CREATE2, keccak, converters | Foundry. Multisend’s pinned CreateX plant of Disperse is not this. |
| [ ] | Standalone signature / calldata lab | Confirm sheet already decodes what you sign |
| [ ] | Tenderly-style asset-diff simulation | Needs a third-party sim API |
| [ ] | Other-address multichain activity | Explorer / DeBank |
| [ ] | NFT collection browser | Marketplace |

---

## Explicitly not planned (unless scope changes)

| Kind | Item | Source | Reason |
|------|------|--------|--------|
| Security / privacy | DeBank/Rabby backend as default | Rabby | Conflicts with "no 1337 server" / privacy claims |
| Feature | React Native Web monolith | Ambire | Heavy; current React + webpack stack is sufficient |
| Feature | Built-in Rabby swap/bridge | Rabby | LiFi already covers swaps |
| Feature | Ambire Gas Tank / relayer infra | Ambire | Custodial-ish UX + server dependency |
| Feature | Global MetaMask-only impersonation | Rabby | Prefer per-site override over hiding 1337 everywhere |

---

## Comparison matrix (for prioritization debates)

| Dimension | Rabby-heavy items | Ambire-heavy items | 1337-native items |
|-----------|-------------------|--------------------|--------------------|
| **User-visible UX** | Simulation, action UI, security badges | Humanizer, Benzin decode | Instant, multi-RPC, side panel |
| **Security engineering** | Rule engine, preExec, SecSDK | Unsafe-layer, E2E secrets leak, CI gates | LavaMoat, Instant gates, session model |
| **Privacy fit** | ⚠️ DeBank API needs opt-in | ⚠️ 4337/bundler needs opt-in | ✅ No telemetry, local-first |
| **Dev audience fit** | Tx explain, contract decode | AccountOp, 7702, debugging | Speed, RPC doctor, LiFi, hardware |
| **Effort vs impact** | Medium effort, high UX for Normal mode | Low–medium for infra; high for smart accounts | Low for docs/gates; medium for risk-gated Instant |

---

## Related docs

- [README.md](./README.md) — features and build
- [docs/signer.md](./docs/signer.md) — **signer, not a lab** (product guideline)
- [docs/wallet-security.md](./docs/wallet-security.md) — security model
- [docs/wallet-comparison-metamask.md](./docs/wallet-comparison-metamask.md) — MetaMask comparison
- [docs/explorer-history.md](./docs/explorer-history.md) — Etherscan Free vs paid, Blockscout fallback
- [docs/testing.md](./docs/testing.md) — unit + Playwright E2E
- [docs/release-manual-testing.md](./docs/release-manual-testing.md) — pre-release human checklist (hardware, live dapps)
- [website/src/app/integrate/page.tsx](./website/src/app/integrate/page.tsx) — dapp integration (EIP-6963)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-09-02 | Vitest unit suite + Playwright extension E2E + pre-release manual checklist (`docs/testing.md`, `docs/release-manual-testing.md`) |
| 2026-08-19 | Blockscout fallback for History/Approvals when Etherscan Free excludes the chain (`explorerApis.ts`) |
| 2026-08-19 | Document Etherscan Free vs paid chain coverage + Blockscout/RPC notes (`docs/explorer-history.md`) |
| 2026-08-19 | Confirm sheet Send/Swap/Unknown cards, full page URL, checksum warnings; connected sites + per-origin MetaMask-compat; Swap/Gas on hardware |
| 2026-08-17 | Signer guideline (`docs/signer.md`): confirm-time humanize/simulate/hints, Inspect, Approvals+=NFT+Permit2; lab tools deferred until asked |
| 2026-08-16 | Hardware gaps section (Multisend, ENS, Gas, Swap); Multisend Instant confirm-per-recipient |
| 2026-08-14 | Split TODO into Security vs Features |
| 2026-08-14 | Security sprint: disable eth_sign; EIP-712 chainId + SIWE checks; token approval cards; Instant gates in Settings |
| 2026-08-09 | MetaMask-style security audit checklist (29 items) |
| 2026-08-09 | Initial list from Rabby + Ambire repo analysis |
