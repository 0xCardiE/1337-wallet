import { useEffect, useMemo, useState } from 'react';
import { getAddress, isAddress, parseUnits } from 'viem';
import {
  getActiveAccountMeta,
  getSessionPrivateKey,
  getUnlockedAccount,
} from '../lib/accountSession';
import { isHardwareAccount, shortAddress } from '../lib/accounts';
import { chainLogoUri } from '../lib/chainLogo';
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
import { fetchErc20Meta } from '../lib/txRisk';
import { describeError } from '../lib/utils';
import {
  fmtTokenAmount,
  hydrateAssetBalanceCache,
  isNativeWalletToken,
  loadWalletBalancesForChain,
  peekMainBalances,
  peekOtherBalances,
  tokenUsdNumber,
  type WalletBalEntry,
} from '../lib/walletBalances';
import { Select1337, type Select1337Group } from './Select1337';

const NATIVE_PICK = 'native';
const CUSTOM_PICK = 'custom';

function mergeHeldTokens(rows: WalletBalEntry[]): WalletBalEntry[] {
  const byAddr = new Map<string, WalletBalEntry>();
  for (const row of rows) byAddr.set(row.address.toLowerCase(), row);
  return [...byAddr.values()];
}

function hasPositiveBalance(row: WalletBalEntry): boolean {
  try {
    return BigInt(row.amount || '0') > 0n;
  } catch {
    return false;
  }
}

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
  const [tokenPick, setTokenPick] = useState(NATIVE_PICK);
  const [customTokenAddr, setCustomTokenAddr] = useState('');
  const [heldTokens, setHeldTokens] = useState<WalletBalEntry[]>([]);
  const [tokensBusy, setTokensBusy] = useState(false);
  const [customMeta, setCustomMeta] = useState<{ decimals: number; symbol?: string } | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [probe, setProbe] = useState<DisperseResolution | null>(null);
  const [pending, setPending] = useState<{
    recipients: `0x${string}`[];
    amount: bigint;
    token: `0x${string}` | null;
    symbol: string;
  } | null>(null);
  const [pendingDeploy, setPendingDeploy] = useState(false);

  const addr = unlocked ? getAddress(unlocked.address) : null;

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
  }, [addressesRaw, amountStr, tokenPick, customTokenAddr, chainId]);

  useEffect(() => {
    setTokenPick(NATIVE_PICK);
    setCustomTokenAddr('');
    setCustomMeta(null);
    setOpenMenu(null);
  }, [chainId]);

  useEffect(() => {
    if (!addr) {
      setHeldTokens([]);
      setTokensBusy(false);
      return;
    }
    let cancelled = false;
    setTokensBusy(true);
    void (async () => {
      await hydrateAssetBalanceCache();
      if (cancelled) return;
      const cached = mergeHeldTokens([
        ...peekMainBalances(chainId, addr),
        ...(peekOtherBalances(chainId, addr)?.rows ?? []),
      ]);
      if (cached.length) setHeldTokens(cached);
      const { rows } = await loadWalletBalancesForChain(addr, chainId);
      if (cancelled) return;
      const next = rows.filter(row => isNativeWalletToken(row) || hasPositiveBalance(row));
      if (next.length) setHeldTokens(mergeHeldTokens(next));
    })()
      .catch(() => {
        /* keep cached rows */
      })
      .finally(() => {
        if (!cancelled) setTokensBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addr, chainId]);

  useEffect(() => {
    if (tokenPick !== CUSTOM_PICK) {
      setCustomMeta(null);
      return;
    }
    const raw = customTokenAddr.trim();
    if (!isAddress(raw)) {
      setCustomMeta(null);
      return;
    }
    let cancelled = false;
    void fetchErc20Meta(chainId, getAddress(raw)).then(meta => {
      if (!cancelled) setCustomMeta(meta);
    });
    return () => {
      cancelled = true;
    };
  }, [tokenPick, customTokenAddr, chainId]);

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

  const nativeSymbol = chain?.nativeCurrency.symbol ?? 'ETH';
  const nativeRow = useMemo(
    () => heldTokens.find(isNativeWalletToken) ?? null,
    [heldTokens],
  );
  const erc20Rows = useMemo(
    () =>
      heldTokens
        .filter(t => !isNativeWalletToken(t) && hasPositiveBalance(t))
        .sort((a, b) => {
          const usd = tokenUsdNumber(b) - tokenUsdNumber(a);
          if (usd !== 0) return usd;
          return a.symbol.localeCompare(b.symbol);
        }),
    [heldTokens],
  );
  const selectedHeld = useMemo(() => {
    if (tokenPick === NATIVE_PICK || tokenPick === CUSTOM_PICK) return null;
    const key = tokenPick.toLowerCase();
    return erc20Rows.find(t => t.address.toLowerCase() === key) ?? null;
  }, [erc20Rows, tokenPick]);
  const tokenGroups = useMemo((): Select1337Group[] => {
    const nativeLogo = nativeRow?.logoURI ?? (chain ? chainLogoUri(chain) : undefined);
    const nativeSub =
      nativeRow && hasPositiveBalance(nativeRow)
        ? `${fmtTokenAmount(nativeRow)} available`
        : tokensBusy
          ? 'Loading…'
          : undefined;
    return [
      {
        label: 'Token',
        options: [
          {
            value: NATIVE_PICK,
            label: nativeSymbol,
            sublabel: nativeSub,
            logoURI: nativeLogo,
          },
          ...erc20Rows.map(t => ({
            value: t.address.toLowerCase(),
            label: t.symbol,
            sublabel: `${fmtTokenAmount(t)} available`,
            logoURI: t.logoURI,
          })),
          {
            value: CUSTOM_PICK,
            label: 'Other token…',
            sublabel: 'Paste contract address',
          },
        ],
      },
    ];
  }, [chain, erc20Rows, nativeRow, nativeSymbol, tokensBusy]);

  const tokenTrigger = (() => {
    if (tokenPick === CUSTOM_PICK) {
      const raw = customTokenAddr.trim();
      return {
        label: customMeta?.symbol ?? 'Other token',
        sublabel: isAddress(raw) ? shortAddress(getAddress(raw)) : 'Paste contract address',
        logoURI: undefined as string | undefined,
      };
    }
    if (tokenPick === NATIVE_PICK) {
      return {
        label: nativeSymbol,
        sublabel:
          nativeRow && hasPositiveBalance(nativeRow)
            ? `${fmtTokenAmount(nativeRow)} available`
            : tokensBusy
              ? 'Loading…'
              : undefined,
        logoURI: nativeRow?.logoURI ?? (chain ? chainLogoUri(chain) : undefined),
      };
    }
    if (selectedHeld) {
      return {
        label: selectedHeld.symbol,
        sublabel: `${fmtTokenAmount(selectedHeld)} available`,
        logoURI: selectedHeld.logoURI,
      };
    }
    return { label: 'Select token', sublabel: undefined, logoURI: undefined };
  })();
  const sendingErc20 = tokenPick !== NATIVE_PICK;

  async function parseForm(): Promise<{
    recipients: `0x${string}`[];
    amount: bigint;
    token: `0x${string}` | null;
    symbol: string;
  }> {
    const recipients = parseAddressList(addressesRaw);
    if (tokenPick === CUSTOM_PICK) {
      const raw = customTokenAddr.trim();
      if (!raw || !isAddress(raw)) throw new Error('Invalid token address');
      const token = getAddress(raw);
      const meta = customMeta ?? (await fetchErc20Meta(chainId, token));
      const amount = parseUnits(amountStr.trim() || '0', meta.decimals);
      if (amount <= 0n) throw new Error('Enter a positive amount per recipient.');
      return {
        recipients,
        amount,
        token,
        symbol: meta.symbol ?? 'tokens',
      };
    }
    if (tokenPick !== NATIVE_PICK) {
      if (!isAddress(tokenPick)) throw new Error('Invalid token address');
      const row =
        selectedHeld ??
        heldTokens.find(t => t.address.toLowerCase() === tokenPick.toLowerCase());
      const decimals = row?.decimals ?? 18;
      const amount = parseUnits(amountStr.trim() || '0', decimals);
      if (amount <= 0n) throw new Error('Enter a positive amount per recipient.');
      return {
        recipients,
        amount,
        token: getAddress(tokenPick),
        symbol: row?.symbol ?? 'tokens',
      };
    }
    const decimals = chain?.nativeCurrency.decimals ?? 18;
    const amount = parseUnits(amountStr.trim() || '0', decimals);
    if (amount <= 0n) throw new Error('Enter a positive amount per recipient.');
    return { recipients, amount, token: null, symbol: nativeSymbol };
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

    let parsed: Awaited<ReturnType<typeof parseForm>>;
    try {
      parsed = await parseForm();
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
          {sendingErc20 ? ' ERC-20 needs an approve first, then the batch.' : ''}
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

      <div className="w1337-ms-token">
        <Select1337
          id="ms-token"
          label="Token"
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          value={tokenPick}
          triggerLabel={tokenTrigger.label}
          triggerSublabel={tokenTrigger.sublabel}
          triggerLogoURI={tokenTrigger.logoURI}
          groups={tokenGroups}
          disabled={formLocked}
          onPick={setTokenPick}
        />
        {tokenPick === CUSTOM_PICK ? (
          <>
            <label htmlFor="ms-token-addr">Token contract</label>
            <input
              id="ms-token-addr"
              value={customTokenAddr}
              onChange={e => setCustomTokenAddr(e.target.value)}
              placeholder="0x…"
              disabled={formLocked}
            />
            {customTokenAddr.trim() && !isAddress(customTokenAddr.trim()) ? (
              <p className="error" style={{ fontSize: 12 }}>
                Invalid token address
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      <label htmlFor="ms-amt">
        Amount per recipient
        {tokenTrigger.label !== 'Other token' && tokenTrigger.label !== 'Select token'
          ? ` (${tokenTrigger.label})`
          : ''}
      </label>
      <input
        id="ms-amt"
        value={amountStr}
        onChange={e => setAmountStr(e.target.value)}
        placeholder={
          tokenPick === CUSTOM_PICK && !customMeta?.symbol
            ? '0.01'
            : `0.01 ${tokenTrigger.label}`
        }
        inputMode="decimal"
        disabled={formLocked}
      />

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
            Send {amountStr} {pending.symbol} to {pending.recipients.length}{' '}
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
            !amountStr.trim() ||
            (tokenPick === CUSTOM_PICK && !isAddress(customTokenAddr.trim()))
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
