import { useEffect, useRef, useState, type ReactNode } from 'react';
import { encodeFunctionData, getAddress, isAddress, parseUnits, formatUnits } from 'viem';
import { getActiveAccountMeta, getSessionPrivateKey, getUnlockedAccount } from '../lib/accountSession';
import { isHardwareAccount } from '../lib/accounts';
import { ERC20_ABI } from '../lib/abis';
import {
  sendErc20Transfer,
  sendNativeTransfer,
} from '../lib/backgroundSign';
import { chainJsonRpcCall, sendTransactionRequest, waitForChainReceipt } from '../lib/ethereum';
import {
  addressExplorerLink,
  blockExplorerLink,
  txExplorerLink,
} from '../lib/explorerTxHistory';
import {
  formatTokenAmount,
  isNativeWalletToken,
  type WalletBalEntry,
} from '../lib/walletBalances';
import { describeError } from '../lib/utils';
import { shouldConfirmInWalletSend } from '../lib/txConfirmMode';
import type { AppSettings } from '../lib/storageState';

const COLLAPSE_AFTER_SEC = 30;
const SEND_ERR_DISMISS_MS = 20_000;

type SendPhase = 'preparing' | 'broadcasting' | 'pending';

type SendProgress = {
  phase: SendPhase;
  headBlock?: number;
  nonce?: number;
  gasLimit?: number;
  txHash?: string;
  tipBlock?: number;
  elapsedSec: number;
  confirmBlock?: number;
};

function shortAddress(addr: string): string {
  const a = addr.trim();
  if (a.length <= 13) return a;
  return `${a.slice(0, 6)}…${a.slice(-6)}`;
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

function phaseLabel(phase: SendPhase): string {
  switch (phase) {
    case 'preparing':
      return 'Preparing';
    case 'broadcasting':
      return 'Broadcasting';
    case 'pending':
      return 'Confirming';
  }
}

function parseBlockNum(hex: string): number {
  return Number.parseInt(hex, hex.startsWith('0x') ? 16 : 10);
}

function DoneScanLink({
  href,
  title,
  children,
}: {
  href?: string;
  title?: string;
  children: ReactNode;
}) {
  if (!href) {
    return (
      <span className="w1337-quick-send-inline__done-value mono" title={title}>
        {children}
      </span>
    );
  }
  return (
    <a
      className="w1337-quick-send-inline__done-value w1337-quick-send-inline__done-link mono"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
    >
      {children}
      <span className="w1337-quick-send-inline__done-link-icon" aria-hidden>
        ↗
      </span>
    </a>
  );
}

function SendProgressPanel({ progress }: { progress: SendProgress }) {
  const estBlocks =
    progress.tipBlock != null && progress.headBlock != null
      ? Math.max(0, progress.tipBlock - progress.headBlock)
      : null;

  return (
    <div className="w1337-quick-send-inline__progress" aria-live="polite">
      <div className="w1337-quick-send-inline__progress-head">
        <span className="w1337-quick-send-inline__pulse" aria-hidden />
        <span className="w1337-quick-send-inline__progress-phase">{phaseLabel(progress.phase)}</span>
        <span className="w1337-quick-send-inline__progress-elapsed muted">{progress.elapsedSec}s</span>
      </div>
      <div className="w1337-quick-send-inline__progress-meta mono">
        {progress.headBlock != null ? (
          <span title="Chain block when transaction was sent">Sent #{progress.headBlock.toLocaleString()}</span>
        ) : null}
        {progress.nonce != null ? <span title="Account nonce">nonce {progress.nonce}</span> : null}
        {progress.gasLimit != null ? (
          <span title="Gas limit">gas {progress.gasLimit.toLocaleString()}</span>
        ) : null}
        {progress.txHash ? (
          <span title={progress.txHash}>tx {shortHash(progress.txHash)}</span>
        ) : null}
        {progress.phase === 'pending' && progress.tipBlock != null ? (
          <span title="Latest chain block while waiting">Current #{progress.tipBlock.toLocaleString()}</span>
        ) : null}
        {progress.phase === 'pending' && estBlocks != null && estBlocks > 0 ? (
          <span title="Blocks mined since send">+{estBlocks} blk</span>
        ) : null}
      </div>
    </div>
  );
}

export function QuickSendInline({
  token,
  chainId,
  settings,
  onCollapse,
  onSent,
}: {
  token: WalletBalEntry;
  chainId: number;
  settings: AppSettings;
  onCollapse: () => void;
  onSent: () => void;
}) {
  const native = isNativeWalletToken(token);
  const balance = BigInt(token.amount || '0');

  const [toRaw, setToRaw] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [amountQuickToggle, setAmountQuickToggle] = useState<'max' | 'half'>('max');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<number | null>(null);
  const [sendProgress, setSendProgress] = useState<SendProgress | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(COLLAPSE_AFTER_SEC);
  const [addrFocused, setAddrFocused] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const progressStartedRef = useRef<number | null>(null);
  const tipPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toValid = toRaw.trim() && isAddress(toRaw.trim());
  const to = toValid ? getAddress(toRaw.trim()) : null;

  let amount: bigint | null = null;
  try {
    amount = amountStr.trim() ? parseUnits(amountStr.trim(), token.decimals) : null;
  } catch {
    amount = null;
  }

  const amountValid = amount != null && amount > 0n;
  const overBalance = amount != null && amount > balance;
  const needsConfirm = shouldConfirmInWalletSend(settings);
  const canSend = !!to && amountValid && !overBalance && !busy;

  const fieldErr =
    err ??
    (toRaw.trim() && !toValid ? 'Invalid address' : null) ??
    (overBalance ? 'Amount exceeds balance' : null);

  useEffect(() => {
    setConfirming(false);
  }, [toRaw, amountStr]);

  useEffect(() => {
    if (!err) return;
    const id = window.setTimeout(() => setErr(null), SEND_ERR_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [err]);

  useEffect(
    () => () => {
      if (tipPollRef.current) clearInterval(tipPollRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!txHash) return;
    setSecondsLeft(COLLAPSE_AFTER_SEC);
    const collapseId = window.setTimeout(() => onCollapse(), COLLAPSE_AFTER_SEC * 1000);
    const tickId = window.setInterval(() => {
      setSecondsLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => {
      window.clearTimeout(collapseId);
      window.clearInterval(tickId);
    };
  }, [txHash, onCollapse]);

  function tickElapsed(): number {
    if (progressStartedRef.current == null) return 0;
    return Math.floor((Date.now() - progressStartedRef.current) / 1000);
  }

  function patchProgress(patch: Partial<SendProgress>) {
    setSendProgress(prev =>
      prev
        ? { ...prev, ...patch, elapsedSec: tickElapsed() }
        : { phase: 'preparing', elapsedSec: tickElapsed(), ...patch },
    );
  }

  function startTipPoll(headBlock: number) {
    if (tipPollRef.current) clearInterval(tipPollRef.current);
    tipPollRef.current = setInterval(() => {
      void chainJsonRpcCall<string>(chainId, 'eth_blockNumber', [])
        .then(hex => {
          patchProgress({ tipBlock: parseBlockNum(hex), headBlock });
        })
        .catch(() => undefined);
      patchProgress({});
    }, 2000);
  }

  function stopTipPoll() {
    if (tipPollRef.current) {
      clearInterval(tipPollRef.current);
      tipPollRef.current = null;
    }
  }

  function setAmountFromPercent(pct: number) {
    if (balance <= 0n) return;
    let spendable = balance;
    if (pct >= 100 && native) {
      try {
        const reserve = parseUnits('0.001', token.decimals);
        if (balance > reserve) spendable = balance - reserve;
      } catch {
        /* use full balance */
      }
    }
    const part = pct >= 100 ? spendable : (balance * BigInt(pct)) / 100n;
    if (part <= 0n) return;
    setAmountStr(formatUnits(part, token.decimals));
  }

  function onMaxHalfToggle() {
    if (amountQuickToggle === 'max') {
      setAmountFromPercent(100);
      setAmountQuickToggle('half');
    } else {
      setAmountFromPercent(50);
      setAmountQuickToggle('max');
    }
  }

  async function fetchChainMeta(from: `0x${string}`, txTo: `0x${string}`, data: `0x${string}`, value: bigint) {
    const [headHex, nonceHex, gasHex] = await Promise.all([
      chainJsonRpcCall<string>(chainId, 'eth_blockNumber', []),
      chainJsonRpcCall<string>(chainId, 'eth_getTransactionCount', [from, 'pending']),
      chainJsonRpcCall<string>(chainId, 'eth_estimateGas', [
        {
          from,
          to: txTo,
          data,
          value: value ? `0x${value.toString(16)}` : '0x0',
        },
      ]),
    ]);
    return {
      headBlock: parseBlockNum(headHex),
      nonce: parseBlockNum(nonceHex),
      gasLimit: Number((BigInt(gasHex) * 125n) / 100n),
    };
  }

  async function submit() {
    setConfirming(false);
    const pk = getSessionPrivateKey();
    const meta = getActiveAccountMeta();
    if ((!pk && !(meta && isHardwareAccount(meta))) || !to || !amount) {
      setErr('Wallet locked.');
      return;
    }

    setBusy(true);
    setErr(null);
    setSendProgress(null);
    progressStartedRef.current = Date.now();
    patchProgress({ phase: 'preparing' });

    try {
      const unlocked = getUnlockedAccount();
      const from = unlocked?.address
        ? getAddress(unlocked.address)
        : meta?.address
          ? getAddress(meta.address)
          : null;
      if (!from) {
        setErr('Wallet locked.');
        return;
      }
      const erc20Data = native
        ? ('0x' as `0x${string}`)
        : encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [to, amount],
          });
      const txTo = native ? to : getAddress(token.address);
      const value = native ? amount : 0n;

      const chainMeta = await fetchChainMeta(from, txTo, erc20Data, value);
      patchProgress({ phase: 'broadcasting', ...chainMeta });

      let hash: string;
      if (meta && isHardwareAccount(meta)) {
        if (native) {
          hash = await sendTransactionRequest(chainId, {
            to,
            value: `0x${amount.toString(16)}`,
            data: '0x',
          });
        } else {
          hash = await sendTransactionRequest(chainId, {
            to: getAddress(token.address),
            value: '0x0',
            data: erc20Data,
          });
        }
      } else {
        hash = native
          ? await sendNativeTransfer({ pk: pk!, chainId, to, amount })
          : await sendErc20Transfer({
              pk: pk!,
              chainId,
              token: getAddress(token.address),
              to,
              amount,
            });
      }

      patchProgress({
        phase: 'pending',
        txHash: hash,
        ...chainMeta,
      });
      startTipPoll(chainMeta.headBlock);

      await waitForChainReceipt(hash, chainId);

      stopTipPoll();
      try {
        const receipt = await chainJsonRpcCall<{ blockNumber?: string }>(
          chainId,
          'eth_getTransactionReceipt',
          [hash],
        );
        if (receipt?.blockNumber) {
          setConfirmBlock(parseBlockNum(receipt.blockNumber));
        }
      } catch {
        /* optional */
      }

      setTxHash(hash);
      onSent();
    } catch (e) {
      stopTipPoll();
      setErr(describeError(e));
    } finally {
      stopTipPoll();
      setSendProgress(null);
      progressStartedRef.current = null;
      setBusy(false);
    }
  }

  function onSendClick() {
    const meta = getActiveAccountMeta();
    const hw = Boolean(meta && isHardwareAccount(meta));
    if (!hw && needsConfirm && !confirming) {
      setConfirming(true);
      setErr(null);
      return;
    }
    void submit();
  }

  const explorerUrl = txHash ? txExplorerLink(chainId, txHash) : undefined;
  const toExplorerUrl = to ? addressExplorerLink(chainId, to) : undefined;
  const blockUrl = confirmBlock != null ? blockExplorerLink(chainId, confirmBlock) : undefined;
  const sentAmount = amount ?? 0n;
  const sentTo = to;

  if (txHash) {
    return (
      <div className="w1337-quick-send-inline w1337-quick-send-inline--done">
        <div className="w1337-quick-send-inline__done-head">
          <span className="w1337-quick-send-inline__ok-badge">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sent
          </span>
          <span className="w1337-quick-send-inline__timer muted">{secondsLeft}s</span>
        </div>
        <div className="w1337-quick-send-inline__done-body">
          <div className="w1337-quick-send-inline__done-line">
            <span className="w1337-quick-send-inline__done-label">Amount</span>
            <span className="w1337-quick-send-inline__done-value">
              {formatTokenAmount(sentAmount, token.decimals)} {token.symbol}
            </span>
          </div>
          {sentTo ? (
            <div className="w1337-quick-send-inline__done-line">
              <span className="w1337-quick-send-inline__done-label">To</span>
              <DoneScanLink href={toExplorerUrl} title={sentTo}>
                {shortAddress(sentTo)}
              </DoneScanLink>
            </div>
          ) : null}
          {confirmBlock != null ? (
            <div className="w1337-quick-send-inline__done-line">
              <span className="w1337-quick-send-inline__done-label">Block</span>
              <DoneScanLink href={blockUrl} title={`Block ${confirmBlock}`}>
                #{confirmBlock.toLocaleString()}
              </DoneScanLink>
            </div>
          ) : null}
          <div className="w1337-quick-send-inline__done-line">
            <span className="w1337-quick-send-inline__done-label">Tx</span>
            <DoneScanLink href={explorerUrl} title={txHash}>
              {shortHash(txHash)}
            </DoneScanLink>
          </div>
        </div>
      </div>
    );
  }

  const addrDisplay =
    addrFocused || !toValid ? toRaw : shortAddress(getAddress(toRaw.trim()));

  return (
    <div className={`w1337-quick-send-inline${busy ? ' w1337-quick-send-inline--sending' : ''}`}>
      <div className="w1337-quick-send-inline__row">
        <input
          className="w1337-quick-send-inline__addr"
          value={addrDisplay}
          onChange={e => setToRaw(e.target.value)}
          onFocus={() => setAddrFocused(true)}
          onBlur={() => setAddrFocused(false)}
          placeholder="Recipient 0x…"
          spellCheck={false}
          autoComplete="off"
          autoFocus
          disabled={busy}
          title={toValid ? getAddress(toRaw.trim()) : undefined}
        />
        <input
          className="w1337-quick-send-inline__amt"
          value={amountStr}
          onChange={e => {
            setAmountQuickToggle('max');
            setAmountStr(e.target.value);
          }}
          placeholder="0.0"
          inputMode="decimal"
          autoComplete="off"
          disabled={busy}
        />
        <div className="w1337-quick-send-inline__actions">
          <button
            type="button"
            className="w1337-quick-send-inline__max"
            onClick={onMaxHalfToggle}
            disabled={busy}
            title={amountQuickToggle === 'max' ? 'Use max balance' : 'Use half balance'}
          >
            {amountQuickToggle === 'max' ? 'Max' : 'Half'}
          </button>
          <button
            type="button"
            className={`w1337-quick-send-inline__send primary${busy ? ' w1337-quick-send-inline__send--busy' : ''}`}
            disabled={!canSend}
            onClick={onSendClick}
          >
            {busy ? (
              <span className="w1337-quick-send-inline__send-spinner" aria-hidden />
            ) : confirming ? (
              'Review'
            ) : (
              'Send'
            )}
          </button>
        </div>
      </div>
      {confirming && !busy ? (
        <div className="w1337-quick-send-inline__confirm">
          <p className="w1337-quick-send-inline__confirm-text">
            Send {amountStr.trim()} {token.symbol} to{' '}
            <span className="mono">{to ? shortAddress(to) : '…'}</span>?
          </p>
          <div className="w1337-quick-send-inline__confirm-actions">
            <button type="button" className="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button type="button" className="primary" onClick={() => void submit()}>
              Confirm send
            </button>
          </div>
        </div>
      ) : null}
      {busy && sendProgress ? <SendProgressPanel progress={sendProgress} /> : null}
      {fieldErr ? <p className="error w1337-quick-send-inline__err">{fieldErr}</p> : null}
    </div>
  );
}
