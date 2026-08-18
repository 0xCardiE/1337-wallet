import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatUnits, getAddress } from 'viem';
import type { ExtendedChain, LiFiStep, Token } from '@lifi/types';
import { getUnlockedAccount, getActiveAccountMeta, getSessionPrivateKey } from '../lib/accountSession';
import { isHardwareAccount } from '../lib/accounts';
import { summarizeApiError } from '../lib/errors';
import { reportDevError } from '../lib/devErrorLog';
import {
  chainLabel,
  fetchGasTopUpQuote,
  formatToolRoute,
  resolveNativeToken,
} from '../lib/gasTopUp';
import { loadEvmMainnetChains } from '../lib/lifiBootstrap';
import { executeLiFiStep, pollLiFiCrossChainStatus } from '../lib/lifiExecute';
import { fmtNum, isNativeToken, parseHumanAmount } from '../lib/lifiHelpers';
import { getNativeBalance } from '../lib/ethereum';
import { loadWalletBalancesMap } from '../lib/walletBalances';
import { sortEvmChainIds } from '../lib/chainPopularity';
import {
  effectiveActiveChainId,
  effectiveSlippageRatio,
  type AppSettings,
} from '../lib/storageState';
import { appendSwapToHistory } from '../lib/swapHistory';
import { transactionExplorerUrl } from '../lib/explorerUrls';
import { Select1337, type Select1337Group } from './Select1337';
import { HardwareSignHint } from './HardwareSignHint';

type BalEntry = {
  address: string;
  symbol: string;
  decimals: number;
  amount: string;
  chainId: number;
  name: string;
  logoURI?: string;
};

export function GasStationView({ settings }: { settings: AppSettings }) {
  const account = getUnlockedAccount();
  const addr = account?.address;
  const meta = getActiveAccountMeta();
  const hw = Boolean(meta && isHardwareAccount(meta));
  const canSend = Boolean(getSessionPrivateKey() || hw);
  const slippageRatio = effectiveSlippageRatio(settings);
  const defaultChainId = effectiveActiveChainId(settings);

  const [evmChains, setEvmChains] = useState<ExtendedChain[]>([]);
  const [chainsBusy, setChainsBusy] = useState(true);
  const [balancesRecord, setBalancesRecord] = useState<Record<number, BalEntry[]> | null>(null);
  const [balancesBusy, setBalancesBusy] = useState(false);

  const [destChainId, setDestChainId] = useState<number | null>(null);
  const [sourceChainId, setSourceChainId] = useState<number | null>(null);
  const [destNative, setDestNative] = useState<Token | null>(null);
  const [sourceToken, setSourceToken] = useState<BalEntry | null>(null);
  const [destNativeBal, setDestNativeBal] = useState<string | null>(null);
  const [gasAmountStr, setGasAmountStr] = useState('');

  const [quote, setQuote] = useState<LiFiStep | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);

  const [execBusy, setExecBusy] = useState(false);
  const [execLog, setExecLog] = useState<string | null>(null);
  const [execTx, setExecTx] = useState<{ chainId: number; hash: `0x${string}` } | null>(null);

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const pollStopRef = useRef<(() => void) | null>(null);

  const chainById = useMemo(() => {
    const m = new Map<number, ExtendedChain>();
    for (const c of evmChains) m.set(c.id, c);
    return m;
  }, [evmChains]);

  const reloadBalances = useCallback(async () => {
    if (!addr) return;
    setBalancesBusy(true);
    try {
      const fallbackIds = [sourceChainId, destChainId].filter(
        (id): id is number => id != null && Number.isFinite(id),
      );
      const { byChain } = await loadWalletBalancesMap(addr, {
        rpcFallbackChainIds: fallbackIds.length ? fallbackIds : [defaultChainId],
      });
      setBalancesRecord(Object.keys(byChain).length ? byChain : null);
    } catch {
      setBalancesRecord(null);
    } finally {
      setBalancesBusy(false);
    }
  }, [addr, defaultChainId, destChainId, sourceChainId]);

  useEffect(() => {
    let cancel = false;
    void loadEvmMainnetChains()
      .then(chains => {
        if (!cancel) setEvmChains(chains);
      })
      .finally(() => {
        if (!cancel) setChainsBusy(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    void reloadBalances();
  }, [reloadBalances]);

  useEffect(() => {
    if (destChainId == null && evmChains.length) {
      const pick = evmChains.some(c => c.id === defaultChainId) ? defaultChainId : evmChains[0]!.id;
      setDestChainId(pick);
    }
  }, [defaultChainId, destChainId, evmChains]);

  useEffect(() => {
    if (sourceChainId == null && destChainId != null) {
      setSourceChainId(destChainId);
    }
  }, [destChainId, sourceChainId]);

  useEffect(() => {
    if (destChainId == null) return;
    let cancel = false;
    setDestNative(null);
    void resolveNativeToken(destChainId).then(t => {
      if (!cancel) setDestNative(t);
    });
    return () => {
      cancel = true;
    };
  }, [destChainId]);

  useEffect(() => {
    if (!addr || destChainId == null) {
      setDestNativeBal(null);
      return;
    }
    let cancel = false;
    void getNativeBalance(getAddress(addr), destChainId)
      .then(bal => {
        if (cancel) return;
        const dec = destNative?.decimals ?? chainById.get(destChainId)?.nativeToken?.decimals ?? 18;
        setDestNativeBal(formatUnits(bal, dec));
      })
      .catch(() => {
        if (!cancel) setDestNativeBal(null);
      });
    return () => {
      cancel = true;
    };
  }, [addr, destChainId, destNative, chainById]);

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

  const sourceTokenChoices = useMemo(() => {
    if (sourceChainId == null || !balancesRecord) return [];
    const rows = balancesRecord[sourceChainId] ?? [];
    return rows
      .filter(t => !isNativeToken(t.address) || sourceChainId !== destChainId)
      .sort((a, b) => {
        const stable = (s: string) => /^(USDC|USDT|DAI|USDC\.E|USDbC)$/i.test(s);
        const sa = stable(a.symbol) ? 0 : 1;
        const sb = stable(b.symbol) ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return a.symbol.localeCompare(b.symbol);
      });
  }, [balancesRecord, destChainId, sourceChainId]);

  useEffect(() => {
    if (!sourceToken && sourceTokenChoices.length) {
      setSourceToken(sourceTokenChoices[0]!);
    }
  }, [sourceToken, sourceTokenChoices]);

  useEffect(() => {
    setQuote(null);
    setQuoteErr(null);
    setExecLog(null);
    setExecTx(null);
  }, [destChainId, sourceChainId, sourceToken?.address, gasAmountStr]);

  useEffect(
    () => () => {
      pollStopRef.current?.();
    },
    []
  );

  const chainGroups = useMemo((): Select1337Group[] => {
    const opts = chainChoices.map(id => {
      const c = chainById.get(id);
      return {
        value: String(id),
        label: c?.name ?? `Chain ${id}`,
        sublabel: balancesRecord?.[id]?.length
          ? `${balancesRecord[id]!.length} token${balancesRecord[id]!.length === 1 ? '' : 's'}`
          : undefined,
        logoURI: c?.logoURI,
      };
    });
    return [{ label: 'Networks', options: opts }];
  }, [balancesRecord, chainById, chainChoices]);

  const tokenGroups = useMemo((): Select1337Group[] => {
    const opts = sourceTokenChoices.map(t => ({
      value: t.address,
      label: t.symbol,
      sublabel: `${fmtNum(Number(formatUnits(BigInt(t.amount || '0'), t.decimals)))} available`,
      logoURI: t.logoURI,
    }));
    return [{ label: 'Pay with', options: opts }];
  }, [sourceTokenChoices]);

  const fetchQuote = useCallback(async (): Promise<LiFiStep> => {
    if (!addr || destChainId == null || sourceChainId == null || !sourceToken || !destNative) {
      throw new Error('Select chains, token, and gas amount.');
    }
    const parsed = parseHumanAmount(gasAmountStr);
    if (!parsed.ok) throw new Error(parsed.reason);
    return fetchGasTopUpQuote({
      wallet: addr,
      fromChainId: sourceChainId,
      toChainId: destChainId,
      fromToken: {
        address: sourceToken.address,
        chainId: sourceChainId,
        decimals: sourceToken.decimals,
        symbol: sourceToken.symbol,
        name: sourceToken.name,
        logoURI: sourceToken.logoURI,
      } as Token,
      toNativeToken: destNative,
      gasAmountHuman: parsed.raw,
      slippage: slippageRatio,
    });
  }, [addr, destChainId, destNative, gasAmountStr, slippageRatio, sourceChainId, sourceToken]);

  const requestQuote = async () => {
    setQuote(null);
    setQuoteErr(null);
    setQuoteBusy(true);
    try {
      setQuote(await fetchQuote());
    } catch (e) {
      setQuoteErr(summarizeApiError(e));
    } finally {
      setQuoteBusy(false);
    }
  };

  const executeTopUp = async () => {
    if (!addr || !sourceToken) {
      setExecLog('Unlock your wallet first.');
      return;
    }
    if (!canSend) {
      setExecLog(
        hw
          ? 'Unlock and keep your device ready to sign.'
          : 'Unlock a local or hardware account to top up gas.',
      );
      return;
    }
    setExecBusy(true);
    setExecLog(null);
    setExecTx(null);
    pollStopRef.current?.();
    pollStopRef.current = null;

    try {
      let step = quote;
      if (!step?.transactionRequest) {
        setExecLog('Fetching a fresh quote…');
        step = await fetchQuote();
        setQuote(step);
      }

      const fromBal = BigInt(sourceToken.amount || '0');
      const result = await executeLiFiStep(step, {
        fromTokenBalance: fromBal,
        hardware: hw,
        refreshQuote: fetchQuote,
        callbacks: {
          onLog: setExecLog,
          onTx: setExecTx,
        },
      });

      if (result.crossChain) {
        setExecLog(
          `Source tx confirmed. Waiting for gas on ${chainLabel(chainById.get(destChainId!), destChainId!)}…`
        );
        pollStopRef.current = pollLiFiCrossChainStatus({
          txHash: result.txHash,
          fromChain: result.fromChainId,
          toChain: step.action.toChainId,
          tool: step.tool,
          destToken: step.action.toToken,
          onLog: setExecLog,
          onDone: status => {
            pollStopRef.current?.();
            pollStopRef.current = null;
            if (status === 'DONE') {
              setExecLog(
                `Gas delivered on ${chainLabel(chainById.get(destChainId!), destChainId!)}. ${result.txHash}`
              );
              void reloadBalances();
              if (addr) {
                void getNativeBalance(getAddress(addr), destChainId!).then(bal => {
                  const dec = destNative?.decimals ?? 18;
                  setDestNativeBal(formatUnits(bal, dec));
                });
              }
            } else {
              setExecLog(`Bridge failed. Source tx: ${result.txHash}`);
            }
          },
        });
      } else {
        setExecLog(
          `Gas topped up on ${chainLabel(chainById.get(destChainId!), destChainId!)}. ${result.txHash}`
        );
        void reloadBalances();
        if (addr && destChainId != null) {
          void getNativeBalance(getAddress(addr), destChainId).then(bal => {
            const dec = destNative?.decimals ?? 18;
            setDestNativeBal(formatUnits(bal, dec));
          });
        }
      }

      void appendSwapToHistory({
        wallet: getAddress(addr),
        txHash: result.txHash,
        txChainId: result.fromChainId,
        fromChainId: step.action.fromChainId,
        toChainId: step.action.toChainId,
        fromSymbol: step.action.fromToken.symbol,
        toSymbol: step.action.toToken.symbol,
        crossChain: result.crossChain,
      });
    } catch (e) {
      const msg = summarizeApiError(e);
      setExecLog(msg);
      reportDevError({
        source: 'gas-station',
        title: 'Gas top-up failed',
        err: e,
        context: {
          destChainId,
          sourceChainId,
          sourceToken: sourceToken?.symbol,
          gasAmount: gasAmountStr,
        },
      });
    } finally {
      setExecBusy(false);
    }
  };

  if (!addr) {
    return <p className="w1337-tools-empty muted">Unlock wallet to use Gas Station.</p>;
  }

  const destChain = destChainId != null ? chainById.get(destChainId) : undefined;
  const sourceChain = sourceChainId != null ? chainById.get(sourceChainId) : undefined;
  const nativeSym =
    destNative?.symbol ??
    destChain?.nativeToken?.symbol ??
    destChain?.nativeCurrency?.symbol ??
    'native';

  const quotePay =
    quote && sourceToken
      ? fmtNum(Number(formatUnits(BigInt(quote.action.fromAmount), sourceToken.decimals)))
      : null;
  const quoteReceive =
    quote && destNative
      ? fmtNum(
          Number(
            formatUnits(
              BigInt(quote.estimate.toAmountMin ?? quote.action.toAmount),
              destNative.decimals
            )
          )
        )
      : null;

  const execUrl =
    execTx && chainById.get(execTx.chainId)
      ? transactionExplorerUrl(execTx.chainId, execTx.hash, chainById.get(execTx.chainId))
      : undefined;

  return (
    <div className="w1337-send-panel w1337-gas-station">
      <Select1337
        id="gas-dest-chain"
        label="Need gas on"
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
        value={destChainId != null ? String(destChainId) : ''}
        triggerLabel={destChain?.name ?? 'Select network'}
        triggerLogoURI={destChain?.logoURI}
        triggerSublabel={
          destNativeBal != null ? `${fmtNum(Number(destNativeBal))} ${nativeSym} now` : undefined
        }
        groups={chainGroups}
        disabled={chainsBusy}
        onPick={v => {
          setDestChainId(Number(v));
          setSourceToken(null);
        }}
      />

      <label htmlFor="gas-amt" style={{ marginTop: 14 }}>
        Native amount to receive ({nativeSym})
      </label>
      <input
        id="gas-amt"
        value={gasAmountStr}
        onChange={e => setGasAmountStr(e.target.value)}
        placeholder={`Amount in ${nativeSym}`}
        inputMode="decimal"
      />
      <p className="muted" style={{ fontSize: 11, margin: '4px 0 0' }}>
        Destination chain native token — e.g. ETH on Ethereum, POL on Polygon, not a generic gas estimate.
      </p>

      <Select1337
        id="gas-source-chain"
        label="Pay from chain"
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
        value={sourceChainId != null ? String(sourceChainId) : ''}
        triggerLabel={sourceChain?.name ?? 'Select network'}
        triggerLogoURI={sourceChain?.logoURI}
        groups={chainGroups}
        disabled={chainsBusy}
        onPick={v => {
          setSourceChainId(Number(v));
          setSourceToken(null);
        }}
      />

      <Select1337
        id="gas-source-token"
        label="Pay with token"
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
        value={sourceToken?.address ?? ''}
        triggerLabel={sourceToken?.symbol ?? 'Select token'}
        triggerLogoURI={sourceToken?.logoURI}
        triggerSublabel={
          sourceToken
            ? `${fmtNum(Number(formatUnits(BigInt(sourceToken.amount || '0'), sourceToken.decimals)))} available`
            : balancesBusy
              ? 'Loading balances…'
              : 'No tokens on this chain'
        }
        groups={tokenGroups}
        disabled={!sourceTokenChoices.length}
        onPick={v => {
          const t = sourceTokenChoices.find(x => x.address === v);
          if (t) setSourceToken(t);
        }}
      />

      {quoteErr ? <p className="error">{quoteErr}</p> : null}

      {quote ? (
        <div className="w1337-gas-quote">
          <div className="w1337-gas-quote__row">
            <span>You pay</span>
            <strong>
              {quotePay} {sourceToken?.symbol}
            </strong>
          </div>
          <div className="w1337-gas-quote__row">
            <span>You receive</span>
            <strong>
              ≥ {quoteReceive} {nativeSym}
            </strong>
          </div>
          <div className="w1337-gas-quote__row muted">
            <span>Route</span>
            <span>{formatToolRoute(quote)}</span>
          </div>
          {quote.estimate.feeCosts?.length ? (
            <div className="w1337-gas-quote__row muted">
              <span>Fees</span>
              <span>
                {quote.estimate.feeCosts
                  .map(
                    f =>
                      `${f.name ?? 'Fee'} ${f.amountUSD ? `$${Number(f.amountUSD).toFixed(2)}` : ''}`
                  )
                  .join(' · ')}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {execLog ? (
        <div className="w1337-exec-log" style={{ marginTop: 12 }}>
          <p className="w1337-exec-log__text">{execLog}</p>
          {execUrl ? (
            <p className="w1337-exec-log__sub">
              <a href={execUrl} target="_blank" rel="noopener noreferrer" className="w1337-tx-link">
                Open in explorer ↗
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="w1337-gas-actions">
        <button
          type="button"
          disabled={quoteBusy || execBusy || !sourceToken || !destNative}
          onClick={() => void requestQuote()}
        >
          {quoteBusy ? 'Quoting…' : 'Get quote'}
        </button>
        <button
          type="button"
          className="primary"
          disabled={
            execBusy || quoteBusy || !canSend || !sourceToken || !destNative || !gasAmountStr.trim()
          }
          onClick={() => void executeTopUp()}
        >
          {execBusy ? (hw ? 'Confirm on device…' : 'Topping up…') : 'Top up gas'}
        </button>
      </div>
      <HardwareSignHint show={hw} />
    </div>
  );
}
