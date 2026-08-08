import { useCallback, useEffect, useState } from 'react';
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
import { transactionExplorerUrl } from '../lib/explorerUrls';
import type { AppSettings } from '../lib/storageState';
import { RefreshIconButton } from './RefreshIconButton';

type RegisterStep = 'idle' | 'committing' | 'waiting' | 'registering' | 'done';

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  );
}

function DomainRow({
  domain,
  busy,
  onRenew,
  onSaveContent,
  onSaveUrl,
}: {
  domain: EnsDomainRecord;
  busy: boolean;
  onRenew: (name: string) => Promise<void>;
  onSaveContent: (name: string, value: string) => Promise<void>;
  onSaveUrl: (name: string, value: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [contentDraft, setContentDraft] = useState(domain.contentHash.uri ?? '');
  const [urlDraft, setUrlDraft] = useState(domain.urlText ?? '');
  const [rowErr, setRowErr] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState(false);

  const gateway = contentHashGatewayUrl(domain.contentHash);
  const expiring = ensNameExpiresSoon(domain.expiryDate);

  useEffect(() => {
    setContentDraft(domain.contentHash.uri ?? '');
    setUrlDraft(domain.urlText ?? '');
  }, [domain.contentHash.uri, domain.urlText, domain.name]);

  async function run(action: () => Promise<void>) {
    setRowErr(null);
    setRowBusy(true);
    try {
      await action();
    } catch (e) {
      setRowErr(describeError(e));
    } finally {
      setRowBusy(false);
    }
  }

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

          <div className="w1337-ens-row__field">
            <label htmlFor={`content-${domain.name}`}>Content hash</label>
            <input
              id={`content-${domain.name}`}
              value={contentDraft}
              disabled={busy || rowBusy}
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
              disabled={busy || rowBusy || !contentDraft.trim()}
              onClick={() =>
                void run(async () => {
                  await onSaveContent(domain.name, contentDraft);
                })
              }
            >
              Save content hash
            </button>
          </div>

          <div className="w1337-ens-row__field">
            <label htmlFor={`url-${domain.name}`}>URL text record</label>
            <input
              id={`url-${domain.name}`}
              value={urlDraft}
              disabled={busy || rowBusy}
              placeholder="https://…"
              onChange={e => setUrlDraft(e.target.value)}
            />
            <p className="muted w1337-ens-row__hint">
              Optional classic website link (text record <code>url</code>).
            </p>
            <button
              type="button"
              className="ghost"
              disabled={busy || rowBusy || !urlDraft.trim()}
              onClick={() =>
                void run(async () => {
                  await onSaveUrl(domain.name, urlDraft);
                })
              }
            >
              Save URL
            </button>
          </div>

          {domain.canRenew ? (
            <button
              type="button"
              className="primary"
              disabled={busy || rowBusy}
              onClick={() => void run(async () => onRenew(domain.name))}
            >
              Extend 1 year
            </button>
          ) : null}

          {rowErr ? <p className="error">{rowErr}</p> : null}
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
  const [waitSeconds, setWaitSeconds] = useState(COMMIT_WAIT_SECONDS);

  const reload = useCallback(async () => {
    if (!addr) return;
    setLoading(true);
    setErr(null);
    try {
      const rows = await fetchEnsPortfolio(addr, { theGraphApiKey });
      setDomains(rows);
    } catch (e) {
      setErr(describeError(e));
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
    if (!label || registerStep !== 'idle') {
      setRegisterAvailable(null);
      setRegisterPrice(null);
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const available = await checkEthNameAvailable(label);
          setRegisterAvailable(available);
          if (available) {
            const { eth } = await fetchRegistrationPriceEth(label);
            setRegisterPrice(eth);
          } else {
            setRegisterPrice(null);
          }
        } catch {
          setRegisterAvailable(null);
          setRegisterPrice(null);
        }
      })();
    }, 400);

    return () => window.clearTimeout(timer);
  }, [registerLabel, registerStep]);

  useEffect(() => {
    if (registerStep !== 'waiting') return;
    setWaitSeconds(COMMIT_WAIT_SECONDS);
    const started = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      const left = Math.max(0, COMMIT_WAIT_SECONDS - elapsed);
      setWaitSeconds(left);
      if (left <= 0) window.clearInterval(id);
    }, 500);
    return () => window.clearInterval(id);
  }, [registerStep]);

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

  async function runGlobal(action: () => Promise<void>) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    setLastTx(null);
    try {
      await action();
      await reload();
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleCommit() {
    if (!addr) return;
    const label = registerLabel.trim();
    if (!label) throw new Error('Enter a .eth name.');
    setRegisterStep('committing');
    try {
      const { txHash, secret } = await commitEthNameRegistration({ label, owner: addr });
      setRegisterSecret(secret);
      setLastTx(txHash);
      setRegisterStep('waiting');
      setMsg(`Commit sent. Wait ${COMMIT_WAIT_SECONDS}s, then complete registration.`);
    } catch (e) {
      setRegisterStep('idle');
      throw e;
    }
  }

  async function handleRegister() {
    if (!addr || !registerSecret) throw new Error('Missing registration secret.');
    const label = registerLabel.trim();
    setRegisterStep('registering');
    const { wei } = await fetchRegistrationPriceEth(label);
    const txHash = await registerEthName({
      label,
      owner: addr,
      secret: registerSecret,
      rentWei: wei,
    });
    setLastTx(txHash);
    setRegisterStep('done');
    setRegisterSecret(null);
    setRegisterLabel('');
    setMsg(`Registered ${label.endsWith('.eth') ? label : `${label}.eth`}!`);
  }

  const txUrl = lastTx ? transactionExplorerUrl(DEFAULT_CHAIN_ID, lastTx) : undefined;

  return (
    <div className="w1337-ens">
      <div className="w1337-ens-head">
        <p className="muted w1337-ens-intro">
          Manage Ethereum Name Service on <strong>mainnet</strong>. Names are discovered via the{' '}
          <ExternalLink href="https://docs.ens.domains/web/subgraph">ENS subgraph</ExternalLink>{' '}
          (indexed on-chain events); content hash and renewals are read/written directly on-chain.
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
                onRenew={name =>
                  runGlobal(async () => {
                    const { wei, eth } = await fetchRenewPriceEth(name);
                    setMsg(`Renewing ${name} for ~${eth} ETH…`);
                    const txHash = await renewEthName({ label: name, rentWei: wei });
                    setLastTx(txHash);
                    setMsg(`Extended ${name}.`);
                  })
                }
                onSaveContent={(name, value) =>
                  runGlobal(async () => {
                    const hash = encodeContentHashInput(value);
                    setMsg(`Updating content hash for ${name}…`);
                    const txHash = await setDomainContentHash({ name, contentHash: hash });
                    setLastTx(txHash);
                    setMsg(`Content hash updated for ${name}.`);
                  })
                }
                onSaveUrl={(name, value) =>
                  runGlobal(async () => {
                    setMsg(`Updating URL for ${name}…`);
                    const txHash = await setDomainUrlText({ name, url: value });
                    setLastTx(txHash);
                    setMsg(`URL updated for ${name}.`);
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
              if (registerStep === 'done') setRegisterStep('idle');
            }}
          />
          <span className="muted">.eth</span>
        </div>
        {registerAvailable === true && registerPrice ? (
          <p className="muted">Available · ~{registerPrice} ETH / year</p>
        ) : registerAvailable === false ? (
          <p className="error">Not available</p>
        ) : null}

        <div className="w1337-ens-register__actions">
          {registerStep === 'idle' || registerStep === 'done' ? (
            <button
              type="button"
              className="primary"
              disabled={busy || !registerLabel.trim() || registerAvailable !== true}
              onClick={() => void runGlobal(handleCommit)}
            >
              {busy ? 'Working…' : '1. Commit'}
            </button>
          ) : null}
          {registerStep === 'waiting' ? (
            <>
              <p className="muted">
                Waiting {waitSeconds}s before register…
              </p>
              <button
                type="button"
                className="primary"
                disabled={busy || waitSeconds > 0}
                onClick={() => void runGlobal(handleRegister)}
              >
                2. Register & pay
              </button>
            </>
          ) : null}
          {registerStep === 'committing' || registerStep === 'registering' ? (
            <p className="muted">Confirm in wallet…</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
