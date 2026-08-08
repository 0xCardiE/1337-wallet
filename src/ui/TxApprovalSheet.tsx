import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAddress } from 'viem';
import {
  applyGasOverrides,
  computeAutoGasEstimate,
  computeDisplayFeeEstimate,
  formatFeeEstimate,
  gweiToInput,
  type GasOverrideInput,
  validateGasOverrides,
} from '../lib/gasOverrides';
import { getActiveAccountMeta, getUnlockedAccount } from '../lib/accountSession';
import { isHardwareAccount } from '../lib/accounts';
import {
  approvalTitle,
  buildApprovalDetailSections,
  mergeFunctionSignatureLookup,
  mergeGasPreview,
  needsFunctionSignatureLookup,
  resolveLikelyFunctionSignature,
  selectorFromData,
  txContractAddress,
  type ApprovalDetailField,
  type ApprovalDetailSection,
  type FunctionSignatureLookup,
  type TxGasPreview,
} from '../lib/approvalDetails';
import { fetchFunctionSourceFromExplorer, type FunctionSourceResult } from '../lib/explorerContractSource';
import { lookupFunctionSelectors } from '../lib/fourByteDirectory';
import { addressExplorerLink } from '../lib/tokenApprovals';
import { chainById } from '../lib/chainCatalog';
import { chainJsonRpcCall } from '../lib/ethereum';
import { executeHardwareSignRequest } from '../lib/hardwareSign';
import type { AppSettings } from '../lib/storageState';
import {
  completePendingApproval,
  fetchPendingApprovals,
  resolvePendingApproval,
} from '../lib/approvalBridge';
import type { PendingApproval } from '../lib/pendingApprovals';

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }

  return (
    <button type="button" className="w1337-tx-approval__copy" onClick={() => void onCopy()}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function DetailField({ f }: { f: ApprovalDetailField }) {
  return (
    <div className={`w1337-tx-approval__field${f.warn ? ' w1337-tx-approval__field--warn' : ''}`}>
      <dt>{f.label}</dt>
      <dd className={f.mono ? 'w1337-tx-approval__mono' : undefined}>
        <span className="w1337-tx-approval__value">{f.value}</span>
        {f.copyable ? <CopyBtn text={f.value} /> : null}
      </dd>
    </div>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" />
      <polyline points="15 3 21 3 21 9" strokeLinecap="round" />
      <line x1="10" y1="14" x2="21" y2="3" strokeLinecap="round" />
    </svg>
  );
}

function explorerLabel(chainId: number): string {
  const url = chainById(chainId)?.blockExplorerUrls[0] ?? '';
  try {
    const host = new URL(url).hostname;
    if (host.includes('etherscan')) return 'Etherscan';
    if (host.includes('basescan')) return 'Basescan';
    if (host.includes('arbiscan')) return 'Arbiscan';
    if (host.includes('polygonscan')) return 'Polygonscan';
    if (host.includes('bscscan')) return 'BscScan';
    return host.replace(/^www\./, '').split('.')[0] ?? 'Explorer';
  } catch {
    return 'Explorer';
  }
}

function FunctionSourceBlock({
  chainId,
  contractAddress,
  functionSignature,
  explorerApiKey,
}: {
  chainId: number;
  contractAddress: `0x${string}`;
  functionSignature: string;
  explorerApiKey?: string;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<FunctionSourceResult | null>(null);

  useEffect(() => {
    setResult(null);
    let cancelled = false;
    void fetchFunctionSourceFromExplorer({
      chainId,
      contractAddress,
      functionSignature,
      explorerApiKey,
    }).then(r => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [chainId, contractAddress, functionSignature, explorerApiKey]);

  const explorerName = explorerLabel(chainId);
  const contractUrl = addressExplorerLink(chainId, contractAddress);

  return (
    <div className="w1337-tx-approval__fn-source">
      <button
        type="button"
        className="w1337-tx-approval__fn-source-head"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <span className="w1337-tx-approval__fn-source-title">
          Function source
          <span className="w1337-tx-approval__chev" aria-hidden>
            {open ? '▾' : '▸'}
          </span>
        </span>
        {contractUrl ? (
          <span className="w1337-tx-approval__fn-source-actions">
            <a
              className="w1337-tx-approval__fn-source-link"
              href={contractUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
            >
              {explorerName}
              <ExternalLinkIcon />
            </a>
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="w1337-tx-approval__fn-source-body">
          {!result ? (
            <p className="w1337-tx-approval__fn-source-meta muted">Loading verified source…</p>
          ) : result.functionSource ? (
            <>
              {result.contractName ? (
                <p className="w1337-tx-approval__fn-source-meta muted">
                  {result.contractName}
                  {result.sourceFileHint ? ` · ${result.sourceFileHint.replace('// File: ', '')}` : ''}
                </p>
              ) : null}
              <pre className="w1337-tx-approval__fn-source-pre">{result.functionSource}</pre>
            </>
          ) : (
            <p className="w1337-tx-approval__fn-source-meta muted">{result.error ?? 'Source unavailable.'}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function OverviewSection({
  section,
  chainId,
  functionSignature,
  contractAddress,
  explorerApiKey,
}: {
  section: ApprovalDetailSection;
  chainId: number;
  functionSignature?: string;
  contractAddress?: `0x${string}`;
  explorerApiKey?: string;
}) {
  const [open, setOpen] = useState(section.defaultOpen ?? false);
  const likelyIdx = section.fields.findIndex(f => f.label === 'Likely function');
  const showSource = likelyIdx !== -1 && !!functionSignature && !!contractAddress;

  return (
    <section className="w1337-tx-approval__section">
      <button
        type="button"
        className="w1337-tx-approval__section-head"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <span>{section.title}</span>
        <span className="w1337-tx-approval__chev" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? (
        showSource ? (
          <>
            <dl className="w1337-tx-approval__fields">
              {section.fields.slice(0, likelyIdx + 1).map(field => (
                <DetailField key={`${section.id}-${field.label}`} f={field} />
              ))}
            </dl>
            <FunctionSourceBlock
              chainId={chainId}
              contractAddress={contractAddress}
              functionSignature={functionSignature}
              explorerApiKey={explorerApiKey}
            />
          </>
        ) : (
          <dl className="w1337-tx-approval__fields">
            {section.fields.map(field => (
              <DetailField key={`${section.id}-${field.label}`} f={field} />
            ))}
          </dl>
        )
      ) : null}
    </section>
  );
}

function DetailSection({ section }: { section: ApprovalDetailSection }) {
  const [open, setOpen] = useState(section.defaultOpen ?? false);

  return (
    <section className="w1337-tx-approval__section">
      <button
        type="button"
        className="w1337-tx-approval__section-head"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <span>{section.title}</span>
        <span className="w1337-tx-approval__chev" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? (
        <dl className="w1337-tx-approval__fields">
          {section.fields.map(field => (
            <DetailField key={`${section.id}-${field.label}`} f={field} />
          ))}
        </dl>
      ) : null}
    </section>
  );
}

async function fetchTxGasPreview(
  chainId: number,
  tx: Record<string, unknown>,
  from: string,
): Promise<TxGasPreview> {
  const preview: TxGasPreview = {};
  try {
    preview.pendingNonce = String(
      Number.parseInt(
        await chainJsonRpcCall<string>(chainId, 'eth_getTransactionCount', [from, 'pending']),
        16,
      ),
    );
  } catch (e) {
    preview.error = e instanceof Error ? e.message : String(e);
  }

  try {
    const to = typeof tx.to === 'string' ? tx.to : undefined;
    const data = typeof tx.data === 'string' ? tx.data : '0x';
    const value = typeof tx.value === 'string' ? tx.value : '0x0';
    const gasHex = await chainJsonRpcCall<string>(chainId, 'eth_estimateGas', [
      { from, to, data, value },
    ]);
    preview.estimatedGas = String(Number.parseInt(gasHex, 16));
  } catch (e) {
    if (!preview.error) {
      preview.error = e instanceof Error ? e.message : String(e);
    }
  }

  try {
    const gasPriceHex = await chainJsonRpcCall<string>(chainId, 'eth_gasPrice', []);
    preview.suggestedGasPrice = String(BigInt(gasPriceHex));
  } catch {
    /* optional */
  }

  if (typeof tx.to === 'string' && tx.to.startsWith('0x')) {
    try {
      const code = await chainJsonRpcCall<string>(chainId, 'eth_getCode', [tx.to, 'latest']);
      preview.isContract = code !== '0x' && code !== '0x0';
    } catch {
      /* optional */
    }
  }

  return preview;
}

const DEFAULT_GAS_OVERRIDES: GasOverrideInput = { mode: 'auto' };

const GAS_FIELD_TIPS = {
  maxFee:
    'The most you will pay per unit of gas. Actual fee is usually lower; any unused amount is refunded.',
  priorityFee:
    'A tip to validators for faster inclusion. Raise it if the transaction is stuck in the mempool.',
  gasLimit:
    'Maximum computation units for this transaction. Too low and it reverts; you only pay for gas actually used.',
} as const;

function GasFieldLabel({ label, tip }: { label: string; tip: string }) {
  return (
    <span className="w1337-tx-approval__gas-fee-field-label">
      {label}
      <button
        type="button"
        className="w1337-tx-approval__gas-tip"
        aria-label={`About ${label}`}
        data-tip={tip}
      >
        ?
      </button>
    </span>
  );
}

function GasFeeBar({
  pending,
  gasPreview,
  overrides,
  onOverridesChange,
}: {
  pending: PendingApproval;
  gasPreview: TxGasPreview | null;
  overrides: GasOverrideInput;
  onOverridesChange: (next: GasOverrideInput) => void;
}) {
  const tx = (pending.request.params?.[0] ?? {}) as Record<string, unknown>;
  const chain = chainById(pending.chainId);
  const symbol = chain?.nativeCurrency.symbol ?? 'ETH';
  const isCustom = overrides.mode === 'custom';

  const autoEstimate = useMemo(
    () => computeAutoGasEstimate(tx, gasPreview),
    [tx, gasPreview],
  );

  const displayEstimate = useMemo(
    () => computeDisplayFeeEstimate(overrides, autoEstimate),
    [overrides, autoEstimate],
  );

  const validationErr = useMemo(() => validateGasOverrides(overrides), [overrides]);

  function toggleCustom() {
    if (isCustom) {
      onOverridesChange({ mode: 'auto' });
      return;
    }
    if (!autoEstimate) return;
    onOverridesChange({
      mode: 'custom',
      maxFeeGwei: gweiToInput(autoEstimate.maxFeePerGas),
      maxPriorityGwei: gweiToInput(autoEstimate.maxPriorityFeePerGas),
      gasLimit: autoEstimate.gasLimitBuffered.toString(),
    });
  }

  const feeLabel = displayEstimate
    ? formatFeeEstimate(displayEstimate.totalWei, symbol)
    : gasPreview?.error
      ? 'Estimate unavailable'
      : 'Estimating…';

  const modeLabel = isCustom ? 'Custom' : 'Auto';

  return (
    <div className="w1337-tx-approval__gas-fee">
      <div className="w1337-tx-approval__gas-fee-row">
        <span className="w1337-tx-approval__gas-fee-label">Network fee</span>
        <span className="w1337-tx-approval__gas-fee-value">
          {feeLabel} · {modeLabel}
        </span>
        <button
          type="button"
          className={`w1337-tx-approval__gas-fee-custom${isCustom ? ' w1337-tx-approval__gas-fee-custom--active' : ''}`}
          aria-pressed={isCustom}
          onClick={() => toggleCustom()}
        >
          Custom
        </button>
      </div>

      {isCustom ? (
        <div className="w1337-tx-approval__gas-fee-panel">
          <label className="w1337-tx-approval__gas-fee-field">
            <GasFieldLabel label="Max fee (gwei)" tip={GAS_FIELD_TIPS.maxFee} />
            <input
              type="text"
              inputMode="decimal"
              value={overrides.maxFeeGwei ?? ''}
              onChange={e =>
                onOverridesChange({ ...overrides, maxFeeGwei: e.target.value })
              }
              placeholder={autoEstimate ? gweiToInput(autoEstimate.maxFeePerGas) : ''}
            />
          </label>
          <label className="w1337-tx-approval__gas-fee-field">
            <GasFieldLabel label="Priority fee (gwei)" tip={GAS_FIELD_TIPS.priorityFee} />
            <input
              type="text"
              inputMode="decimal"
              value={overrides.maxPriorityGwei ?? ''}
              onChange={e =>
                onOverridesChange({ ...overrides, maxPriorityGwei: e.target.value })
              }
              placeholder={
                autoEstimate ? gweiToInput(autoEstimate.maxPriorityFeePerGas) : ''
              }
            />
          </label>
          <label className="w1337-tx-approval__gas-fee-field">
            <GasFieldLabel label="Gas limit" tip={GAS_FIELD_TIPS.gasLimit} />
            <input
              type="text"
              inputMode="numeric"
              value={overrides.gasLimit ?? ''}
              onChange={e =>
                onOverridesChange({ ...overrides, gasLimit: e.target.value })
              }
              placeholder={autoEstimate?.gasLimitBuffered.toString()}
            />
          </label>

          {validationErr ? <p className="error w1337-tx-approval__gas-fee-err">{validationErr}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function ApprovalContent({
  pending,
  settings,
  gasOverrides,
  onGasOverridesChange,
}: {
  pending: PendingApproval;
  settings: AppSettings;
  gasOverrides: GasOverrideInput;
  onGasOverridesChange: (next: GasOverrideInput) => void;
}) {
  const account = getUnlockedAccount();
  const walletAddress = account ? getAddress(account.address) : undefined;
  const chain = chainById(pending.chainId);
  const [gasPreview, setGasPreview] = useState<TxGasPreview | null>(null);
  const [sigLookup, setSigLookup] = useState<FunctionSignatureLookup | null>(null);
  const explorerApiKey = settings.explorerApiKey?.trim();

  const sections = useMemo(() => {
    let built = buildApprovalDetailSections(
      pending.request,
      pending.chainId,
      walletAddress,
    );
    if (gasPreview) {
      built = mergeGasPreview(built, gasPreview, pending.chainId);
    }
    if (sigLookup) {
      built = mergeFunctionSignatureLookup(built, sigLookup);
    }
    return built;
  }, [pending.request, pending.chainId, walletAddress, gasPreview, sigLookup]);

  const functionSignature = useMemo(
    () => resolveLikelyFunctionSignature(pending.request, sigLookup),
    [pending.request, sigLookup],
  );
  const contractAddress = useMemo(
    () => txContractAddress(pending.request),
    [pending.request],
  );
  const canShowSource = !!functionSignature && !!contractAddress;

  const gasFetchedForRef = useRef<string | null>(null);
  const sigLookupKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (pending.request.method !== 'eth_sendTransaction' || !walletAddress) {
      setGasPreview(null);
      gasFetchedForRef.current = null;
      return;
    }
    if (gasFetchedForRef.current === pending.id) return;

    gasFetchedForRef.current = pending.id;
    const tx = (pending.request.params?.[0] ?? {}) as Record<string, unknown>;
    let cancelled = false;
    void fetchTxGasPreview(pending.chainId, tx, walletAddress).then(p => {
      if (!cancelled) setGasPreview(p);
    });
    return () => {
      cancelled = true;
    };
  }, [pending.id, pending.chainId, pending.request, walletAddress]);

  useEffect(() => {
    if (!needsFunctionSignatureLookup(pending.request)) {
      setSigLookup(null);
      sigLookupKeyRef.current = null;
      return;
    }
    const tx = (pending.request.params?.[0] ?? {}) as Record<string, unknown>;
    const data = typeof tx.data === 'string' ? tx.data : undefined;
    const selector = data ? selectorFromData(data) : undefined;
    if (!selector) {
      setSigLookup(null);
      sigLookupKeyRef.current = null;
      return;
    }

    const lookupKey = `${pending.id}:${selector}`;
    if (sigLookupKeyRef.current === lookupKey) return;

    sigLookupKeyRef.current = lookupKey;
    setSigLookup({ status: 'loading' });
    let cancelled = false;
    void lookupFunctionSelectors(selector).then(signatures => {
      if (!cancelled) setSigLookup({ status: 'done', signatures });
    });
    return () => {
      cancelled = true;
    };
  }, [pending.id, pending.request]);

  const hostname = pending.summary.hostname;

  return (
    <>
      <div className="w1337-tx-approval__body">
        {hostname ? (
          <p className="w1337-tx-approval__site">
            Request from <strong>{hostname}</strong>
            {pending.origin ? (
              <span className="w1337-tx-approval__origin muted"> · {pending.origin}</span>
            ) : null}
          </p>
        ) : null}
        {chain ? (
          <p className="w1337-tx-approval__chain muted">
            Network · {chain.name} (chainId {pending.chainId})
          </p>
        ) : null}

        {pending.request.method === 'eth_sendTransaction' ? (
          <GasFeeBar
            pending={pending}
            gasPreview={gasPreview}
            overrides={gasOverrides}
            onOverridesChange={onGasOverridesChange}
          />
        ) : null}

        <p className="w1337-tx-approval__dev-note muted">
          Developer view — inspect gas, calldata, and raw RPC params before signing.
        </p>

        <div className="w1337-tx-approval__sections">
          {sections.map(section =>
            section.id === 'tx-overview' ? (
              <OverviewSection
                key={section.id}
                section={section}
                chainId={pending.chainId}
                functionSignature={canShowSource ? functionSignature : undefined}
                contractAddress={canShowSource ? contractAddress : undefined}
                explorerApiKey={explorerApiKey}
              />
            ) : (
              <DetailSection key={section.id} section={section} />
            ),
          )}
        </div>
      </div>
    </>
  );
}

export function TxApprovalSheet({ settings }: { settings: AppSettings }) {
  const [pending, setPending] = useState<PendingApproval | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [gasOverrides, setGasOverrides] = useState<GasOverrideInput>(DEFAULT_GAS_OVERRIDES);

  const refresh = useCallback(async () => {
    const list = await fetchPendingApprovals();
    const next = list[0] ?? null;
    setPending(prev => {
      if (next == null) return null;
      if (prev?.id === next.id) return prev;
      return next;
    });
  }, []);

  useEffect(() => {
    void refresh();
    const intervalMs = pending ? 5000 : 800;
    const id = window.setInterval(() => void refresh(), intervalMs);
    return () => window.clearInterval(id);
  }, [pending?.id, refresh]);

  useEffect(() => {
    setGasOverrides(DEFAULT_GAS_OVERRIDES);
  }, [pending?.id]);

  const gasValidationErr = useMemo(
    () => validateGasOverrides(gasOverrides),
    [gasOverrides],
  );

  if (!pending) return null;

  const title = approvalTitle(pending.request);
  const confirmBlocked =
    pending.request.method === 'eth_sendTransaction' &&
    gasOverrides.mode === 'custom' &&
    !!gasValidationErr;

  async function onDecision(approved: boolean) {
    if (!pending || busy) return;
    if (approved && confirmBlocked) {
      setErr(gasValidationErr);
      return;
    }
    setBusy(true);
    setErr(null);

    const meta = getActiveAccountMeta();
    const hw = meta && isHardwareAccount(meta);

    if (!approved) {
      const res = await resolvePendingApproval(pending.id, false);
      setBusy(false);
      if (!res.ok) {
        setErr(res.error ?? 'Could not resolve request');
        setPending(null);
        return;
      }
      await refresh();
      return;
    }

    if (hw) {
      try {
        const result = await executeHardwareSignRequest({
          account: meta,
          chainId: pending.chainId,
          method: pending.request.method,
          requestParams: pending.request.params ?? [],
          gasOverrides:
            pending.request.method === 'eth_sendTransaction' ? gasOverrides : undefined,
        });
        const res = await completePendingApproval(pending.id, result);
        setBusy(false);
        if (!res.ok) {
          setErr(res.error ?? 'Could not complete request');
          setPending(null);
          return;
        }
        await refresh();
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await completePendingApproval(pending.id, undefined, msg);
        setBusy(false);
        setErr(msg);
        setPending(null);
        return;
      }
    }

    const res = await resolvePendingApproval(
      pending.id,
      true,
      pending.request.method === 'eth_sendTransaction' ? gasOverrides : undefined,
    );
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? 'Could not resolve request');
      setPending(null);
      return;
    }
    await refresh();
  }

  return (
    <div className="w1337-sheet-mount w1337-tx-approval">
      <div className="w1337-sheet-backdrop" aria-hidden />
      <div
        className="w1337-sheet-panel w1337-tx-approval__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tx-approval-title"
      >
        <div className="w1337-sheet-head">
          <h2 id="tx-approval-title" className="w1337-sheet-h2">
            {title}
          </h2>
        </div>

        <ApprovalContent
          key={pending.id}
          pending={pending}
          settings={settings}
          gasOverrides={gasOverrides}
          onGasOverridesChange={setGasOverrides}
        />

        {err ? <p className="error w1337-tx-approval__err">{err}</p> : null}

        <div className="w1337-tx-approval__actions">
          <button
            type="button"
            className="w1337-tx-approval__reject"
            disabled={busy}
            onClick={() => void onDecision(false)}
          >
            Reject
          </button>
          <button
            type="button"
            className="w1337-tx-approval__approve"
            disabled={busy || confirmBlocked}
            onClick={() => void onDecision(true)}
          >
            {busy
              ? 'Confirming…'
              : getActiveAccountMeta() && isHardwareAccount(getActiveAccountMeta())
                ? `Confirm on ${getActiveAccountMeta()?.kind === 'ledger' ? 'Ledger' : 'Trezor'}`
                : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
