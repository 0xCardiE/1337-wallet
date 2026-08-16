import { useEffect, useState } from 'react';
import { getAddress, isAddress, parseUnits } from 'viem';
import { getActiveAccountMeta, getSessionPrivateKey } from '../lib/accountSession';
import { isHardwareAccount, shortAddress } from '../lib/accounts';
import { effectiveActiveChainId, type AppSettings } from '../lib/storageState';
import { chainById } from '../lib/chainCatalog';
import {
  multiSendErc20,
  multiSendNative,
  parseAddressList,
  sendErc20Transfer,
  sendNativeTransfer,
} from '../lib/backgroundSign';
import { shouldConfirmInWalletSend } from '../lib/txConfirmMode';
import { describeError } from '../lib/utils';

export function MultiSendView({ settings }: { settings: AppSettings }) {
  const account = getSessionPrivateKey();
  const chainId = effectiveActiveChainId(settings);
  const chain = chainById(chainId);
  const needsConfirm = shouldConfirmInWalletSend(settings);

  const [addressesRaw, setAddressesRaw] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [tokenAddr, setTokenAddr] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  /** When Instant is off: index awaiting Confirm, or null if idle. */
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [queue, setQueue] = useState<{
    recipients: `0x${string}`[];
    amount: bigint;
    token: `0x${string}` | null;
  } | null>(null);

  useEffect(() => {
    setPendingIndex(null);
    setQueue(null);
  }, [addressesRaw, amountStr, tokenAddr, needsConfirm]);

  function resetQueue() {
    setPendingIndex(null);
    setQueue(null);
  }

  async function sendOne(
    pk: `0x${string}`,
    to: `0x${string}`,
    amount: bigint,
    token: `0x${string}` | null,
  ): Promise<string> {
    if (token) {
      return sendErc20Transfer({
        pk,
        chainId,
        token,
        to,
        amount,
      });
    }
    return sendNativeTransfer({ pk, chainId, to, amount });
  }

  async function sendAllImmediate(
    pk: `0x${string}`,
    recipients: `0x${string}`[],
    amount: bigint,
    token: `0x${string}` | null,
  ) {
    const hashes = token
      ? await multiSendErc20({
          pk,
          chainId,
          token,
          recipients,
          amountPerRecipient: amount,
        })
      : await multiSendNative({
          pk,
          chainId,
          recipients,
          amountPerRecipient: amount,
        });
    setLog(hashes.map((h, i) => `${i + 1}. ${recipients[i]} → ${h}`));
  }

  async function startOrSend() {
    setErr(null);
    setLog([]);
    const meta = getActiveAccountMeta();
    if (!account) {
      setErr(
        meta && isHardwareAccount(meta)
          ? 'Multi-send currently requires a local key account. Switch active account in Settings.'
          : 'Wallet must be unlocked with a private key.',
      );
      return;
    }
    const pk = account;

    let recipients: `0x${string}`[];
    let amount: bigint;
    let token: `0x${string}` | null;
    try {
      recipients = parseAddressList(addressesRaw);
      const decimals = chain?.nativeCurrency.decimals ?? 18;
      amount = parseUnits(amountStr.trim() || '0', decimals);
      if (amount <= 0n) throw new Error('Enter a positive amount per recipient.');
      const rawToken = tokenAddr.trim();
      if (rawToken) {
        if (!isAddress(rawToken)) throw new Error('Invalid token address');
        token = getAddress(rawToken);
      } else {
        token = null;
      }
    } catch (e) {
      setErr(describeError(e));
      return;
    }

    if (needsConfirm) {
      setQueue({ recipients, amount, token });
      setPendingIndex(0);
      return;
    }

    setBusy(true);
    try {
      await sendAllImmediate(pk, recipients, amount, token);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmPending() {
    if (pendingIndex == null || !queue || !account) return;
    const { recipients, amount, token } = queue;
    const to = recipients[pendingIndex];
    if (!to) {
      resetQueue();
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      const hash = await sendOne(account, to, amount, token);
      setLog(prev => [...prev, `${pendingIndex + 1}. ${to} → ${hash}`]);
      const next = pendingIndex + 1;
      if (next >= recipients.length) {
        resetQueue();
      } else {
        setPendingIndex(next);
      }
    } catch (e) {
      setErr(describeError(e));
      resetQueue();
    } finally {
      setBusy(false);
    }
  }

  const previewCount = addressesRaw
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(Boolean).length;

  const pendingTo =
    pendingIndex != null && queue ? queue.recipients[pendingIndex] : null;
  const pendingTotal = queue?.recipients.length ?? 0;

  return (
    <div className="w1337-send-panel">
      <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
        Each recipient is a separate transaction. Turn{' '}
        <strong style={{ color: 'var(--text)' }}>Instant On</strong> to skip confirming every
        send — otherwise you approve one address at a time. Network:{' '}
        {chain?.name ?? chainId}.
      </p>

      <label htmlFor="ms-addrs">Recipients (one per line)</label>
      <textarea
        id="ms-addrs"
        value={addressesRaw}
        onChange={e => setAddressesRaw(e.target.value)}
        rows={6}
        placeholder={'0xabc…\n0xdef…'}
        spellCheck={false}
        disabled={busy || pendingIndex != null}
      />
      <p className="muted" style={{ fontSize: 11 }}>
        {previewCount} address{previewCount === 1 ? '' : 'es'} detected
      </p>

      <label htmlFor="ms-amt">Amount per recipient</label>
      <input
        id="ms-amt"
        value={amountStr}
        onChange={e => setAmountStr(e.target.value)}
        placeholder="0.01"
        inputMode="decimal"
        disabled={busy || pendingIndex != null}
      />

      <label htmlFor="ms-token" style={{ marginTop: 12 }}>
        ERC-20 token (leave empty for native)
      </label>
      <input
        id="ms-token"
        value={tokenAddr}
        onChange={e => setTokenAddr(e.target.value)}
        placeholder="0x… or empty for ETH/native"
        disabled={busy || pendingIndex != null}
      />
      {tokenAddr.trim() && !isAddress(tokenAddr.trim()) ? (
        <p className="error" style={{ fontSize: 12 }}>
          Invalid token address
        </p>
      ) : null}

      {err ? <p className="error">{err}</p> : null}

      {pendingTo ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: '1px solid var(--border-strong)',
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            Confirm {pendingIndex! + 1}/{pendingTotal} · {shortAddress(pendingTo)}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="ghost"
              style={{ flex: 1 }}
              disabled={busy}
              onClick={() => resetQueue()}
            >
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              style={{ flex: 1 }}
              disabled={busy}
              onClick={() => void confirmPending()}
            >
              {busy ? 'Sending…' : 'Confirm send'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="primary"
          style={{ width: '100%', marginTop: 12 }}
          disabled={busy || !addressesRaw.trim() || !amountStr.trim()}
          onClick={() => void startOrSend()}
        >
          {busy ? 'Sending…' : needsConfirm ? 'Review & send' : 'Send to all'}
        </button>
      )}

      {log.length ? (
        <div
          className="mono"
          style={{
            marginTop: 14,
            fontSize: 11,
            padding: 10,
            border: '1px solid var(--border)',
            borderRadius: 8,
            maxHeight: 160,
            overflow: 'auto',
          }}
        >
          {log.map(line => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
