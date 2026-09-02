# Testing 1337

Two layers:

1. **Unit tests** — signer logic (risk gates, SIWE, vault, humanizer, provider flags). Fast, no Chrome.
2. **Playwright E2E** — loads the unpacked MV3 build, seeds a test vault, and drives the popup plus a dapp tab.

Hardware wallets, store listing, and live mainnet money movement are **not** automated. Walk [release-manual-testing.md](./release-manual-testing.md) before a store release. To re-prompt Ledger HID / re-init Trezor Connect on an unpacked build, inspect the **1337 service worker** (not a website tab) and run `await chrome.runtime.sendMessage({ type: 'HW_RESET' })`.

## Commands

```bash
npm install
npx playwright install chromium   # once per machine
npm run icons                     # once per machine (PNGs are generated)

npm run test:unit                 # Vitest
npm run test:watch

npm run test:e2e                  # rebuilds dist/, then Playwright --load-extension=dist
npm run test:all                  # unit, then E2E
```

`test:e2e` always runs `npm run build` first (a few seconds). This matters: `npm run lavamoat:check` / `build:policy` overwrite `dist/` with a **policy-generation** build whose service worker does not run normally — testing that dist fails all E2E with `waiting for event "serviceworker"` timeouts.

CI runs unit tests and E2E on every push/PR (`.github/workflows/test.yml`). LavaMoat policy stay in `.github/workflows/lavamoat-policy.yml`.

## What the automated suite covers

| Layer | Surfaces |
|-------|----------|
| Unit | SIWE, EIP-55 checksums, Burner Mode gates, `classifyRequest` / confirm queue, vault encrypt/decrypt, HD derivation (Anvil phrase), Inspect parse, Tools catalog, signing history, Disperse/CreateX pins, dapp MetaMask-compat flags, history/confirm humanizer |
| E2E | Create / import onboarding, unlock + lock, Assets / History / Tools, Signings default + opt-in Inspect, `window.ethereum` inject, silent `eth_requestAccounts`, `eth_sign` disabled, chain switch, confirm/reject `personal_sign`, SIWE mismatch copy, unlimited-approve card, Burner Mode auto-sign of an ordinary message, network scan for mnemonic/private key |

E2E imports the Anvil test phrase through the onboarding UI. We cannot write `chrome.storage` from Playwright’s service-worker `evaluate` — LavaMoat scuttles `eval` in the background bundle (that is intended).

The E2E vault uses the public Anvil phrase `test test … junk`. That account is not a secret.

## Adding tests

- Pure logic → `tests/unit/*.test.ts` (import from `src/lib`).
- Extension UI / provider → `e2e/*.spec.ts` using `e2e/fixtures.ts`.
- Prefer `data-testid` already on onboarding, unlock, tabs, confirm sheet, Inspect.
- Do not add Foundry/Etherscan lab coverage unless that product surface exists (see [signer.md](./signer.md)).
