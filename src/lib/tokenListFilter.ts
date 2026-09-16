import { DUST_USD, isNativeWalletToken, tokenUsdNumber, type WalletBalEntry } from './walletBalances';

function looksLikeSpamToken(entry: WalletBalEntry): boolean {
  const name = entry.name?.trim() ?? '';
  const symbol = entry.symbol?.trim() ?? '';
  const blob = `${name} ${symbol}`.toLowerCase();
  if (/https?:\/\/|www\.|\.com\b|\.xyz\b|\.events\b|\.io\b|\.app\b/.test(blob)) return true;
  if (/via\s+www\./i.test(name)) return true;
  if (/^\s*!/.test(name) || /^\s*!/.test(symbol)) return true;
  return false;
}

/**
 * Main Assets row: native, anything with real USD value (untouched airdrops too),
 * or no-value tokens the user has sent/swapped. Untouched dust/spam stays in Other.
 */
export function isMainAssetRow(
  entry: WalletBalEntry,
  opts: { hidden: Set<string>; touched: Set<string>; watched?: Set<string> },
): boolean {
  const addr = entry.address.toLowerCase();
  if (opts.hidden.has(addr)) return false;
  if (isNativeWalletToken(entry)) return true;
  if (tokenUsdNumber(entry) >= DUST_USD) return true;
  if (opts.touched.has(addr)) return true;
  if (opts.watched?.has(addr)) return true;
  if (looksLikeSpamToken(entry)) return false;
  return false;
}
