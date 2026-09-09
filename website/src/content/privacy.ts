export const PRIVACY_UPDATED = '9 September 2026';

export const PRIVACY_SUMMARY =
  '1337 Wallet does not run analytics, does not phone home to a tracking server, and does not create user profiles. Your vault, settings, and session live in Chrome extension storage on your machine.';

export const PRIVACY_STORED = [
  'Encrypted vault (seed / private keys) in chrome.storage.local',
  'Wallet settings, custom RPCs, and chain preferences in chrome.storage.local',
  'Unlocked session (active key metadata) in chrome.storage.session until lock or browser restart',
] as const;

export const PRIVACY_NETWORK = [
  'Public RPC endpoints you choose (balances, sends, dapp reads)',
  'LI.FI API when you open Swap or fetch routes (integrator id only; no 1337 backend)',
  'Optional Etherscan-compatible API key you paste in Settings (sent to the explorer provider for tx history)',
  'Optional The Graph API key for ENS portfolio listing',
  'Ledger / Trezor device SDKs and Trezor Connect (connect.trezor.io) when you use hardware accounts',
  'Token logos and chain metadata from public HTTPS URLs (e.g. LI.FI catalog)',
] as const;

export const PRIVACY_NEVER = [
  'Browsing history beyond what Chrome grants for dapp connection',
  'Wallet addresses or balances sent to a 1337 database',
  'Crash or usage telemetry to 1337',
  'Email, phone, or social login',
] as const;
