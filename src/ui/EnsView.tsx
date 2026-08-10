import { useCallback, useEffect, useRef, useState } from 'react';
import type { Hex } from 'viem';
import { getUnlockedAccount, getActiveAccountMeta } from '../lib/accountSession';
import { isHardwareAccount } from '../lib/accounts';
import { COMMIT_WAIT_SECONDS } from '../lib/ensContracts';
import {
  contentHashGatewayUrl,
  encodeContentHashInput,
} from '../lib/ensContentHash';
import {
  checkEthNameAvailable,
  commitEthNameRegistration,
  enrichEnsDomainOnChain,
  ensNameExpiresSoon,
  fetchEnsPortfolio,
  fetchRegistrationPriceEth,
  fetchRenewPriceEth,
  formatEnsExpiry,
  registerEthName,
  renewEthName,
  setDomainContentHash,
  setDomainUrlText,
  type EnsDomainRecord,
} from '../lib/ensPortfolio';
import { DEFAULT_CHAIN_ID } from '../lib/constants';
import { describeError } from '../lib/utils';
import { RpcExhaustedError } from '../lib/rpcHealth';
import { transactionExplorerUrl } from '../lib/explorerUrls';
import type { AppSettings } from '../lib/storageState';
import { shouldConfirmInWalletSend } from '../lib/txConfirmMode';
import { RefreshIconButton } from './RefreshIconButton';

type RegisterStep = 'idle' | 'committing' | 'waiting' | 'ready' | 'registering' | 'done';

type EnsTxPrompt = {
  /** Where to render the confirm card (next to the button that opened it). */
  anchor: 'register' | `domain:${string}`;
  title: string;
  detail: string;
  run: () => Promise<void>;
};

type RegisterFeedback = {
  type: 'success' | 'info' | 'error';
  message: string;
  txHash?: string;
};

function EnsTxConfirm({
  prompt,
  onCancel,
  onConfirm,
  confirmRef,
}: {
  prompt: EnsTxPrompt;
  onCancel: () => void;
  onConfirm: () => void;
  confirmRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="w1337-ens-confirm" ref={confirmRef}>
      <p className="w1337-ens-confirm__title">{prompt.title}</p>
      <p className="muted w1337-ens-confirm__detail">{prompt.detail}</p>
      <div className="w1337-ens-confirm__actions">
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="primary" onClick={onConfirm}>
          Confirm
        </button>
      </div>
    </div>
  );
}

function EnsRegisterFeedback({ feedback }: { feedback: RegisterFeedback }) {
  const txUrl = feedback.txHash
    ? transactionExplorerUrl(DEFAULT_CHAIN_ID, feedback.txHash)
    : undefined;

  return (
    <div
      className={`w1337-ens-register-feedback w1337-ens-register-feedback--${feedback.type}`}
      role="status"
    >
      <p className="w1337-ens-register-feedback__message">{feedback.message}</p>
      {txUrl ? (
        <p className="w1337-ens-register-feedback__tx">
          <ExternalLink href={txUrl}>View transaction ↗</ExternalLink>
        </p>
      ) : null}
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  );
}

function formatEnsLoadError(err: unknown): string {
  if (err instanceof RpcExhaustedError) {
    return `${err.message} Try Networks → Ethereum to pick another RPC, or wait a minute and refresh.`;
  }
  return describeError(err);
}

function DomainRow({
  domain,
  busy,
  txPrompt,
  onConfirmTx,
  onCancelTx,
  onRenew,
  onSaveContent,
  onSaveUrl,
  onDomainUpdated,
}: {
  domain: EnsDomainRecord;
  busy: boolean;
  txPrompt: EnsTxPrompt | null;
  onConfirmTx: () => void;
  onCancelTx: () => void;
  onRenew: (name: string) => void;
  onSaveContent: (name: string, value: string) => void;
  onSaveUrl: (name: string, value: string) => void;
  onDomainUpdated: (domain: EnsDomainRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const [contentDraft, setContentDraft] = useState(domain.contentHash.uri ?? '');
  const [urlDraft, setUrlDraft] = useState(domain.urlText ?? '');
  const [onChainLoaded, setOnChainLoaded] = useState(false);
  const [onChainLoading, setOnChainLoading] = useState(false);
  const [onChainErr, setOnChainErr] = useState<string | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const showConfirm = txPrompt?.anchor === `domain:${domain.name}` && !busy;

  const gateway = contentHashGatewayUrl(domain.contentHash);
  const expiring = ensNameExpiresSoon(domain.expiryDate);

  useEffect(() => {
    setContentDraft(domain.contentHash.uri ?? '');
    setUrlDraft(domain.urlText ?? '');
    if (domain.contentHash.uri || domain.urlText) setOnChainLoaded(true);
  }, [domain.contentHash.uri, domain.urlText, domain.name]);

  useEffect(() => {
    if (!open || onChainLoaded || onChainLoading) return;
    setOnChainLoading(true);
    setOnChainErr(null);
    void enrichEnsDomainOnChain(domain)
      .then(updated => {
        onDomainUpdated(updated);
        setOnChainLoaded(true);
      })
      .catch(e => setOnChainErr(formatEnsLoadError(e)))
      .finally(() => setOnChainLoading(false));
  }, [open, onChainLoaded, onChainLoading, domain, onDomainUpdated]);

  useEffect(() => {
    if (!showConfirm) return;
    setOpen(true);
    confirmRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [showConfirm]);

  return (
    <li className={`w1337-ens-row${open ? ' w1337-ens-row--open' : ''}`}>
      <button
        type="button"
        className="w1337-ens-row__head"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <span className="w1337-ens-row__name">{domain.name}</span>
        <span
          className={`w1337-ens-row__expiry${expiring ? ' w1337-ens-row__expiry--soon' : ''}`}
          title={
            domain.expiryInheritedFrom
              ? `Subdomain — valid while ${domain.expiryInheritedFrom} is registered`
              : undefined
          }
        >
          {domain.expiryDate
            ? formatEnsExpiry(domain.expiryDate)
            : domain.isSubdomain
              ? '—'
              : 'no expiry'}
        </span>
      </button>

      {open ? (
        <div className="w1337-ens-row__body">
          <p className="muted w1337-ens-row__meta">
            {domain.isSubdomain ? 'Subdomain' : '.eth name'}
            {domain.expiryInheritedFrom
              ? ` · expires with ${domain.expiryInheritedFrom}`
              : ''}
            {domain.resolver ? ` · resolver ${domain.resolver.slice(0, 10)}…` : ' · no resolver'}
          </p>

          {onChainLoading ? (
            <p className="muted w1337-ens-row__hint">Loading on-chain records…</p>
          ) : null}
          {onChainErr ? <p className="error">{onChainErr}</p> : null}

          <div className="w1337-ens-row__field">
            <label htmlFor={`content-${domain.name}`}>Content hash</label>
            <input
              id={`content-${domain.name}`}
              value={contentDraft}
              disabled={busy}
              placeholder="ipfs://… or bzz://…"
              onChange={e => setContentDraft(e.target.value)}
            />
            {domain.contentHash.uri ? (
              <p className="muted w1337-ens-row__hint">
                Current: {domain.contentHash.uri}
                {gateway ? (
                  <>
                    {' '}
                    · <ExternalLink href={gateway}>open</ExternalLink>
                  </>
                ) : null}
              </p>
            ) : (
              <p className="muted w1337-ens-row__hint">
                Points dapps/browsers at decentralized content (IPFS, Swarm).
              </p>
            )}
            <button
              type="button"
              className="ghost"
              disabled={busy || !contentDraft.trim()}
              onClick={() => onSaveContent(domain.name, contentDraft)}
            >
              Save content hash
            </button>
          </div>

          <div className="w1337-ens-row__field">
            <label htmlFor={`url-${domain.name}`}>URL text record</label>
            <input
              id={`url-${domain.name}`}
              value={urlDraft}
              disabled={busy}
              placeholder="https://…"
              onChange={e => setUrlDraft(e.target.value)}
            />
            <p className="muted w1337-ens-row__hint">
              Optional classic website link (text record <code>url</code>).
            </p>
            <button
              type="button"
              className="ghost"
              disabled={busy || !urlDraft.trim()}
              onClick={() => onSaveUrl(domain.name, urlDraft)}
            >
              Save URL
            </button>
          </div>

          {domain.canRenew ? (
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => onRenew(domain.name)}
            >
              Extend 1 year
            </button>
          ) : null}

          {showConfirm && txPrompt ? (
            <EnsTxConfirm
              prompt={txPrompt}
              confirmRef={confirmRef}
              onCancel={onCancelTx}
              onConfirm={onConfirmTx}
            />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function EnsView({ settings }: { settings: AppSettings }) {
  const account = getUnlockedAccount();
  const meta = getActiveAccountMeta();
  const addr = account?.address;
  const theGraphApiKey = settings.theGraphApiKey?.trim();

  const [domains, setDomains] = useState<EnsDomainRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [registerLabel, setRegisterLabel] = useState('');
  const [registerStep, setRegisterStep] = useState<RegisterStep>('idle');
  const [registerAvailable, setRegisterAvailable] = useState<boolean | null>(null);
  const [registerPrice, setRegisterPrice] = useState<string | null>(null);
  const [registerSecret, setRegisterSecret] = useState<Hex | null>(null);
  const [registerRpcErr, setRegisterRpcErr] = useState<string | null>(null);
  const [registerFeedback, setRegisterFeedback] = useState<RegisterFeedback | null>(null);
  const [commitReadyAt, setCommitReadyAt] = useState<number | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(COMMIT_WAIT_SECONDS);
  const [txPrompt, setTxPrompt] = useState<EnsTxPrompt | null>(null);
  const registerConfirmRef = useRef<HTMLDivElement>(null);

  const needsConfirm = shouldConfirmInWalletSend(settings);
  const showRegisterConfirm = txPrompt?.anchor === 'register' && !busy;

  const reload = useCallback(async () => {
    if (!addr) return;
    setLoading(true);
    setErr(null);
    try {
      const rows = await fetchEnsPortfolio(addr, { theGraphApiKey });
      setDomains(rows);
    } catch (e) {
      setErr(formatEnsLoadError(e));
      setDomains([]);
    } finally {
      setLoading(false);
    }
  }, [addr, theGraphApiKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const label = registerLabel.trim().toLowerCase().replace(/\.eth$/i, '');
    if (
      !label ||
      (registerStep !== 'idle' && registerStep !== 'waiting' && registerStep !== 'ready')
    ) {
      if (registerStep === 'idle') {
        setRegisterAvailable(null);
        setRegisterPrice(null);
      }
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          setRegisterRpcErr(null);
          const available = await checkEthNameAvailable(label);
          setRegisterAvailable(available);
          if (available) {
            const { eth } = await fetchRegistrationPriceEth(label);
            setRegisterPrice(eth);
          } else {
            setRegisterPrice(null);
          }
        } catch (e) {
          setRegisterAvailable(null);
          setRegisterPrice(null);
          setRegisterRpcErr(formatEnsLoadError(e));
        }
      })();
    }, 400);

    return () => window.clearTimeout(timer);
  }, [registerLabel, registerStep]);

  useEffect(() => {
    if (commitReadyAt == null || registerStep !== 'waiting') return;

    const tick = () => {
      const left = Math.max(
        0,
        COMMIT_WAIT_SECONDS - Math.floor((Date.now() - commitReadyAt) / 1000),
      );
      setWaitSeconds(left);
      if (left <= 0) setRegisterStep('ready');
    };

    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [commitReadyAt, registerStep]);

  useEffect(() => {
    if (!showRegisterConfirm) return;
    registerConfirmRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [showRegisterConfirm]);

  if (!account || !meta) {
    return <p className="w1337-tools-empty muted">Unlock wallet to manage ENS names.</p>;
  }

  if (isHardwareAccount(meta)) {
    return (
      <p className="w1337-tools-empty muted">
        ENS registration and record updates require signing on Ethereum mainnet. Switch to a local
        key account, or use{' '}
        <ExternalLink href="https://app.ens.domains">app.ens.domains</ExternalLink> with your
        Ledger/Trezor.
      </p>
    );
  }

  async function runGlobal(action: () => Promise<void>, opts?: { register?: boolean }) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    if (opts?.register) {
      setRegisterFeedback(null);
    } else {
      setLastTx(null);
    }
    try {
      await action();
      await reload();
    } catch (e) {
      const message = formatEnsLoadError(e);
      if (opts?.register) {
        setRegisterFeedback({ type: 'error', message });
      } else {
        setErr(message);
      }
      throw e;
    } finally {
      setBusy(false);
    }
  }

  function requestTx(prompt: EnsTxPrompt) {
    setErr(null);
    const isRegister = prompt.anchor === 'register';
    if (needsConfirm) {
      setTxPrompt(prompt);
      return;
    }
    void runGlobal(prompt.run, { register: isRegister });
  }

  function confirmPendingTx() {
    if (!txPrompt) return;
    const run = txPrompt.run;
    const isRegister = txPrompt.anchor === 'register';
    setTxPrompt(null);
    void runGlobal(run, { register: isRegister });
  }

  async function handleCommit() {
    if (!addr) return;
    const label = registerLabel.trim();
    if (!label) throw new Error('Enter a .eth name.');
    setRegisterStep('committing');
    setCommitReadyAt(null);
    try {
      const { txHash, secret } = await commitEthNameRegistration({ label, owner: addr });
      setRegisterSecret(secret);
      setCommitReadyAt(Date.now());
      setWaitSeconds(COMMIT_WAIT_SECONDS);
      setRegisterStep('waiting');
      setRegisterFeedback({
        type: 'info',
        message: `Commit sent — wait ${COMMIT_WAIT_SECONDS}s, then tap Register & pay.`,
        txHash,
      });
    } catch (e) {
      setRegisterStep('idle');
      setCommitReadyAt(null);
      throw e;
    }
  }

  async function handleRegister() {
    if (!addr || !registerSecret) throw new Error('Missing registration secret.');
    const label = registerLabel.trim();
    setRegisterStep('registering');
    try {
      const { wei } = await fetchRegistrationPriceEth(label);
      const txHash = await registerEthName({
        label,
        owner: addr,
        secret: registerSecret,
        rentWei: wei,
      });
      const name = label.endsWith('.eth') ? label : `${label}.eth`;
      setRegisterStep('done');
      setRegisterSecret(null);
      setCommitReadyAt(null);
      setRegisterLabel('');
      setRegisterFeedback({
        type: 'success',
        message: `${name} is yours`,
        txHash,
      });
    } catch (e) {
      setRegisterStep('ready');
      throw e;
    }
  }

  function cancelRegistrationFlow() {
    setRegisterStep('idle');
    setRegisterSecret(null);
    setCommitReadyAt(null);
    setWaitSeconds(COMMIT_WAIT_SECONDS);
    setTxPrompt(null);
    setRegisterFeedback(null);
  }

  const txUrl = lastTx ? transactionExplorerUrl(DEFAULT_CHAIN_ID, lastTx) : undefined;

  return (
    <div className="w1337-ens">
      <div className="w1337-ens-head">
        <p className="muted w1337-ens-intro">
          Manage Ethereum Name Service on <strong>mainnet</strong>. Names load from the{' '}
          <ExternalLink href="https://docs.ens.domains/web/subgraph">ENS subgraph</ExternalLink>
          ; content hash and renewals are read/written on-chain when you open a name.
        </p>
        <RefreshIconButton busy={loading} ariaLabel="Refresh ENS names" onClick={() => void reload()} />
      </div>

      {!theGraphApiKey ? (
        <p className="muted w1337-ens-note">
          Using the public subgraph endpoint. If listing fails, add a free{' '}
          <ExternalLink href="https://thegraph.com/studio/apikeys/">The Graph API key</ExternalLink>{' '}
          in Settings (optional).
        </p>
      ) : null}

      {err ? <p className="error">{err}</p> : null}
      {msg ? <p className="w1337-ens-msg">{msg}</p> : null}
      {txUrl ? (
        <p className="muted w1337-ens-tx">
          Last tx:{' '}
          <ExternalLink href={txUrl}>{lastTx!.slice(0, 10)}…</ExternalLink>
        </p>
      ) : null}

      <section className="w1337-ens-section">
        <div className="w1337-ens-section__head">
          <strong>Your names ({domains.length})</strong>
        </div>
        {loading && domains.length === 0 ? (
          <p className="w1337-tools-empty muted">Loading ENS names…</p>
        ) : domains.length === 0 ? (
          <p className="w1337-tools-empty muted">
            No ENS names found for this address. Register one below or buy at{' '}
            <ExternalLink href="https://app.ens.domains">app.ens.domains</ExternalLink>.
          </p>
        ) : (
          <ul className="w1337-ens-list">
            {domains.map(domain => (
              <DomainRow
                key={domain.name}
                domain={domain}
                busy={busy}
                txPrompt={txPrompt}
                onConfirmTx={confirmPendingTx}
                onCancelTx={() => setTxPrompt(null)}
                onDomainUpdated={updated =>
                  setDomains(prev =>
                    prev.map(row => (row.name === updated.name ? updated : row)),
                  )
                }
                onRenew={name =>
                  requestTx({
                    anchor: `domain:${name}`,
                    title: 'Extend ENS name',
                    detail: `Renew ${name} for 1 year on Ethereum mainnet.`,
                    run: async () => {
                      const { wei, eth } = await fetchRenewPriceEth(name);
                      setMsg(`Renewing ${name} for ~${eth} ETH…`);
                      const txHash = await renewEthName({ label: name, rentWei: wei });
                      setLastTx(txHash);
                      setMsg(`Extended ${name}.`);
                    },
                  })
                }
                onSaveContent={(name, value) =>
                  requestTx({
                    anchor: `domain:${name}`,
                    title: 'Update content hash',
                    detail: `Set decentralized content for ${name} on mainnet.`,
                    run: async () => {
                      const hash = encodeContentHashInput(value);
                      setMsg(`Updating content hash for ${name}…`);
                      const txHash = await setDomainContentHash({ name, contentHash: hash });
                      setLastTx(txHash);
                      setMsg(`Content hash updated for ${name}.`);
                    },
                  })
                }
                onSaveUrl={(name, value) =>
                  requestTx({
                    anchor: `domain:${name}`,
                    title: 'Update URL record',
                    detail: `Set url text record for ${name} on mainnet.`,
                    run: async () => {
                      setMsg(`Updating URL for ${name}…`);
                      const txHash = await setDomainUrlText({ name, url: value });
                      setLastTx(txHash);
                      setMsg(`URL updated for ${name}.`);
                    },
                  })
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section className="w1337-ens-section w1337-ens-register">
        <strong>Register a .eth name</strong>
        <p className="muted w1337-ens-row__hint">
          Commit → wait {COMMIT_WAIT_SECONDS}s → register (standard ENS controller flow).
          {needsConfirm
            ? ' Confirm mode asks you to review each mainnet transaction here.'
            : ' Instant mode signs immediately.'}
          {' '}
          Refreshing the wallet restarts an in-progress registration — commit again to retry.
        </p>
        <label htmlFor="ens-register-label">Name</label>
        <div className="w1337-ens-register__input">
          <input
            id="ens-register-label"
            value={registerLabel}
            disabled={busy || registerStep === 'committing' || registerStep === 'registering'}
            placeholder="myname"
            onChange={e => {
              setRegisterLabel(e.target.value);
              if (registerStep === 'done' || registerStep === 'waiting' || registerStep === 'ready') {
                cancelRegistrationFlow();
              }
            }}
          />
          <span className="muted">.eth</span>
        </div>
        {registerAvailable === true && registerPrice ? (
          <p className="muted">Available · ~{registerPrice} ETH / year</p>
        ) : registerAvailable === false ? (
          <p className="error">Not available</p>
        ) : registerRpcErr ? (
          <p className="error">{registerRpcErr}</p>
        ) : null}

        <div className="w1337-ens-register__actions">
          {registerStep === 'idle' || registerStep === 'done' ? (
            <button
              type="button"
              className="primary"
              disabled={busy || !registerLabel.trim() || registerAvailable !== true || !!txPrompt}
              onClick={() =>
                requestTx({
                  anchor: 'register',
                  title: 'Commit registration',
                  detail: `Commit ${registerLabel.trim()}.eth on Ethereum mainnet (step 1 of 2). No ETH fee beyond gas.`,
                  run: handleCommit,
                })
              }
            >
              {busy ? 'Signing…' : '1. Commit'}
            </button>
          ) : null}
          {registerStep === 'waiting' ? (
            <p className="muted">
              Commit confirmed — waiting {waitSeconds}s before you can register…
            </p>
          ) : null}
          {registerStep === 'ready' || registerStep === 'registering' ? (
            <>
              {registerStep === 'ready' ? (
                <p className="muted">Commit wait complete — register and pay to finish.</p>
              ) : (
                <p className="muted">Signing registration on Ethereum mainnet…</p>
              )}
              <button
                type="button"
                className="primary"
                disabled={busy || registerStep === 'registering' || !!txPrompt}
                onClick={() =>
                  requestTx({
                    anchor: 'register',
                    title: 'Register name',
                    detail: `Register ${registerLabel.trim()}.eth and pay ~${registerPrice ?? '?'} ETH for 1 year.`,
                    run: handleRegister,
                  })
                }
              >
                2. Register & pay
              </button>
            </>
          ) : null}
          {registerStep === 'committing' ? (
            <p className="muted">Signing commit on Ethereum mainnet…</p>
          ) : null}
          {showRegisterConfirm && txPrompt ? (
            <EnsTxConfirm
              prompt={txPrompt}
              confirmRef={registerConfirmRef}
              onCancel={() => setTxPrompt(null)}
              onConfirm={confirmPendingTx}
            />
          ) : null}
          {registerFeedback ? <EnsRegisterFeedback feedback={registerFeedback} /> : null}
        </div>
      </section>
    </div>
  );
}
