import { useState } from 'react';
import { getAddress } from 'viem';
import { getUnlockedAccount } from '../lib/accountSession';
import { chainById } from '../lib/chainCatalog';
import { runInspect, type InspectResult } from '../lib/inspectLookup';
import { effectiveActiveChainId, type AppSettings } from '../lib/storageState';
import { describeError } from '../lib/utils';

function shortAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function PeekRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (value == null || value === '') return null;
  return (
    <div className="w1337-inspect__row">
      <span className="w1337-inspect__label muted">{label}</span>
      <span className={mono ? 'w1337-inspect__mono' : undefined}>{value}</span>
    </div>
  );
}

function ResultCard({
  result,
  chainId,
  onFollowAddress,
}: {
  result: InspectResult;
  chainId: number;
  onFollowAddress: (address: string) => void;
}) {
  if (result.kind === 'unknown') {
    return (
      <p className="w1337-tools-empty muted">
        Paste a wallet or contract address, a .eth name, or a transaction hash.
      </p>
    );
  }

  if (result.kind === 'ens') {
    return (
      <div className="w1337-inspect__card">
        <p className="w1337-inspect__kicker">ENS name</p>
        <h3 className="w1337-inspect__title">{result.name}</h3>
        {result.address ? (
          <>
            <PeekRow label="Address" value={result.address} mono />
            <button
              type="button"
              className="ghost w1337-inspect__follow"
              onClick={() => onFollowAddress(result.address!)}
            >
              Inspect address
            </button>
          </>
        ) : (
          <p className="muted">No address found for this name on mainnet.</p>
        )}
      </div>
    );
  }

  if (result.kind === 'tx') {
    return (
      <div className="w1337-inspect__card">
        <p className="w1337-inspect__kicker">Transaction</p>
        <h3 className="w1337-inspect__title">{result.headline ?? shortAddress(result.hash)}</h3>
        {!result.found ? (
          <p className="muted">Not found on the current network. Try another chain or open the explorer.</p>
        ) : (
          <>
            <PeekRow label="From" value={result.from} mono />
            <PeekRow label="To" value={result.to ?? undefined} mono />
            <PeekRow label="Value" value={result.valueLabel} />
            <PeekRow label="Selector" value={result.selector} mono />
          </>
        )}
        {result.explorerUrl ? (
          <a
            className="w1337-inspect__link"
            href={result.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open on explorer
          </a>
        ) : null}
      </div>
    );
  }

  const token = result.token;
  return (
    <div className="w1337-inspect__card">
      <p className="w1337-inspect__kicker">
        {token ? 'Token' : result.isContract ? 'Contract' : 'Wallet'}
      </p>
      <h3 className="w1337-inspect__title">
        {token?.symbol || token?.name || result.ensName || shortAddress(result.address)}
      </h3>
      <PeekRow label="Address" value={result.address} mono />
      <PeekRow label="ENS" value={result.ensName} />
      <PeekRow label="Type" value={result.isContract ? 'Contract' : 'EOA'} />
      <PeekRow label="Nonce" value={String(result.nonce)} />
      <PeekRow label="Native balance" value={result.nativeLabel} />
      {token ? (
        <>
          <PeekRow label="Name" value={token.name} />
          <PeekRow label="Decimals" value={String(token.decimals)} />
          <PeekRow label="Total supply" value={token.totalSupply} />
          <PeekRow label="Your balance" value={token.userBalance} />
        </>
      ) : null}
      {result.explorerUrl ? (
        <a
          className="w1337-inspect__link"
          href={result.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open on explorer
        </a>
      ) : null}
      <p className="muted w1337-inspect__hint">
        Current network · {chainById(chainId)?.name ?? chainId}
      </p>
    </div>
  );
}

export function InspectView({ settings }: { settings: AppSettings }) {
  const account = getUnlockedAccount();
  const chainId = effectiveActiveChainId(settings);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<InspectResult | null>(null);

  async function run(raw: string) {
    const value = raw.trim();
    if (!value) return;
    setBusy(true);
    setErr(null);
    try {
      const { result: next } = await runInspect(value, chainId);
      setResult(next);
      if (next.kind === 'address') setQuery(next.address);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w1337-inspect">
      <p className="w1337-inspect__lead muted">
        Paste an address, token, ENS name, or transaction hash. This is a peek before you send or
        approve — not a full explorer.
      </p>
      <form
        className="w1337-inspect__form"
        onSubmit={e => {
          e.preventDefault();
          void run(query);
        }}
      >
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="0x… or name.eth"
          autoComplete="off"
          spellCheck={false}
          aria-label="Inspect input"
          data-testid="inspect-input"
        />
        <button
          type="submit"
          className="primary"
          disabled={busy || !query.trim()}
          data-testid="inspect-submit"
        >
          {busy ? '…' : 'Inspect'}
        </button>
      </form>
      {account ? (
        <button
          type="button"
          className="ghost w1337-inspect__mine"
          onClick={() => void run(getAddress(account.address))}
        >
          Inspect my address
        </button>
      ) : null}
      {err ? <p className="error">{err}</p> : null}
      {result ? (
        <ResultCard
          result={result}
          chainId={chainId}
          onFollowAddress={addr => void run(addr)}
        />
      ) : null}
    </div>
  );
}
