import { useEffect, useState } from 'react';
import { getAddress, isAddress, parseUnits } from 'viem';
import {
  getActiveAccountMeta,
  getSessionPrivateKey,
  getUnlockedAccount,
} from '../lib/accountSession';
import { isHardwareAccount, shortAddress } from '../lib/accounts';
import { effectiveActiveChainId, type AppSettings } from '../lib/storageState';
import { chainById } from '../lib/chainCatalog';
import { parseAddressList } from '../lib/backgroundSign';
import {
  DISPERSE_CREATE2_ADDRESS,
  deployDisperseViaCreateX,
  disperseErc20,
  disperseNative,
  resolveDisperse,
  type DisperseResolution,
} from '../lib/disperse';
import { shouldConfirmInWalletSend } from '../lib/txConfirmMode';
import { describeError } from '../lib/utils';

export function MultiSendView({ settings }: { settings: AppSettings }) {
  const pk = getSessionPrivateKey();
  const meta = getActiveAccountMeta();
  const unlocked = getUnlockedAccount();
  const hw = Boolean(meta && isHardwareAccount(meta));
  const canSend = Boolean(pk || hw);
  const chainId = effectiveActiveChainId(settings);
  const chain = chainById(chainId);
  const needsConfirm = shouldConfirmInWalletSend(settings) && !hw;
  const needsDeployConfirm = !hw;

  const [addressesRaw, setAddressesRaw] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [tokenAddr, setTokenAddr] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [probe, setProbe] = useState<DisperseResolution | null>(null);
  const [pending, setPending] = useState<{
    recipients: `0x${string}`[];
    amount: bigint;
    token: `0x${string}` | null;
  } | null>(null);
  const [pendingDeploy, setPendingDeploy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProbe(null);
    setPendingDeploy(false);
    void resolveDisperse(chainId, { refresh: true }).then(next => {
      if (!cancelled) setProbe(next);
    });
    return () => {
      cancelled = true;
    };
  }, [chainId]);

  useEffect(() => {
    setPending(null);
  }, [addressesRaw, amountStr, tokenAddr, chainId]);

  async function refreshProbe() {
    const next = await resolveDisperse(chainId, { refresh: true });
    setProbe(next);
    return next;
  }

  async function sendViaDisperse(
    recipients: `0x${string}`[],
    amount: bigint,
    token: `0x${string}` | null,
  ) {
    if (token) {
      const { approveHash, hash } = await disperseErc20({
        chainId,
        token,
        recipients,
        amountPerRecipient: amount,
      });
      setLog([
        ...(approveHash ? [`Approve Disperse → ${approveHash}`] : []),
        `Disperse ${recipients.length} recipients → ${hash}`,
      ]);
      return;
    }
    const hash = await disperseNative({
      chainId,
      recipients,
      amountPerRecipient: amount,
    });
    setLog([`Disperse ${recipients.length} recipients → ${hash}`]);
  }

  function parseForm(): {
    recipients: `0x${string}`[];
    amount: bigint;
    token: `0x${string}` | null;
  } {
    const recipients = parseAddressList(addressesRaw);
    const decimals = chain?.nativeCurrency.decimals ?? 18;
    const amount = parseUnits(amountStr.trim() || '0', decimals);
    if (amount <= 0n) throw new Error('Enter a positive amount per recipient.');
    const rawToken = tokenAddr.trim();
    if (rawToken) {
      if (!isAddress(rawToken)) throw new Error('Invalid token address');
      return { recipients, amount, token: getAddress(rawToken) };
    }
    return { recipients, amount, token: null };
  }

  async function startOrSend() {
    setErr(null);
    setLog([]);
    if (!canSend) {
      setErr(
        hw
          ? 'Unlock the wallet and keep the device ready.'
          : 'Wallet must be unlocked with a private key.',
      );
      return;
    }
    if (!probe?.address) {
      setErr(
        probe?.canDeploy
          ? 'Deploy Disperse.app on this network first, then send the batch.'
          : 'Disperse.app is not on this network. Switch chain to send a batch.',
      );
      return;
    }

    let parsed: ReturnType<typeof parseForm>;
    try {
      parsed = parseForm();
    } catch (e) {
      setErr(describeError(e));
      return;
    }

    if (needsConfirm) {
      setPending(parsed);
      return;
    }

    setBusy(true);
    try {
      await sendViaDisperse(parsed.recipients, parsed.amount, parsed.token);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmPending() {
    if (!pending) return;
    setBusy(true);
    setErr(null);
    try {
      await sendViaDisperse(pending.recipients, pending.amount, pending.token);
      setPending(null);
    } catch (e) {
      setErr(describeError(e));
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  async function runDeploy() {
    setBusy(true);
    setErr(null);
    setLog([]);
    try {
      const { hash, alreadyPresent } = await deployDisperseViaCreateX(chainId);
      const next = await refreshProbe();
      if (alreadyPresent && next.address) {
        setLog([`Disperse.app is already at ${next.address}.`]);
      } else if (hash) {
        setLog([`Deployed Disperse.app → ${hash}`]);
      }
      setPendingDeploy(false);
    } catch (e) {
      try {
        const next = await refreshProbe();
        if (next.address) {
          setLog([`Disperse.app is already at ${next.address}.`]);
          setPendingDeploy(false);
          setErr(null);
          return;
        }
      } catch {
        /* keep original error */
      }
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  function startOrDeploy() {
    setErr(null);
    setLog([]);
    if (!canSend) {
      setErr(
        hw
          ? 'Unlock the wallet and keep the device ready.'
          : 'Wallet must be unlocked with a private key.',
      );
      return;
    }
    if (needsDeployConfirm) {
      setPendingDeploy(true);
      return;
    }
    void runDeploy();
  }

  const previewCount = addressesRaw
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(Boolean).length;
  const nativeSymbol = chain?.nativeCurrency.symbol ?? 'ETH';
  const formLocked = busy || pending != null || pendingDeploy;
  const disperseOn = Boolean(probe?.address);

  return (
    <div className="w1337-send-panel">
      <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
        Always one{' '}
        <a href="https://disperse.app" target="_blank" rel="noreferrer">
          Disperse.app
        </a>{' '}
        transaction (plus a token approve if needed). No fee from the contract; leftover{' '}
        {nativeSymbol} is refunded to you. Network: {chain?.name ?? chainId}.
      </p>

      {probe?.address ? (
        <p className="w1337-ms-note w1337-ms-note--ok">
          Using Disperse.app ({shortAddress(probe.address)}
          {probe.source === 'create2' ? ', via CreateX' : ''}).
          {tokenAddr.trim() ? ' ERC-20 needs an approve first, then the batch.' : ''}
        </p>
      ) : probe?.canDeploy ? (
        <p className="w1337-ms-note w1337-ms-note--warn">
          Disperse.app is not on this network yet. You can deploy it once via CreateX at{' '}
          {shortAddress(DISPERSE_CREATE2_ADDRESS)}. You pay gas; later users share that address.
        </p>
      ) : probe ? (
        <p className="w1337-ms-note w1337-ms-note--warn">
          Disperse.app is not deployed on this network, and CreateX is not here either. Switch to
          Ethereum, Base, Arbitrum, Optimism, Polygon, or another chain that has Disperse or CreateX.
        </p>
      ) : (
        <p className="muted" style={{ fontSize: 12 }}>
          Checking for Disperse.app on this network…
        </p>
      )}

      <label htmlFor="ms-addrs">Recipients (one per line)</label>
      <textarea
        id="ms-addrs"
        value={addressesRaw}
        onChange={e => setAddressesRaw(e.target.value)}
        rows={6}
        placeholder={'0xabc…\n0xdef…'}
        spellCheck={false}
        disabled={formLocked}
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
        disabled={formLocked}
      />

      <label htmlFor="ms-token" style={{ marginTop: 12 }}>
        ERC-20 token (leave empty for native)
      </label>
      <input
        id="ms-token"
        value={tokenAddr}
        onChange={e => setTokenAddr(e.target.value)}
        placeholder="0x… or empty for ETH/native"
        disabled={formLocked}
      />
      {tokenAddr.trim() && !isAddress(tokenAddr.trim()) ? (
        <p className="error" style={{ fontSize: 12 }}>
          Invalid token address
        </p>
      ) : null}

      {err ? <p className="error">{err}</p> : null}

      {pendingDeploy ? (
        <div className="w1337-ms-confirm">
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            Deploy Disperse.app on {chain?.name ?? `chain ${chainId}`} via CreateX
            {unlocked?.address ? ` from ${shortAddress(unlocked.address)}` : ''}. Later users share{' '}
            {shortAddress(DISPERSE_CREATE2_ADDRESS)}.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="ghost"
              style={{ flex: 1 }}
              disabled={busy}
              onClick={() => setPendingDeploy(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              style={{ flex: 1 }}
              disabled={busy || !canSend}
              onClick={() => void runDeploy()}
            >
              {busy ? 'Deploying…' : 'Confirm deploy'}
            </button>
          </div>
        </div>
      ) : pending ? (
        <div className="w1337-ms-confirm">
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            Send {amountStr} {pending.token ? 'tokens' : nativeSymbol} to {pending.recipients.length}{' '}
            addresses via Disperse.app
            {unlocked?.address ? ` from ${shortAddress(unlocked.address)}` : ''}.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="ghost"
              style={{ flex: 1 }}
              disabled={busy}
              onClick={() => setPending(null)}
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
              {busy ? 'Sending…' : 'Confirm Disperse'}
            </button>
          </div>
        </div>
      ) : probe?.canDeploy && !probe.address ? (
        <button
          type="button"
          className="primary"
          style={{ width: '100%', marginTop: 12 }}
          disabled={busy || !canSend}
          onClick={() => startOrDeploy()}
        >
          {busy ? 'Deploying…' : needsDeployConfirm ? 'Review deploy' : 'Deploy Disperse'}
        </button>
      ) : (
        <button
          type="button"
          className="primary"
          style={{ width: '100%', marginTop: 12 }}
          disabled={
            busy ||
            !canSend ||
            !disperseOn ||
            !addressesRaw.trim() ||
            !amountStr.trim()
          }
          onClick={() => void startOrSend()}
        >
          {busy ? 'Sending…' : needsConfirm ? 'Review Disperse' : 'Send via Disperse'}
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
