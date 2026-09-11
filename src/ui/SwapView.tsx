import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatUnits, getAddress, parseUnits } from 'viem';
import { getQuote, getStatus, getTokens } from '@lifi/sdk';
import { ChainType, CoinKey, TokenTag } from '@lifi/types';
import type { ExtendedChain, LiFiStep, Token, TokenExtended } from '@lifi/types';
import { getUnlockedAccount, getActiveAccountMeta, getSessionPrivateKey } from '../lib/accountSession';
import { isHardwareAccount } from '../lib/accounts';
import type { AppSettings } from '../lib/storageState';
import { effectiveActiveChainId, effectiveSlippageRatio } from '../lib/storageState';
import { shouldConfirmInWalletSend } from '../lib/txConfirmMode';
import { sortEvmChainIds, sortExtendedChains } from '../lib/chainPopularity';
import { loadEvmMainnetChains } from '../lib/lifiBootstrap';
import { summarizeApiError } from '../lib/errors';
import { reportDevError } from '../lib/devErrorLog';
import { executeLiFiStep } from '../lib/lifiExecute';
import { snapshotHeldTokensOnChain } from '../lib/ethereum';
import type { OnChainBalanceProbe } from '../lib/ethereum';
import { transactionExplorerUrl } from '../lib/explorerUrls';
import { appendSwapToHistory, loadSwapHistory, type SwapHistoryEntry } from '../lib/swapHistory';
import { markTokensTouched } from '../lib/assetTokenPrefs';
import { loadSwapUi, saveSwapUi } from '../lib/swapUiPersist';
import { loadWalletBalancesMap } from '../lib/walletBalances';
import { ScreenHeader } from './ScreenHeader';
import { LiFiIcon } from './LiFiIcon';
import { TokenWithBadge } from './TokenWithBadge';
import { DefiYieldPanel } from './DefiYieldPanel';
import { RefreshIconButton } from './RefreshIconButton';

type WalletTab = 'swap' | 'defi' | 'history';

/** Prefer on-chain RPC snapshot for these chains vs stale LiFi `getWalletBalances`. */
const RPC_BALANCE_OVERRIDE_TTL_MS = 120_000;

type BalEntry = {
  address: string;
  symbol: string;
  decimals: number;
  amount: string;
  chainId: number;
  name: string;
  priceUSD?: string;
  logoURI?: string;
};

const ZERO = '0x0000000000000000000000000000000000000000';
const ETH_PLACEHOLDER = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

function isNativeToken(addr: string): boolean {
  const a = addr.toLowerCase();
  return a === ZERO || a === ETH_PLACEHOLDER;
}

function tokenKeyForQuote(addr: string): string {
  try {
    return isNativeToken(addr) ? addr : getAddress(addr);
  } catch {
    return addr;
  }
}

function fmtNum(n: number, d = 6): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1 || n === 0) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumSignificantDigits: d });
}

/** @returns true when string is a plausible positive decimal amount */
function parseHumanAmount(s: string): { ok: true; raw: string } | { ok: false; reason: string } {
  const t = s.trim().replace(/\s/g, '');
  if (!t) return { ok: false, reason: 'Enter an amount.' };
  if (!/^\d*(\.\d+)?$/.test(t))
    return { ok: false, reason: 'Use digits and at most one decimal point.' };
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0)
    return { ok: false, reason: 'Amount must be greater than zero.' };
  return { ok: true, raw: t };
}

function addressesMatchPayToken(a: string, b: string): boolean {
  if (isNativeToken(a) && isNativeToken(b)) return true;
  try {
    return getAddress(a).toLowerCase() === getAddress(b).toLowerCase();
  } catch {
    return a.toLowerCase() === b.toLowerCase();
  }
}

function normalizeLower(addr: string): string {
  try {
    return getAddress(addr).toLowerCase();
  } catch {
    return addr.toLowerCase();
  }
}

function buildBalanceMaps(bals: BalEntry[]): {
  native?: BalEntry;
  byAddr: Map<string, BalEntry>;
} {
  const byAddr = new Map<string, BalEntry>();
  let native: BalEntry | undefined;
  for (const b of bals) {
    const lo = b.address.toLowerCase();
    byAddr.set(lo, b);
    try {
      byAddr.set(getAddress(b.address).toLowerCase(), b);
    } catch {
      /* ignore */
    }
    if (isNativeToken(b.address)) native = b;
  }
  return { native, byAddr };
}

function balanceForLiToken(
  t: Token,
  maps: ReturnType<typeof buildBalanceMaps>
): BalEntry | undefined {
  if (isNativeToken(t.address)) return maps.native;
  const lo = t.address.toLowerCase();
  return maps.byAddr.get(lo) ?? maps.byAddr.get(normalizeLower(t.address));
}

function tokenToBalEntry(t: Token, chainId: number, bal?: BalEntry): BalEntry {
  return {
    address: t.address,
    symbol: t.symbol,
    decimals: t.decimals,
    amount: bal?.amount ?? '0',
    chainId,
    name: t.name,
    logoURI: t.logoURI ?? bal?.logoURI,
    priceUSD: bal?.priceUSD ?? t.priceUSD,
  };
}

/** Minimal Li.FI `Token` built from a balance row (used when flipping pair on the same chain). */
function balEntryToToken(b: BalEntry): Token {
  return {
    address: b.address,
    chainId: b.chainId,
    decimals: b.decimals,
    symbol: b.symbol,
    name: b.name,
    logoURI: b.logoURI,
    priceUSD: b.priceUSD,
  } as Token;
}

function dedupeTokensForChain(tokens: Token[], chainId: number): Token[] {
  const seen = new Set<string>();
  const out: Token[] = [];
  for (const t of tokens) {
    const k = isNativeToken(t.address) ? `native:${chainId}` : normalizeLower(t.address);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** LiFi extended token fields when `getTokens({ extended: true })`. */
type TokenWithLiquidity = Token & Partial<Pick<TokenExtended, 'volumeUSD24H' | 'marketCapUSD'>>;

function tokenHasTag(t: Token, tag: TokenTag): boolean {
  return (t.tags ?? []).includes(tag);
}

const WRAPPED_MAJOR_KEYS = new Set<string>([CoinKey.WETH, CoinKey.WBTC]);

const STABLE_COIN_KEYS = new Set<string>([
  CoinKey.USDT,
  CoinKey.USDC,
  CoinKey.DAI,
  CoinKey.BUSD,
  CoinKey.USDCe,
  CoinKey.USDCn,
  CoinKey.USDe,
  CoinKey.USDB,
  CoinKey.FRAX,
  CoinKey.FDUSD,
  CoinKey.GHO,
  CoinKey.HONEY,
  CoinKey.BYUSD,
  CoinKey.FEUSD,
  CoinKey.USDT0,
  CoinKey.AXLUSDC,
  CoinKey.USDF,
  CoinKey.USDm,
  CoinKey.PathUSD,
  CoinKey.USD1,
]);

/**
 * Groups for default ordering within the same wallet-balance bracket.
 * Lower = closer to top: native gas, majors & wraps, stablecoins, other tagged majors, everything else + volume/mcap from LiFi.
 */
function pinTier(t: Token): number {
  if (isNativeToken(t.address)) return 0;
  const ck = t.coinKey;
  if (ck && WRAPPED_MAJOR_KEYS.has(ck)) return 0;
  if (tokenHasTag(t, TokenTag.STABLECOIN) || (ck && STABLE_COIN_KEYS.has(ck))) return 1;
  if (tokenHasTag(t, TokenTag.MAJOR_ASSET)) return 2;
  return 3;
}

function liquidityScore(t: TokenWithLiquidity): number {
  const v = t.volumeUSD24H;
  const m = t.marketCapUSD;
  const vv = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  const mm = typeof m === 'number' && Number.isFinite(m) ? m : 0;
  return vv + mm * 0.02;
}

function compareTokensByPopularity(a: Token, b: Token): number {
  const pa = pinTier(a);
  const pb = pinTier(b);
  if (pa !== pb) return pa - pb;
  const la = liquidityScore(a);
  const lb = liquidityScore(b);
  if (lb !== la) return lb > la ? 1 : -1;
  return a.symbol.localeCompare(b.symbol);
}

function compareFromPickerRows(a: Token, rowA: BalEntry, b: Token, rowB: BalEntry): number {
  const balA = safeBigIntAmount(rowA.amount) > 0n ? 1 : 0;
  const balB = safeBigIntAmount(rowB.amount) > 0n ? 1 : 0;
  if (balB !== balA) return balB - balA;
  return compareTokensByPopularity(a, b);
}

function safeBigIntAmount(s: string): bigint {
  try {
    return BigInt(s || '0');
  } catch {
    return 0n;
  }
}

function formatSwapHistoryRelTime(at: number): string {
  const d = Date.now() - at;
  if (d < 45_000) return 'Just now';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return new Date(at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function balEntryToProbe(b: BalEntry): OnChainBalanceProbe {
  return {
    address: b.address,
    decimals: b.decimals,
    symbol: b.symbol,
    name: b.name,
    logoURI: b.logoURI,
    priceUSD: b.priceUSD,
  };
}

function tokenToProbe(t: Token): OnChainBalanceProbe {
  return {
    address: t.address,
    decimals: t.decimals,
    symbol: t.symbol,
    name: t.name,
    logoURI: t.logoURI,
    priceUSD: t.priceUSD != null ? String(t.priceUSD) : undefined,
  };
}

function compareBalEntriesByBalanceThenSymbol(a: BalEntry, b: BalEntry): number {
  const ba = safeBigIntAmount(a.amount) > 0n ? 1 : 0;
  const bb = safeBigIntAmount(b.amount) > 0n ? 1 : 0;
  if (bb !== ba) return bb - ba;
  return a.symbol.localeCompare(b.symbol);
}

function SwapExecLog({
  log,
  tx,
  chainById,
}: {
  log: string;
  tx: { chainId: number; hash: `0x${string}` } | null;
  chainById: Map<number, ExtendedChain>;
}) {
  const chain = tx ? chainById.get(tx.chainId) : undefined;
  const url = tx ? transactionExplorerUrl(tx.chainId, tx.hash, chain) : undefined;
  const explorerHint = chain?.name != null ? `${chain.name} explorer` : 'Block explorer';

  if (url && tx && log.includes(tx.hash)) {
    const i = log.indexOf(tx.hash);
    return (
      <div className="w1337-exec-log">
        <p className="w1337-exec-log__text">
          {log.slice(0, i)}
          <a href={url} target="_blank" rel="noopener noreferrer" className="w1337-tx-link mono">
            {tx.hash}
          </a>
          {log.slice(i + tx.hash.length)}
        </p>
      </div>
    );
  }

  return (
    <div className="w1337-exec-log">
      <p className="w1337-exec-log__text">{log}</p>
      {url && tx ? (
        <p className="w1337-exec-log__sub">
          <a href={url} target="_blank" rel="noopener noreferrer" className="w1337-tx-link">
            Open in {explorerHint} ↗
          </a>
        </p>
      ) : null}
    </div>
  );
}

export function SwapView({
  settings,
  onOpenSettings,
  embedded = false,
}: {
  settings: AppSettings;
  onOpenSettings?: () => void;
  embedded?: boolean;
}) {
  const account = getUnlockedAccount();
  const addr = account?.address;
  const meta = getActiveAccountMeta();
  const hw = Boolean(meta && isHardwareAccount(meta));
  const canSend = Boolean(getSessionPrivateKey() || hw);
  const activeChainId = effectiveActiveChainId(settings);
  const needsConfirm = shouldConfirmInWalletSend(settings) && !hw;

  const [evmChains, setEvmChains] = useState<ExtendedChain[]>([]);
  const [balancesRecord, setBalancesRecord] = useState<Record<number, BalEntry[]> | null>(null);
  const [balancesErr, setBalancesErr] = useState<string | null>(null);
  const [balancesBusy, setBalancesBusy] = useState(true);

  const [fromChainId, setFromChainId] = useState<number | null>(null);
  const [toChainId, setToChainId] = useState<number | null>(null);
  const [fromToken, setFromToken] = useState<BalEntry | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [toSearch, setToSearch] = useState('');

  const [destTokens, setDestTokens] = useState<Token[] | null>(null);
  const [destErr, setDestErr] = useState<string | null>(null);
  const [destBusy, setDestBusy] = useState(false);

  const [sourceTokens, setSourceTokens] = useState<Token[] | null>(null);
  const [sourceTokensBusy, setSourceTokensBusy] = useState(false);
  const [sourceTokensErr, setSourceTokensErr] = useState<string | null>(null);

  const [amountStr, setAmountStr] = useState('');
  /** Alternates the quick-fill button between MAX and Half. */
  const [amountQuickToggle, setAmountQuickToggle] = useState<'max' | 'half'>('max');
  const [quote, setQuote] = useState<LiFiStep | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  /** After a completed swap, show a non-actionable "Success" until the form changes. */
  const [swapSuccessCta, setSwapSuccessCta] = useState(false);
  /** Burner Mode off: first tap reviews, second tap executes. */
  const [reviewing, setReviewing] = useState(false);

  const [execBusy, setExecBusy] = useState(false);
  const [execLog, setExecLog] = useState<string | null>(null);
  const [execTx, setExecTx] = useState<{ chainId: number; hash: `0x${string}` } | null>(null);

  type Sheet = null | 'fromNet' | 'fromToken' | 'toNet' | 'toToken';
  const [sheet, setSheet] = useState<Sheet>(null);
  const [fromNetSearch, setFromNetSearch] = useState('');
  const [toNetSearch, setToNetSearch] = useState('');
  const [fromTokenSearch, setFromTokenSearch] = useState('');
  const [swapHistory, setSwapHistory] = useState<SwapHistoryEntry[]>([]);
  const [walletTab, setWalletTab] = useState<WalletTab>('swap');

  const statusTimer = useRef<number | null>(null);
  const balanceRetryTimersRef = useRef<number[]>([]);
  /** After a pair flip, restore "from" token once `fromChoices` is ready for the new chain. */
  const flipPreferredFromBalRef = useRef<BalEntry | null>(null);
  /** After a pair flip, pick destination token by address once `toChainId` catalog loads. */
  const flipPreferredToTokenRef = useRef<{ chainId: number; address: string } | null>(null);

  /** Re-apply persisted "from" token once `fromChoices` is ready after popup reopen. */
  const persistRestoreFromRef = useRef<{ chainId: number; address: string } | null>(null);
  /** Re-apply persisted "to" token once destination catalog loads. */
  const persistRestoreToRef = useRef<{ chainId: number; address: string } | null>(null);
  /** Last wallet network applied as Swap from/to default. */
  const appliedWalletChainRef = useRef<number | null>(null);

  const balancesRecordRef = useRef<Record<number, BalEntry[]> | null>(null);
  const rpcFreshRef = useRef<Map<number, { at: number; rows: BalEntry[] }>>(new Map());

  const [swapUiHydrated, setSwapUiHydrated] = useState(false);

  const slippageRatio = effectiveSlippageRatio(settings);

  const reloadBalances = useCallback(async () => {
    if (!addr) return;
    setBalancesBusy(true);
    setBalancesErr(null);
    try {
      const fallbackIds = [fromChainId, toChainId].filter(
        (id): id is number => id != null && Number.isFinite(id),
      );
      const { byChain, error } = await loadWalletBalancesMap(addr, {
        rpcFallbackChainIds: fallbackIds,
      });
      const now = Date.now();
      for (const [cid, pack] of [...rpcFreshRef.current.entries()]) {
        if (now - pack.at >= RPC_BALANCE_OVERRIDE_TTL_MS) {
          rpcFreshRef.current.delete(cid);
        }
      }
      const merged: Record<number, BalEntry[]> = { ...byChain };
      for (const [cid, pack] of rpcFreshRef.current.entries()) {
        if (now - pack.at < RPC_BALANCE_OVERRIDE_TTL_MS) {
          merged[cid] = pack.rows;
        }
      }
      setBalancesRecord(Object.keys(merged).length ? merged : null);
      setBalancesErr(error);
    } catch (e) {
      setBalancesRecord(null);
      setBalancesErr(summarizeApiError(e));
    } finally {
      setBalancesBusy(false);
    }
  }, [addr, fromChainId, toChainId]);

  useEffect(() => {
    balancesRecordRef.current = balancesRecord;
  }, [balancesRecord]);

  const commitRpcSnapshotForChains = useCallback(
    async (specs: Array<{ chainId: number; extras: Token[] }>) => {
      if (!addr) return;
      const holder = getAddress(addr);
      const prev = balancesRecordRef.current;
      const updates = new Map<number, BalEntry[]>();
      for (const { chainId, extras } of specs) {
        try {
          const probeMap = new Map<string, OnChainBalanceProbe>();
          for (const b of prev?.[chainId] ?? []) {
            probeMap.set(b.address.toLowerCase(), balEntryToProbe(b));
          }
          for (const t of extras) {
            const k = t.address.toLowerCase();
            if (!probeMap.has(k)) probeMap.set(k, tokenToProbe(t));
          }
          const rowsRpc = await snapshotHeldTokensOnChain(chainId, holder, [...probeMap.values()]);
          updates.set(
            chainId,
            rowsRpc.map(r => ({ ...r }))
          );
        } catch {
          /* RPC or registry gap */
        }
      }
      if (updates.size === 0) return;
      const stamp = Date.now();
      setBalancesRecord(curr => {
        const base = { ...(curr ?? {}) };
        for (const [cid, rows] of updates) {
          rpcFreshRef.current.set(cid, { at: stamp, rows });
          if (rows.length === 0) delete base[cid];
          else base[cid] = rows;
        }
        return base;
      });
    },
    [addr]
  );

  const clearBalanceRetryTimers = useCallback(() => {
    for (const id of balanceRetryTimersRef.current) {
      window.clearTimeout(id);
    }
    balanceRetryTimersRef.current = [];
  }, []);

  /** LiFi wallet balances often lag the chain; also cross-chain output arrives after the source receipt. */
  const scheduleStaggeredBalanceReload = useCallback(() => {
    if (!addr) return;
    clearBalanceRetryTimers();
    for (const ms of [0, 1_500, 5_000, 12_000, 30_000, 60_000]) {
      const id = window.setTimeout(() => {
        void reloadBalances();
      }, ms);
      balanceRetryTimersRef.current.push(id);
    }
  }, [addr, clearBalanceRetryTimers, reloadBalances]);

  useEffect(() => {
    void reloadBalances();
  }, [reloadBalances]);

  useEffect(() => {
    if (sheet === 'fromToken' || sheet === 'toToken') void reloadBalances();
  }, [sheet, reloadBalances]);

  /**
   * Probe the active "from" chain via Multicall3 as soon as we know the chain and
   * have a source-token catalog — covers idle screens that never trigger a swap.
   */
  const snapshotActiveFromChain = useCallback(() => {
    if (fromChainId == null) return;
    const extras = (sourceTokens ?? []).slice(0, 60);
    void commitRpcSnapshotForChains([{ chainId: fromChainId, extras }]);
  }, [commitRpcSnapshotForChains, fromChainId, sourceTokens]);

  useEffect(() => {
    if (fromChainId == null) return;
    if (!sourceTokens || sourceTokens.length === 0) return;
    snapshotActiveFromChain();
  }, [fromChainId, sourceTokens, snapshotActiveFromChain]);

  useEffect(() => {
    void loadSwapHistory()
      .then(rows => setSwapHistory(rows))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        const chains = await loadEvmMainnetChains();
        if (cancel) return;
        setEvmChains(chains);
      } catch (e) {
        if (!cancel) setBalancesErr(x => x ?? summarizeApiError(e));
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const chainChoices = useMemo(() => {
    if (!evmChains.length) return [];
    const baseIds = evmChains.map(c => c.id);
    const merged =
      balancesRecord == null
        ? baseIds
        : [...new Set([...baseIds, ...Object.keys(balancesRecord).map(Number)])];
    return sortEvmChainIds(merged, evmChains, {
      balanceFirst: balancesRecord != null,
      balancesByChain: balancesRecord,
    });
  }, [balancesRecord, evmChains]);

  useEffect(() => {
    if (!addr) return;
    setSwapUiHydrated(false);
    setQuote(null);
    setQuoteErr(null);
    setSwapSuccessCta(false);
    setExecLog(null);
    setExecTx(null);
    persistRestoreFromRef.current = null;
    persistRestoreToRef.current = null;
    flipPreferredFromBalRef.current = null;
    flipPreferredToTokenRef.current = null;
    appliedWalletChainRef.current = null;
    setReviewing(false);
    setFromChainId(null);
    setToChainId(null);
    setFromToken(null);
    setToToken(null);
    setAmountStr('');
  }, [addr]);

  useEffect(() => {
    if (!addr || evmChains.length === 0) return;
    const walletLower = getAddress(addr).toLowerCase();
    let cancelled = false;
    void loadSwapUi(walletLower).then(saved => {
      if (cancelled) return;
      const ids = new Set(evmChains.map(c => c.id));
      const preferred = ids.has(activeChainId) ? activeChainId : (evmChains[0]?.id ?? null);
      if (preferred == null) {
        setSwapUiHydrated(true);
        return;
      }
      setFromChainId(preferred);
      setToChainId(preferred);
      if (saved && saved.fromChainId === preferred) {
        setAmountStr(saved.amountStr);
        persistRestoreFromRef.current = { chainId: preferred, address: saved.fromTokenAddress };
        if (saved.toChainId === preferred) {
          persistRestoreToRef.current = { chainId: preferred, address: saved.toTokenAddress };
        }
      }
      setSwapUiHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [addr, evmChains, activeChainId]);

  useEffect(() => {
    if (!swapUiHydrated) return;
    if (!fromChainId && chainChoices.length) {
      const preferred = chainChoices.includes(activeChainId) ? activeChainId : chainChoices[0]!;
      setFromChainId(preferred);
    }
  }, [swapUiHydrated, chainChoices, fromChainId, activeChainId]);

  useEffect(() => {
    if (!swapUiHydrated) {
      appliedWalletChainRef.current = null;
      return;
    }
    if (!evmChains.some(c => c.id === activeChainId)) return;
    const prev = appliedWalletChainRef.current;
    appliedWalletChainRef.current = activeChainId;
    if (prev === activeChainId) return;
    setFromChainId(activeChainId);
    setToChainId(activeChainId);
    if (prev != null) {
      setAmountStr('');
      setQuote(null);
      setQuoteErr(null);
      setReviewing(false);
      setSwapSuccessCta(false);
      persistRestoreFromRef.current = null;
      persistRestoreToRef.current = null;
    }
  }, [activeChainId, swapUiHydrated, evmChains]);

  useEffect(() => {
    setReviewing(false);
  }, [
    amountStr,
    fromChainId,
    toChainId,
    fromToken?.address,
    toToken?.address,
    quote,
    needsConfirm,
  ]);

  useEffect(() => {
    if (!swapUiHydrated) return;
    if (fromChainId != null && toChainId == null) {
      setToChainId(fromChainId);
    }
  }, [swapUiHydrated, fromChainId, toChainId]);

  useEffect(() => {
    if (!swapUiHydrated || !addr) return;
    if (fromChainId == null || toChainId == null || !fromToken || !toToken) return;
    const walletLower = getAddress(addr).toLowerCase();
    const row = {
      fromChainId,
      toChainId,
      fromTokenAddress: fromToken.address,
      toTokenAddress: toToken.address,
      amountStr,
    };
    const t = window.setTimeout(() => {
      void saveSwapUi(walletLower, row);
    }, 320);
    return () => window.clearTimeout(t);
  }, [
    swapUiHydrated,
    addr,
    fromChainId,
    toChainId,
    fromToken?.address,
    toToken?.address,
    amountStr,
  ]);

  useEffect(() => {
    if (fromChainId == null) return;
    let cancel = false;
    setSourceTokens(null);
    setSourceTokensBusy(true);
    setSourceTokensErr(null);
    void (async () => {
      try {
        const res = await getTokens({
          chains: [fromChainId],
          chainTypes: [ChainType.EVM],
          extended: true,
          orderBy: 'volumeUSD24H',
        });
        if (cancel) return;
        setSourceTokens(res.tokens?.[fromChainId] ?? []);
      } catch (e) {
        if (!cancel) {
          setSourceTokensErr(summarizeApiError(e));
          setSourceTokens([]);
        }
      } finally {
        if (!cancel) setSourceTokensBusy(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [fromChainId]);

  const fromChoices = useMemo(() => {
    if (!fromChainId) return [];
    const bals = balancesRecord?.[fromChainId] ?? [];
    const maps = buildBalanceMaps(bals);

    if (sourceTokens?.length) {
      const uniq = dedupeTokensForChain(sourceTokens, fromChainId);
      const decorated = uniq.map(t => ({
        token: t,
        row: tokenToBalEntry(t, fromChainId, balanceForLiToken(t, maps)),
      }));
      decorated.sort((a, b) => compareFromPickerRows(a.token, a.row, b.token, b.row));
      return decorated.map(d => d.row);
    }
    /* Catalog still loading or failed — at least show Li.FI-reported balances */
    return bals.slice().sort(compareBalEntriesByBalanceThenSymbol);
  }, [balancesRecord, fromChainId, sourceTokens]);

  useEffect(() => {
    const flipStale = flipPreferredFromBalRef.current;
    if (flipStale && flipStale.chainId !== fromChainId) {
      flipPreferredFromBalRef.current = null;
    }
    if (!fromChoices.length) {
      if (
        flipPreferredFromBalRef.current &&
        flipPreferredFromBalRef.current.chainId === fromChainId
      ) {
        return;
      }
      setFromToken(null);
      return;
    }
    const flipBal = flipPreferredFromBalRef.current;
    if (flipBal && flipBal.chainId === fromChainId) {
      flipPreferredFromBalRef.current = null;
      const still = fromChoices.find(t => addressesMatchPayToken(t.address, flipBal.address));
      setFromToken(still ?? flipBal);
      return;
    }
    const restFrom = persistRestoreFromRef.current;
    if (restFrom && restFrom.chainId === fromChainId) {
      const still = fromChoices.find(t => addressesMatchPayToken(t.address, restFrom.address));
      if (still) {
        persistRestoreFromRef.current = null;
        if (
          !fromToken ||
          !addressesMatchPayToken(fromToken.address, still.address) ||
          still.amount !== fromToken.amount ||
          still.logoURI !== fromToken.logoURI ||
          still.priceUSD !== fromToken.priceUSD
        ) {
          setFromToken(still);
        }
        return;
      }
      persistRestoreFromRef.current = null;
    }
    if (!fromToken || fromToken.chainId !== fromChainId) {
      const pref = fromChoices.find(t => safeBigIntAmount(t.amount) > 0n) ?? fromChoices[0]!;
      setFromToken(pref);
      return;
    }
    const still = fromChoices.find(t => addressesMatchPayToken(t.address, fromToken.address));
    if (!still) {
      const pref = fromChoices.find(t => safeBigIntAmount(t.amount) > 0n) ?? fromChoices[0]!;
      setFromToken(pref);
      return;
    }
    if (
      still.amount !== fromToken.amount ||
      still.logoURI !== fromToken.logoURI ||
      still.priceUSD !== fromToken.priceUSD
    ) {
      setFromToken(still);
    }
  }, [fromChainId, fromChoices, fromToken]);

  useEffect(() => {
    if (toChainId == null) return;
    let cancel = false;
    setToToken(null);
    setDestBusy(true);
    setDestErr(null);
    setDestTokens(null);
    void (async () => {
      try {
        const res = await getTokens({
          chains: [toChainId],
          chainTypes: [ChainType.EVM],
          extended: true,
          orderBy: 'volumeUSD24H',
        });
        if (cancel) return;
        const list = res.tokens?.[toChainId] ?? [];
        setDestTokens(list);
        if (!cancel && list.length > 0) {
          const pref = flipPreferredToTokenRef.current;
          let pick: Token | undefined;
          if (pref) {
            if (pref.chainId === toChainId) {
              pick = list.find(t => addressesMatchPayToken(t.address, pref.address));
            }
            flipPreferredToTokenRef.current = null;
          }
          if (!pick) {
            const pr = persistRestoreToRef.current;
            if (pr && pr.chainId === toChainId) {
              pick = list.find(t => addressesMatchPayToken(t.address, pr.address));
            }
            persistRestoreToRef.current = null;
          }
          if (!pick)
            pick = list.find(t => ['USDC', 'ETH', 'DAI', 'USDT'].includes(t.symbol)) ?? list[0];
          setToToken(pick!);
        } else if (!cancel) {
          flipPreferredToTokenRef.current = null;
        }
      } catch (e) {
        if (!cancel) setDestErr(summarizeApiError(e));
      } finally {
        if (!cancel) setDestBusy(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [toChainId]);

  const filteredToTokens = useMemo(() => {
    if (!destTokens?.length) return [];
    const q = toSearch.trim().toLowerCase();
    const pool = q
      ? destTokens.filter(
          t =>
            t.symbol.toLowerCase().includes(q) ||
            t.name.toLowerCase().includes(q) ||
            t.address.toLowerCase().includes(q)
        )
      : destTokens;
    const sorted = pool.slice().sort(compareTokensByPopularity);
    return sorted.slice(0, q ? 180 : 80);
  }, [destTokens, toSearch]);

  const filteredFromTokensSheet = useMemo(() => {
    const q = fromTokenSearch.trim().toLowerCase();
    let list = fromChoices;
    if (q) {
      list = fromChoices.filter(
        t =>
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.address.toLowerCase().includes(q)
      );
    } else {
      list = fromChoices.filter(
        t =>
          safeBigIntAmount(t.amount) > 0n ||
          (fromToken != null && addressesMatchPayToken(t.address, fromToken.address))
      );
    }
    return list.slice(0, q ? 180 : 140);
  }, [fromChoices, fromToken, fromTokenSearch]);

  const filteredFromChainsSheet = useMemo(() => {
    const q = fromNetSearch.trim().toLowerCase();
    return chainChoices
      .map(id => ({
        id,
        name: evmChains.find(c => c.id === id)?.name ?? `Chain ${id}`,
        logo: evmChains.find(c => c.id === id)?.logoURI,
      }))
      .filter(c => !q || c.name.toLowerCase().includes(q) || String(c.id).includes(q));
  }, [chainChoices, fromNetSearch, evmChains]);

  const filteredToChainsSheet = useMemo(() => {
    const q = toNetSearch.trim().toLowerCase();
    const filtered = evmChains.filter(
      c => !q || c.name.toLowerCase().includes(q) || String(c.id).includes(q)
    );
    return sortExtendedChains(filtered);
  }, [evmChains, toNetSearch]);

  const chainName = useCallback(
    (id: number) => evmChains.find(c => c.id === id)?.name ?? `Chain ${id}`,
    [evmChains]
  );

  const chainMeta = useMemo(() => {
    const m = new Map<number, ExtendedChain>();
    for (const c of evmChains) {
      m.set(c.id, c);
    }
    return m;
  }, [evmChains]);

  const clearSwapStatusBanner = useCallback(() => {
    setExecLog(null);
    setExecTx(null);
  }, []);

  const flipExchangePair = useCallback(() => {
    if (fromChainId == null || toChainId == null) return;
    const prevFromChain = fromChainId;
    const prevToChain = toChainId;
    const prevFromBal = fromToken;
    const prevToTok = toToken;

    const newFromChain = prevToChain;
    const newToChain = prevFromChain;
    const sameChain = newFromChain === newToChain;

    setQuote(null);
    setQuoteErr(null);
    setSwapSuccessCta(false);
    clearSwapStatusBanner();
    setAmountStr('');
    setFromChainId(newFromChain);
    setToChainId(newToChain);

    if (!sameChain) {
      if (prevToTok) {
        const maps = buildBalanceMaps(balancesRecord?.[newFromChain] ?? []);
        const bal = balanceForLiToken(prevToTok, maps);
        flipPreferredFromBalRef.current = tokenToBalEntry(prevToTok, newFromChain, bal);
      } else {
        flipPreferredFromBalRef.current = null;
      }

      if (prevFromBal) {
        flipPreferredToTokenRef.current = {
          chainId: newToChain,
          address: prevFromBal.address,
        };
      } else {
        flipPreferredToTokenRef.current = null;
      }
      return;
    }

    /* Same chain: chain state does not change, so chain/token effects do not re-run — swap locally. */
    flipPreferredFromBalRef.current = null;
    flipPreferredToTokenRef.current = null;

    const mapsFrom = buildBalanceMaps(balancesRecord?.[newFromChain] ?? []);

    let nextFrom: BalEntry | null = null;
    if (prevToTok) {
      const bal = balanceForLiToken(prevToTok, mapsFrom);
      nextFrom = tokenToBalEntry(prevToTok, newFromChain, bal);
    }

    let nextTo: Token | null = null;
    if (prevFromBal) {
      const row = { ...prevFromBal, chainId: newToChain };
      const match = destTokens?.find(t => addressesMatchPayToken(t.address, row.address));
      nextTo = match ?? balEntryToToken(row);
    }

    setFromToken(nextFrom);
    setToToken(nextTo);
  }, [
    balancesRecord,
    clearSwapStatusBanner,
    destTokens,
    fromChainId,
    fromToken,
    toChainId,
    toToken,
  ]);

  const fromChainMeta = fromChainId != null ? chainMeta.get(fromChainId) : undefined;
  const toChainMeta = toChainId != null ? chainMeta.get(toChainId) : undefined;

  function setAmountFromPercent(pct: number) {
    if (!fromToken) return;
    setSwapSuccessCta(false);
    if (!execBusy) clearSwapStatusBanner();
    try {
      const bal = BigInt(fromToken.amount);
      if (bal <= 0n) return;
      const part = pct >= 100 ? bal : (bal * BigInt(pct)) / 100n;
      if (part <= 0n) return;
      setAmountStr(formatUnits(part, fromToken.decimals));
    } catch {
      /* ignore */
    }
  }

  const maxAmount = () => {
    setAmountFromPercent(100);
  };

  const applyAmountPercent = (pct: number) => {
    setAmountFromPercent(pct);
    setAmountQuickToggle('max');
  };

  const onMaxHalfToggle = () => {
    if (amountQuickToggle === 'max') {
      maxAmount();
      setAmountQuickToggle('half');
    } else {
      setAmountFromPercent(50);
      setAmountQuickToggle('max');
    }
  };

  const amountUsdPreview = useMemo(() => {
    if (!fromToken?.priceUSD) return null;
    const parsed = parseHumanAmount(amountStr);
    if (!parsed.ok) return null;
    const n = Number(parsed.raw) * Number(fromToken.priceUSD);
    if (!Number.isFinite(n)) return null;
    return fmtNum(n, 2);
  }, [amountStr, fromToken]);

  const fmtBal = (t: BalEntry) => {
    try {
      return fmtNum(Number(formatUnits(BigInt(t.amount), t.decimals)));
    } catch {
      return '—';
    }
  };

  const fmtBalUsd = (t: BalEntry) => {
    try {
      const v = Number(formatUnits(BigInt(t.amount), t.decimals)) * Number(t.priceUSD || 0);
      return Number.isFinite(v) ? fmtNum(v, 2) : '—';
    } catch {
      return '—';
    }
  };

  const fetchQuoteLiFi = useCallback(async (): Promise<LiFiStep> => {
    if (!addr || !fromToken || !toToken || fromChainId == null || toChainId == null) {
      throw new Error('Select chains and tokens first.');
    }
    const parsed = parseHumanAmount(amountStr);
    if (!parsed.ok) {
      throw new Error(parsed.reason);
    }
    let wei: bigint;
    try {
      wei = parseUnits(parsed.raw, fromToken.decimals);
    } catch {
      throw new Error('Decimals or amount out of range.');
    }
    const q = await getQuote({
      fromChain: fromChainId,
      toChain: toChainId,
      fromToken: tokenKeyForQuote(fromToken.address),
      toToken: tokenKeyForQuote(toToken.address),
      fromAmount: wei.toString(),
      fromAddress: getAddress(addr),
      toAddress: getAddress(addr),
      slippage: slippageRatio,
    });
    if (!q.transactionRequest) {
      throw new Error(
        'LiFi returned a quote without ready transaction data. Try another pair or amount.'
      );
    }
    return q;
  }, [addr, amountStr, fromChainId, fromToken, slippageRatio, toChainId, toToken]);

  const requestQuote = async () => {
    setSwapSuccessCta(false);
    clearSwapStatusBanner();
    setQuote(null);
    setQuoteErr(null);
    setQuoteBusy(true);
    try {
      const q = await fetchQuoteLiFi();
      setQuote(q);
      setQuoteErr(null);
    } catch (e) {
      setQuoteErr(summarizeApiError(e));
    } finally {
      setQuoteBusy(false);
    }
  };

  const pollCrossChain = (h: string, from: number, to: number, tool: string, destToken: Token) => {
    if (statusTimer.current) window.clearInterval(statusTimer.current);
    statusTimer.current = window.setInterval(() => {
      void (async () => {
        try {
          const st = await getStatus({
            txHash: h,
            fromChain: String(from),
            toChain: String(to),
            bridge: tool,
          });
          setExecLog(`Cross-chain status: ${st.status}${st.substatus ? ` (${st.substatus})` : ''}`);
          if (st.status === 'DONE' || st.status === 'FAILED') {
            if (statusTimer.current) window.clearInterval(statusTimer.current);
            statusTimer.current = null;
            if (st.status === 'DONE') {
              void commitRpcSnapshotForChains([{ chainId: to, extras: [destToken] }]);
            }
            scheduleStaggeredBalanceReload();
            setAmountStr('');
            setQuote(null);
            setQuoteErr(null);
            const hex = h as `0x${string}`;
            if (st.status === 'DONE') {
              setSwapSuccessCta(true);
              setExecLog(`Done (cross-chain). ${h}`);
              setExecTx({ chainId: from, hash: hex });
            } else {
              setExecLog(`Bridge failed${st.substatus ? ` (${st.substatus})` : ''}. ${h}`);
              setExecTx({ chainId: from, hash: hex });
            }
          }
        } catch (e) {
          setExecLog(`Status check failed: ${summarizeApiError(e)}`);
        }
      })();
    }, 5000);
  };

  useEffect(
    () => () => {
      if (statusTimer.current) window.clearInterval(statusTimer.current);
      clearBalanceRetryTimers();
    },
    [clearBalanceRetryTimers]
  );

  const execute = async () => {
    setReviewing(false);
    setSwapSuccessCta(false);
    setExecLog(null);
    setExecTx(null);
    if (!addr) {
      setExecLog('Unlock your wallet first.');
      return;
    }
    if (!canSend) {
      setExecLog(
        hw
          ? 'Unlock and keep your device ready to sign.'
          : 'Unlock a local or hardware account to swap.',
      );
      return;
    }
    setExecBusy(true);
    try {
      let step = quote;
      if (!step?.transactionRequest) {
        try {
          setExecLog('Fetching a fresh quote…');
          setExecTx(null);
          step = await fetchQuoteLiFi();
          setQuote(step);
        } catch (e) {
          setExecLog(summarizeApiError(e));
          setExecTx(null);
          return;
        }
      }

      if (!step.transactionRequest || !step.estimate) {
        setExecLog('Nothing to execute — quote has no execution payload.');
        setExecTx(null);
        return;
      }
      if (!fromToken) {
        setExecLog('Select a from token first.');
        setExecTx(null);
        return;
      }

      const fromC = step.action.fromChainId;
      const maxBal = BigInt(fromToken.amount || '0');
      const result = await executeLiFiStep(step, {
        fromTokenBalance: maxBal,
        hardware: hw,
        refreshQuote: async () => {
          const next = await fetchQuoteLiFi();
          setQuote(next);
          return next;
        },
        callbacks: {
          onLog: setExecLog,
          onTx: setExecTx,
        },
      });
      const hex = result.txHash;
      step = result.step;

      if (result.crossChain) {
        pollCrossChain(hex, fromC, step.action.toChainId, step.tool, step.action.toToken);
        void commitRpcSnapshotForChains([{ chainId: fromC, extras: [step.action.fromToken] }]);
      } else {
        setAmountStr('');
        setQuote(null);
        setQuoteErr(null);
        setSwapSuccessCta(true);
        setExecLog(`Done (same-chain). ${hex}`);
        setExecTx({ chainId: fromC, hash: hex });
        void commitRpcSnapshotForChains([
          { chainId: fromC, extras: [step.action.fromToken, step.action.toToken] },
        ]);
      }
      scheduleStaggeredBalanceReload();
      void (async () => {
        try {
          const wallet = getAddress(addr);
          await markTokensTouched(fromC, wallet, [step.action.fromToken.address]);
          await markTokensTouched(step.action.toChainId, wallet, [step.action.toToken.address]);
          const next = await appendSwapToHistory({
            wallet: getAddress(addr),
            txHash: hex,
            txChainId: fromC,
            fromChainId: step.action.fromChainId,
            toChainId: step.action.toChainId,
            fromSymbol: step.action.fromToken.symbol,
            toSymbol: step.action.toToken.symbol,
            crossChain: result.crossChain,
          });
          setSwapHistory(next);
        } catch {
          /* ignore */
        }
      })();
    } catch (e) {
      const msg = summarizeApiError(e);
      setExecLog(msg);
      setExecTx(null);
      reportDevError({
        source: 'swap',
        title: 'Swap failed',
        err: e,
        context: {
          fromChainId: quote?.action.fromChainId,
          toChainId: quote?.action.toChainId,
          fromSymbol: quote?.action.fromToken.symbol,
          toSymbol: quote?.action.toToken.symbol,
        },
      });
    } finally {
      setExecBusy(false);
    }
  };

  const closeSheet = useCallback(() => {
    setSheet(null);
    setFromNetSearch('');
    setToNetSearch('');
    setFromTokenSearch('');
  }, []);

  useEffect(() => {
    closeSheet();
  }, [walletTab, closeSheet]);

  if (!addr) {
    return <p className="panel error">No account</p>;
  }

  const outPreview =
    quote?.estimate?.toAmount && quote.action.toToken
      ? formatUnits(BigInt(quote.estimate.toAmount), quote.action.toToken.decimals)
      : null;
  const settingsBtn = (
    <button
      type="button"
      className="w1337-icon-head"
      onClick={onOpenSettings}
      aria-label="Settings"
    >
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  );

  const sheetSearch = (placeholder: string, value: string, set: (s: string) => void) => (
    <div className="w1337-search-field">
      <svg
        className="w1337-search-field__icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="search"
        className="w1337-search-field__input"
        placeholder={placeholder}
        value={value}
        onChange={e => set(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );

  const walletTitle = walletTab === 'swap' ? 'Exchange' : walletTab === 'defi' ? 'DeFi' : 'History';

  useEffect(() => {
    if (embedded) setWalletTab('swap');
  }, [embedded]);

  const body = (
    <div className={embedded ? 'w1337-body w1337-body--compact' : 'screen-body w1337-body w1337-body--compact'}>
        {(embedded || walletTab === 'swap') ? (
          <>
            <p className="w1337-li-fi-hint">Powered by Li.Fi</p>

            <div className="w1337-card w1337-exchange-card">
              <div className="w1337-pair-row">
                <button
                  type="button"
                  className="w1337-pair-cell"
                  onClick={() => {
                    setFromTokenSearch('');
                    setSheet('fromToken');
                  }}
                  disabled={balancesBusy}
                >
                  <TokenWithBadge
                    tokenLogoURI={fromToken?.logoURI}
                    chainLogoURI={fromChainMeta?.logoURI}
                    size={40}
                    symbol={fromToken?.symbol ?? '—'}
                    subline={fromChainId != null ? chainName(fromChainId) : ' '}
                    empty={!fromToken}
                  />
                </button>

                <button
                  type="button"
                  className="w1337-pair-flip"
                  aria-label="Swap from and to tokens"
                  onClick={() => flipExchangePair()}
                  disabled={balancesBusy || fromChainId == null || toChainId == null}
                >
                  <span className="w1337-pair-mid-circle">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M4 9h11.5M15.5 9 19 5.5M15.5 9 19 12.5" />
                      <path d="M20 15H8.5M8.5 15 5 18.5M8.5 15 5 11.5" />
                    </svg>
                  </span>
                </button>

                <button
                  type="button"
                  className="w1337-pair-cell"
                  onClick={() => {
                    setToSearch('');
                    setSheet('toToken');
                  }}
                  disabled={destBusy}
                >
                  <TokenWithBadge
                    tokenLogoURI={toToken?.logoURI}
                    chainLogoURI={toChainMeta?.logoURI}
                    size={40}
                    symbol={toToken?.symbol ?? '—'}
                    subline={toChainId != null ? chainName(toChainId) : ' '}
                    empty={!toToken}
                  />
                </button>
              </div>

              <div className="w1337-send-block">
                <span className="w1337-label">From</span>
                <input
                  className="w1337-amount-massive"
                  value={amountStr}
                  disabled={execBusy}
                  onChange={e => {
                    setSwapSuccessCta(false);
                    setAmountQuickToggle('max');
                    if (!execBusy) clearSwapStatusBanner();
                    setAmountStr(e.target.value);
                  }}
                  placeholder="0"
                  inputMode="decimal"
                />
                <div className="w1337-amount-meta">
                  <span className="w1337-amount-usd">
                    {amountUsdPreview != null ? `~$${amountUsdPreview}` : '—'}
                  </span>
                </div>
                <div className="w1337-pct-row">
                  {([25, 50, 75] as const).map(pct => (
                    <button
                      key={pct}
                      type="button"
                      className="w1337-pct"
                      disabled={!fromToken || balancesBusy || execBusy}
                      onClick={() => applyAmountPercent(pct)}
                    >
                      {pct}%
                    </button>
                  ))}
                  <button
                    type="button"
                    className="w1337-pct w1337-pct--max"
                    disabled={!fromToken || balancesBusy || execBusy}
                    onClick={onMaxHalfToggle}
                  >
                    {amountQuickToggle === 'max' ? 'MAX' : 'Half'}
                  </button>
                </div>
              </div>

              <div className="w1337-actions">
                {swapSuccessCta && !quote && !quoteBusy ? (
                  <button
                    type="button"
                    className="primary w1337-success-cta"
                    tabIndex={-1}
                    aria-disabled="true"
                    aria-live="polite"
                    onClick={e => e.preventDefault()}
                  >
                    Success
                  </button>
                ) : (
                  <button
                    type="button"
                    className={quote ? 'ghost' : 'primary'}
                    disabled={quoteBusy || balancesBusy}
                    onClick={() => void requestQuote()}
                  >
                    {quoteBusy ? 'Getting quote…' : 'Get quote'}
                  </button>
                )}
              </div>

              {balancesErr && <p className="error">Balances: {balancesErr}</p>}
              {quoteErr && <p className="error">{quoteErr}</p>}
              {quote && (
                <div className="w1337-quote w1337-quote--compact">
                  <div className="w1337-quote-assets">
                    <div className="w1337-quote-chip">
                      <LiFiIcon
                        logoURI={quote.action.fromToken.logoURI}
                        label={quote.action.fromToken.symbol}
                        size={28}
                        rounded
                      />
                      <span>
                        <strong>{quote.action.fromToken.symbol}</strong>
                      </span>
                    </div>
                    <span className="w1337-quote-arrow" aria-hidden>
                      →
                    </span>
                    <div className="w1337-quote-chip">
                      <LiFiIcon
                        logoURI={quote.action.toToken.logoURI}
                        label={quote.action.toToken.symbol}
                        size={28}
                        rounded
                      />
                      <span>
                        <strong>{quote.action.toToken.symbol}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="muted w1337-quote-route">
                    Via <strong>{quote.tool}</strong>
                    {quote.toolDetails?.name ? ` · ${quote.toolDetails.name}` : ''}
                  </div>
                  {outPreview && quote.action.toToken && (
                    <p className="w1337-est">
                      Est.{' '}
                      <strong>
                        {fmtNum(Number(outPreview))} {quote.action.toToken.symbol}
                      </strong>
                    </p>
                  )}
                  {reviewing && !execBusy ? (
                    <div className="w1337-ms-confirm">
                      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                        Burner Mode is off. Review this swap, then confirm to sign.
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="ghost"
                          style={{ flex: 1 }}
                          onClick={() => setReviewing(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="primary"
                          style={{ flex: 1 }}
                          disabled={!canSend || !quote.transactionRequest || !!quoteErr}
                          onClick={() => void execute()}
                        >
                          Swap
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="primary w1337-swap-btn"
                      disabled={execBusy || !canSend || !quote.transactionRequest || !!quoteErr}
                      onClick={() => {
                        if (needsConfirm && !reviewing) {
                          setReviewing(true);
                          return;
                        }
                        void execute();
                      }}
                    >
                      {execBusy
                        ? hw
                          ? 'Confirm on device…'
                          : 'Working…'
                        : needsConfirm
                          ? 'Review swap'
                          : 'Swap'}
                    </button>
                  )}
                </div>
              )}
              {execLog && (
                <div className="muted">
                  <SwapExecLog log={execLog} tx={execTx} chainById={chainMeta} />
                </div>
              )}
            </div>

            <div className="w1337-footer w1337-footer--tight w1337-footer--icon">
              <RefreshIconButton
                busy={balancesBusy}
                ariaLabel="Refresh balances"
                onClick={() => {
                  snapshotActiveFromChain();
                  void reloadBalances();
                }}
              />
            </div>
          </>
        ) : walletTab === 'defi' ? (
          <DefiYieldPanel />
        ) : (
          <div className="w1337-history-tab">
            {swapHistory.length === 0 ? (
              <p className="w1337-history-tab__empty muted">No activity recorded yet.</p>
            ) : (
              <ul className="w1337-history-tab__list w1337-swap-history__list">
                {swapHistory.map(e => {
                  const url = transactionExplorerUrl(
                    e.txChainId,
                    e.txHash,
                    chainMeta.get(e.txChainId)
                  );
                  const sub =
                    (e.crossChain ? 'Bridge' : 'Swap') +
                    ' · ' +
                    formatSwapHistoryRelTime(e.at) +
                    (url ? ' · View tx' : '');
                  const inner = (
                    <>
                      <span className="w1337-swap-history__pair">
                        {e.fromSymbol} → {e.toSymbol}
                      </span>
                      <span className="w1337-swap-history__sub muted">{sub}</span>
                    </>
                  );
                  return (
                    <li key={e.id}>
                      {url ? (
                        <a
                          className="w1337-swap-history__row"
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {inner}
                        </a>
                      ) : (
                        <span className="w1337-swap-history__row w1337-swap-history__row--dead">
                          {inner}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {!embedded ? (
          <p className="muted mono w1337-address" title={addr}>
            {addr}
          </p>
        ) : null}
      </div>
  );

  const sheets = walletTab === 'swap' && sheet ? (
        <div className="w1337-sheet-mount">
          <button
            type="button"
            className="w1337-sheet-backdrop"
            aria-label="Dismiss"
            onClick={closeSheet}
          />
          <div
            className="w1337-sheet-panel"
            role="dialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
          >
            {sheet === 'fromNet' && (
              <>
                <div className="w1337-sheet-head">
                  <button
                    type="button"
                    className="w1337-sheet-back"
                    onClick={() => setSheet('fromToken')}
                    aria-label="Back"
                  >
                    ‹
                  </button>
                  <h2 className="w1337-sheet-h2">From network</h2>
                </div>
                {sheetSearch('Search network', fromNetSearch, setFromNetSearch)}
                <ul className="w1337-sheet-list">
                  {filteredFromChainsSheet.map(c => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={
                          'w1337-sheet-row' + (c.id === fromChainId ? ' w1337-sheet-row--on' : '')
                        }
                        onClick={() => {
                          setSwapSuccessCta(false);
                          clearSwapStatusBanner();
                          setQuote(null);
                          setQuoteErr(null);
                          setFromChainId(c.id);
                          setToChainId(c.id);
                          setSheet('fromToken');
                        }}
                      >
                        <LiFiIcon logoURI={c.logo} label={c.name} size={34} rounded />
                        <span className="w1337-sheet-row-text">{c.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {sheet === 'fromToken' && (
              <>
                <div className="w1337-sheet-head">
                  <button
                    type="button"
                    className="w1337-sheet-back"
                    onClick={closeSheet}
                    aria-label="Back"
                  >
                    ‹
                  </button>
                  <h2 className="w1337-sheet-h2">Exchange from</h2>
                </div>
                <button
                  type="button"
                  className="w1337-sheet-net-pill w1337-sheet-net-pill--brand"
                  onClick={() => setSheet('fromNet')}
                  disabled={!chainChoices.length}
                >
                  <LiFiIcon
                    logoURI={fromChainMeta?.logoURI}
                    label={fromChainId != null ? chainName(fromChainId) : ' '}
                    size={28}
                    rounded
                  />
                  <span className="w1337-sheet-net-pill-stack">
                    <span className="w1337-sheet-net-pill-muted">Network</span>
                    <span className="w1337-sheet-net-pill-name">
                      {fromChainId != null ? chainName(fromChainId) : '…'}
                    </span>
                  </span>
                  <span className="w1337-sheet-net-pill-chev" aria-hidden>
                    ›
                  </span>
                </button>
                {sheetSearch('Search by token or address', fromTokenSearch, setFromTokenSearch)}
                <ul className="w1337-sheet-list">
                  {sourceTokensBusy ? (
                    <li className="w1337-sheet-empty">Loading tokens…</li>
                  ) : sourceTokensErr && !fromChoices.length ? (
                    <li className="w1337-sheet-empty">{sourceTokensErr}</li>
                  ) : !filteredFromTokensSheet.length ? (
                    <li className="w1337-sheet-empty">
                      {fromTokenSearch.trim()
                        ? 'No tokens match search.'
                        : 'No token list for this network yet. Pull to refresh balances or try search.'}
                    </li>
                  ) : (
                    filteredFromTokensSheet.map(t => (
                      <li key={t.address + t.symbol + String(t.chainId)}>
                        <button
                          type="button"
                          className={
                            'w1337-sheet-row w1337-sheet-row--token' +
                            (fromToken && addressesMatchPayToken(fromToken.address, t.address)
                              ? ' w1337-sheet-row--on'
                              : '')
                          }
                          onClick={() => {
                            setSwapSuccessCta(false);
                            clearSwapStatusBanner();
                            const tokChanged =
                              !fromToken || !addressesMatchPayToken(fromToken.address, t.address);
                            if (tokChanged) {
                              setQuote(null);
                              setQuoteErr(null);
                            }
                            setFromToken(t);
                            closeSheet();
                          }}
                        >
                          <TokenWithBadge
                            tokenLogoURI={t.logoURI}
                            chainLogoURI={fromChainMeta?.logoURI}
                            size={36}
                            symbol={t.symbol}
                            subline={t.name.length > 42 ? `${t.name.slice(0, 40)}…` : t.name}
                          />
                          <div className="w1337-sheet-row-bal">
                            <span className="w1337-sheet-row-amt">{fmtBal(t)}</span>
                            <span className="w1337-sheet-row-usd">${fmtBalUsd(t)}</span>
                          </div>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </>
            )}

            {sheet === 'toNet' && (
              <>
                <div className="w1337-sheet-head">
                  <button
                    type="button"
                    className="w1337-sheet-back"
                    onClick={() => setSheet('toToken')}
                    aria-label="Back"
                  >
                    ‹
                  </button>
                  <h2 className="w1337-sheet-h2">To network</h2>
                </div>
                {sheetSearch('Search network', toNetSearch, setToNetSearch)}
                <ul className="w1337-sheet-list">
                  {filteredToChainsSheet.map(c => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={
                          'w1337-sheet-row' + (c.id === toChainId ? ' w1337-sheet-row--on' : '')
                        }
                        onClick={() => {
                          setSwapSuccessCta(false);
                          clearSwapStatusBanner();
                          if (c.id !== toChainId) {
                            setQuote(null);
                            setQuoteErr(null);
                          }
                          setToChainId(c.id);
                          setSheet('toToken');
                        }}
                      >
                        <LiFiIcon logoURI={c.logoURI} label={c.name} size={34} rounded />
                        <span className="w1337-sheet-row-text">{c.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {sheet === 'toToken' && (
              <>
                <div className="w1337-sheet-head">
                  <button
                    type="button"
                    className="w1337-sheet-back"
                    onClick={closeSheet}
                    aria-label="Back"
                  >
                    ‹
                  </button>
                  <h2 className="w1337-sheet-h2">You receive</h2>
                </div>
                <button
                  type="button"
                  className="w1337-sheet-net-pill w1337-sheet-net-pill--brand"
                  onClick={() => setSheet('toNet')}
                  disabled={!evmChains.length}
                >
                  <LiFiIcon
                    logoURI={toChainMeta?.logoURI}
                    label={toChainId != null ? chainName(toChainId) : ' '}
                    size={28}
                    rounded
                  />
                  <span className="w1337-sheet-net-pill-stack">
                    <span className="w1337-sheet-net-pill-muted">Network</span>
                    <span className="w1337-sheet-net-pill-name">
                      {toChainId != null ? chainName(toChainId) : '…'}
                    </span>
                  </span>
                  <span className="w1337-sheet-net-pill-chev" aria-hidden>
                    ›
                  </span>
                </button>
                {sheetSearch('Search token or address', toSearch, setToSearch)}
                <ul className="w1337-sheet-list">
                  {!destTokens?.length && destBusy ? (
                    <li className="w1337-sheet-empty">Loading tokens…</li>
                  ) : destErr ? (
                    <li className="w1337-sheet-empty">{destErr}</li>
                  ) : !filteredToTokens.length ? (
                    <li className="w1337-sheet-empty">No match</li>
                  ) : (
                    filteredToTokens.map(t => (
                      <li key={t.address + t.symbol}>
                        <button
                          type="button"
                          className={
                            'w1337-sheet-row w1337-sheet-row--token' +
                            (toToken && addressesMatchPayToken(toToken.address, t.address)
                              ? ' w1337-sheet-row--on'
                              : '')
                          }
                          onClick={() => {
                            setSwapSuccessCta(false);
                            clearSwapStatusBanner();
                            const tokChanged =
                              !toToken || !addressesMatchPayToken(toToken.address, t.address);
                            if (tokChanged) {
                              setQuote(null);
                              setQuoteErr(null);
                            }
                            setToToken(t);
                            closeSheet();
                          }}
                        >
                          <TokenWithBadge
                            tokenLogoURI={t.logoURI}
                            chainLogoURI={toChainMeta?.logoURI}
                            size={36}
                            symbol={t.symbol}
                            subline={t.name.length > 42 ? `${t.name.slice(0, 40)}…` : t.name}
                          />
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </>
            )}
          </div>
        </div>
      ) : null;

  if (embedded) {
    return (
      <div className="w1337 w1337--swap w1337--embedded">
        {body}
        {sheets}
      </div>
    );
  }

  return (
    <div
      className={`wallet-shell w1337 w1337--swap${walletTab === 'swap' ? '' : ' w1337--wallet-subtab'}`}
    >
      <ScreenHeader title={walletTitle} trailing={settingsBtn} />

      <nav className="w1337-wallet-tabs" aria-label="Wallet sections">
        {(['swap', 'defi', 'history'] as const).map(t => (
          <button
            key={t}
            type="button"
            className={`w1337-wallet-tabs__btn${walletTab === t ? ' w1337-wallet-tabs__btn--on' : ''}`}
            aria-current={walletTab === t ? 'page' : undefined}
            onClick={() => setWalletTab(t)}
          >
            {t === 'swap' ? 'SWAP' : t === 'defi' ? 'DEFI' : 'HISTORY'}
          </button>
        ))}
      </nav>

      {body}
      {sheets}
    </div>
  );
}
