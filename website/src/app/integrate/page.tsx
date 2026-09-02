import type { Metadata } from 'next';
import Link from 'next/link';
import { CodeBlock } from '@/components/CodeBlock';
import { PROVIDER, SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Integrate 1337 Wallet',
  description:
    'Guide for dapp developers, wallet connectors, and AI agents integrating 1337 Wallet via EIP-1193 and EIP-6963.',
};

export default function IntegratePage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-16 md:py-20">
      <div className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-deep">
          For builders &amp; AIs
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          Integrate {SITE.name}
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          1337 exposes a standard EIP-1193 provider with EIP-6963 discovery — similar to how{' '}
          <a
            href="https://rabby.io/docs/integrating-rabby-wallet"
            className="text-text underline-offset-4 hover:underline"
          >
            Rabby documents integration
          </a>
          . Use the patterns below in vanilla JS, Wagmi, Ethers, or RainbowKit-style wallet lists.
        </p>
      </div>

      <div className="prose-docs mt-12">
        <h2>Provider identity</h2>
        <p>When discovering wallets via EIP-6963, 1337 announces:</p>
        <ul>
          <li>
            <strong className="text-text">name:</strong> {PROVIDER.name}
          </li>
          <li>
            <strong className="text-text">rdns:</strong> <code>{PROVIDER.rdns}</code>
          </li>
          <li>
            <strong className="text-text">uuid:</strong> <code>{PROVIDER.uuid}</code>
          </li>
          <li>
            <strong className="text-text">flags:</strong> <code>is1337</code>,{' '}
            <code>isMetaMask</code> (drop-in mode)
          </li>
        </ul>
        <p>
          In MetaMask drop-in mode, 1337 can also appear as <code>io.metamask</code> so existing
          dapp UIs that filter by MetaMask still connect. Alternative namespace:{' '}
          <code>window.wallet1337</code> when not replacing MetaMask.
        </p>

        <h2>1. Vanilla JavaScript (EIP-6963)</h2>
        <p>Recommended for multi-wallet environments — listen for announced providers:</p>
        <CodeBlock title="discover-and-connect.ts">
          {`let provider: EIP1193Provider | null = null;

window.addEventListener('eip6963:announceProvider', (event: Event) => {
  const detail = (event as CustomEvent).detail;
  if (detail.info.rdns === '${PROVIDER.rdns}') {
    provider = detail.provider;
  }
});

window.dispatchEvent(new Event('eip6963:requestProvider'));

async function connect1337() {
  if (!provider) throw new Error('1337 Wallet not installed');
  const accounts = await provider.request({
    method: 'eth_requestAccounts',
  });
  return accounts[0];
}`}
        </CodeBlock>

        <h2>2. window.ethereum fallback</h2>
        <p>
          If your dapp already uses MetaMask-style injection, 1337 works as a drop-in when the user
          enables replace mode:
        </p>
        <CodeBlock title="legacy-connect.ts">
          {`const eth = window.ethereum;
if (!eth?.is1337 && !eth?.isMetaMask) {
  throw new Error('Install 1337 Wallet for Chrome');
}

const [address] = await eth.request({ method: 'eth_requestAccounts' });
console.log('Connected', address);`}
        </CodeBlock>

        <h2>3. Wagmi v2</h2>
        <p>Injected connector with EIP-6963-aware discovery (same pattern as Rabby + Wagmi docs):</p>
        <CodeBlock title="wagmi.config.ts">
          {`import { createConfig, http } from '@wagmi/core';
import { mainnet, base, arbitrum } from '@wagmi/core/chains';
import { injected } from '@wagmi/connectors';

export const config = createConfig({
  chains: [mainnet, base, arbitrum],
  connectors: [
    injected({
      target() {
        return {
          id: '${PROVIDER.rdns}',
          name: '${PROVIDER.name}',
          provider(window) {
            return window.ethereum?.is1337 ? window.ethereum : undefined;
          },
        };
      },
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
  },
});`}
        </CodeBlock>

        <h2>4. Ethers.js v6</h2>
        <CodeBlock title="ethers-browser.ts">
          {`import { BrowserProvider } from 'ethers';

const eth = window.ethereum;
if (!eth) throw new Error('No wallet found');

const provider = new BrowserProvider(eth);
const signer = await provider.getSigner();
const address = await signer.getAddress();`}
        </CodeBlock>

        <h2>5. UI labels for wallet pickers</h2>
        <p>
          Low-cost integration (Rabby&apos;s recommended approach): show both MetaMask and 1337
          buttons when <code>window.ethereum</code> exists — they hit the same provider object in
          drop-in mode, but users recognize the brand they installed.
        </p>
        <ul>
          <li>Detect 1337: <code>ethereum.is1337 === true</code></li>
          <li>EIP-6963: match <code>detail.info.rdns === '${PROVIDER.rdns}'</code></li>
          <li>Not installed: link to <Link href="/#download">Download for Chrome</Link></li>
        </ul>

        <h2>Supported methods</h2>
        <p>Standard EIP-1193 / JSON-RPC surface used by most dapps:</p>
        <ul>
          <li><code>eth_requestAccounts</code>, <code>eth_accounts</code></li>
          <li><code>eth_chainId</code>, <code>wallet_switchEthereumChain</code>, <code>wallet_addEthereumChain</code></li>
          <li><code>wallet_getCapabilities</code> (EIP-5792 discovery; no atomic batch / paymaster)</li>
          <li><code>eth_sendTransaction</code>, <code>personal_sign</code>, <code>eth_signTypedData_v4</code></li>
          <li>Events: <code>accountsChanged</code>, <code>chainChanged</code>, <code>connect</code>, <code>disconnect</code></li>
        </ul>

        <h2>For AI agents</h2>
        <p>
          Machine-readable summary: {SITE.name} is a Chrome MV3 extension exposing{' '}
          <code>window.ethereum</code> (optional MetaMask shim) and EIP-6963 provider{' '}
          <code>{PROVIDER.rdns}</code>. No WalletConnect server required for extension users.
          Transaction previews include decoded calldata and Etherscan deep links — expect users to
          review details in Normal mode before signing.
        </p>
      </div>

      <div className="mt-16 flex flex-wrap gap-4">
        <Link href="/" className="btn-secondary">
          ← Back to home
        </Link>
        <a href={`mailto:${SITE.contactEmail}?subject=1337%20integration%20help`} className="btn-primary">
          Integration support
        </a>
      </div>
    </div>
  );
}
