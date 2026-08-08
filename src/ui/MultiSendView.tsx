import { useState } from 'react';
import { getAddress, isAddress, parseUnits } from 'viem';
import { getActiveAccountMeta, getSessionPrivateKey } from '../lib/accountSession';
import { isHardwareAccount } from '../lib/accounts';
import { effectiveActiveChainId, type AppSettings } from '../lib/storageState';
import { chainById } from '../lib/chainCatalog';
import {
  multiSendErc20,
  multiSendNative,
  parseAddressList,
} from '../lib/backgroundSign';
import { describeError } from '../lib/utils';

export function MultiSendView({ settings }: { settings: AppSettings }) {
  const account = getSessionPrivateKey();
  const chainId = effectiveActiveChainId(settings);
  const chain = chainById(chainId);

  const [addressesRaw, setAddressesRaw] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [tokenAddr, setTokenAddr] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  async function submit() {
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
    setBusy(true);
    try {
      const recipients = parseAddressList(addressesRaw);
      const decimals = chain?.nativeCurrency.decimals ?? 18;
      const amount = parseUnits(amountStr.trim() || '0', decimals);
      if (amount <= 0n) throw new Error('Enter a positive amount per recipient.');

      const hashes = tokenAddr.trim()
        ? await multiSendErc20({
            pk,
            chainId,
            token: getAddress(tokenAddr.trim()),
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
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  const previewCount = addressesRaw
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(Boolean).length;

  return (
    <div className="w1337-send-panel">
      <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
        Distribute {chain?.nativeCurrency.symbol ?? 'native'} or an ERC-20 to many addresses at once.
        Uses the network selected on the Assets tab ({chain?.name ?? chainId}).
      </p>

      <label htmlFor="ms-addrs">Recipients (one per line)</label>
      <textarea
        id="ms-addrs"
        value={addressesRaw}
        onChange={e => setAddressesRaw(e.target.value)}
        rows={6}
        placeholder={'0xabc…\n0xdef…'}
        spellCheck={false}
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
      />

      <label htmlFor="ms-token" style={{ marginTop: 12 }}>
        ERC-20 token (leave empty for native)
      </label>
      <input
        id="ms-token"
        value={tokenAddr}
        onChange={e => setTokenAddr(e.target.value)}
        placeholder="0x… or empty for ETH/native"
      />
      {tokenAddr.trim() && !isAddress(tokenAddr.trim()) ? (
        <p className="error" style={{ fontSize: 12 }}>
          Invalid token address
        </p>
      ) : null}

      {err ? <p className="error">{err}</p> : null}

      <button
        type="button"
        className="primary"
        style={{ width: '100%', marginTop: 12 }}
        disabled={busy || !addressesRaw.trim() || !amountStr.trim()}
        onClick={() => void submit()}
      >
        {busy ? 'Sending…' : 'Send to all'}
      </button>

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
