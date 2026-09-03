# Security comparison: 1337 wallet types vs MetaMask

Side-by-side view of **every 1337 account type** against the closest **MetaMask** equivalent. 1337 is an advanced Chrome MV3 Ethereum wallet for developers and power users; MetaMask is a general-purpose browser hot wallet. Hardware rows describe keys that never leave the device.

Sources for 1337: `src/lib/vault.ts`, `src/lib/walletCore.ts`, `src/lib/walletManager.ts`, `src/lib/ledger.ts`, `src/lib/trezor.ts`, `src/background.ts`, `src/lib/providerRpc.ts`, `public/manifest.json`.

---

## Wallet types covered

| 1337 type | How you get it | Closest MetaMask equivalent |
|--------------|----------------|-----------------------------|
| **Local seed (HD)** | Create / import BIP-39 phrase; derive `m/44'/60'/0'/0/n` | MetaMask default wallet (Secret Recovery Phrase) |
| **Local private key** | Generate or import a single hex key (no seed) | MetaMask “Import account” → Private key |
| **Ledger** | Connect Ledger via WebHID; address + path stored | MetaMask “Connect hardware wallet” → Ledger |
| **Trezor** | Connect via Trezor Connect popup; address + path stored | MetaMask “Connect hardware wallet” → Trezor |

---

## Master comparison

| Topic | MetaMask (software / SRP) | 1337 local seed | 1337 local private key | MetaMask + Ledger/Trezor | 1337 Ledger / Trezor |
|-------|---------------------------|--------------------|---------------------------|--------------------------|-------------------------|
| **Custody class** | Hot software | Hot software | Hot software | Cold keys, hot UI | Cold keys, hot UI |
| **Secret at rest** | Encrypted vault (SRP + derived keys) | Encrypted vault (`keys` + optional `mnemonic`) in `chrome.storage.local` | Encrypted vault (`keys` only) | Device holds seed; MM stores pubkey metadata | Device holds seed; 1337 stores address / path / label only |
| **Vault crypto** | KDF + symmetric encryption | PBKDF2 210k SHA-256 + AES-GCM-256 | Same | N/A for device seed | N/A for device seed |
| **Recovery** | 12-word SRP | 12-word BIP-39 (create default); 12–24 on import | Hex private key backup only | Device seed / backup (Ledger/Trezor flow) | Same device recovery model |
| **Multi-account** | HD accounts from SRP | HD accounts via “Add from seed” | One key per account; generate/import more | Multiple device paths / accounts | Path field + multiple hardware accounts |
| **While unlocked** | Decrypted material in extension memory | Keys (+ mnemonic) in UI memory; **active PK plaintext in `chrome.storage.session`** | Same session model | MM session for UI; signatures on device | Same; **no PK in session** for hardware — address + path only |
| **Signing location** | Extension (software) | Extension (viem) | Extension (viem) | Device (MM prompts device) | Device (Ledger WebHID / Trezor Connect) |
| **dApp confirm default** | Confirm every request | **Normal** confirm (Turbo = auto-sign opt-in) | Same | Confirm in MM + on device | Hardware always needs device confirm; Normal/Turbo queues UI then device |
| **Auto-lock default** | User setting | **Off** by default | Same | Same as MM software session | Same 1337 auto-lock (session metadata) |
| **Close UI = locked?** | No | No | No | No | No |
| **Browser restart** | Relock; vault remains | Relock; vault remains | Same | Relock MM; device unchanged | Relock 1337; device unchanged |
| **Offline vault dump** | Password-guess ciphertext | Same (+ mnemonic inside ciphertext if present) | Same (keys only) | No seed in browser | No seed in browser |
| **Unlocked malware** | Can sign / exfiltrate hot keys | Can sign / read session PK (+ mnemonic in UI memory) | Can sign / read session PK | Can request signatures; still needs device approval | Can request signatures; still needs device approval |
| **Intended use** | General self-custody | Dev / burner HD wallet | Dev / single-key burner | Higher-security self-custody | Same class as MM+HW inside 1337 UX |

---

## Topic notes by wallet type

### 1. MetaMask software (Secret Recovery Phrase)

- BIP-39 SRP → HD derivation; many accounts from one backup.
- Password encrypts the vault at rest; unlocked session is the main hot-wallet risk.
- Default UX: **review every** dApp sign/send in the extension.

**1337 local seed** matches this *model* (create/import phrase, derive `m/44'/60'/0'/0/n`) but keeps 1337’s **session convenience**: Normal confirm by default, optional Turbo auto-sign, auto-lock off by default, and plaintext **active** private key in `chrome.storage.session` while unlocked.

### 2. 1337 local seed (HD)

- Create generates a **12-word** English BIP-39 phrase; import accepts **12–24** words.
- Phrase is stored **inside the encrypted vault payload** (`mnemonic` + per-account private keys).
- “Add from seed” derives the next index (Account 1, 2, …) like MetaMask’s account list.
- Backup surface is the **seed phrase** (controls all derived accounts), not only one key.

### 3. 1337 local private key (and MetaMask “Import private key”)

- Single secp256k1 key; no HD parent in the vault unless you separately import a seed.
- Create-without-seed or import hex `0x` + 64 chars.
- MetaMask equivalent: **Import account → Private key** (still lives in MM’s encrypted vault).
- Same 1337 unlocked-session caveats as seed accounts for that active key.

### 4. MetaMask + Ledger / Trezor

- MetaMask is the dApp bridge and UI; **private keys stay on the device**.
- User confirms on the hardware screen; MM never learns the seed.
- Best practice for meaningful funds when you still want a browser wallet UX.

### 5. 1337 Ledger / Trezor

- **Ledger:** `@ledgerhq/hw-transport-webhid` + `@ledgerhq/hw-app-eth` (WebHID / `navigator.hid`). Blind signing may be required depending on app settings.
- **Trezor:** `@trezor/connect-webextension` in the service worker; Connect popup on `connect.trezor.io`.
- Persisted data: address, label, derivation path, kind — **never** the device seed.
- Signing for sends / swaps / dApp `eth_sendTransaction`, `personal_sign`, and EIP-712 typed data goes through the device SDK.

---

## Threat model cheat sheet

| Threat | Local seed / PK (1337) | Ledger / Trezor (1337 or MM) |
|--------|---------------------------|----------------------------------|
| Stolen locked browser profile | Password-guess vault | Address metadata only; funds need device |
| Stolen unlocked browser profile | **High** — session PK (+ seed in 1337 UI memory if present) | Attacker can *prompt* signs; user must approve on device |
| Malicious dApp | Turbo may auto-sign (1337); enable Normal | Device shows tx; user is last line of defense |
| Phishing fake extension | Same as any hot wallet | Device still protects if user verifies address/amount on screen |
| Lost backup | Lose seed or PK → lose funds | Device seed/backup process (vendor-specific) |

---

## Practical recommendations

1. **Burner / test funds** — 1337 local seed or private key is fine; keep Turbo if you want speed; enable auto-lock if the machine is shared.
2. **Real funds in browser** — Prefer **Ledger or Trezor** (1337 or MetaMask), Normal confirmations, verify every device prompt.
3. **MetaMask vs 1337 software** — Same custody *class*; MetaMask wins on conservative defaults (confirm-every-tx, mature SRP UX). 1337 wins on multi-RPC / LiFi / multi-send / burner workflow — accept hotter unlocked-state tradeoffs.
4. **Seed vs private key in 1337** — Prefer **seed** if you want MetaMask-like multiple derived accounts from one backup. Use **private key** for disposable single-account burners.

---

## Summary

| Dimension | Safest in this matrix | Notes |
|-----------|----------------------|--------|
| Key never in browser | Ledger / Trezor (1337 or MM) | Best for value |
| Familiar HD recovery | MetaMask SRP ≈ 1337 local seed | 1337 seed is newer; verify backups |
| Disposable account | 1337 private key | No phrase to leak across accounts |
| Default signing safety | MetaMask ≈ 1337 Normal | 1337 Turbo is opt-in convenience |
| Unlocked session on disk | MetaMask (typically memory) | 1337 stores active PK in session storage |

For material holdings: **hardware wallet + confirm-on-device**, whether through MetaMask or 1337. Treat 1337 software accounts as **hot burners** unless you consciously harden (keep Normal, enable auto-lock, strong password, separate browser profile); avoid Turbo with real funds.

---

## Related docs & source

- [Wallet security model](./wallet-security.md) — operational risks and mitigations
- `src/lib/walletCore.ts` — mnemonic + private key helpers
- `src/lib/vault.ts` — vault encryption (`keys` + optional `mnemonic`)
- `src/lib/walletManager.ts` — create / import / derive accounts
- `src/lib/ledger.ts` / `src/lib/trezor.ts` — hardware SDKs
- `src/background.ts` — session persistence, auto-lock
- `src/lib/providerRpc.ts` — dApp RPC and Turbo vs Normal signing
