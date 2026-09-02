import Link from 'next/link';
import type { FaqGroup } from '@/components/FaqList';
import { SITE } from '@/lib/site';

const linkClass = 'text-text underline-offset-4 hover:underline';

export const PRODUCT_FAQ: FaqGroup[] = [
  {
    id: 'product',
    title: 'What 1337 is',
    items: [
      {
        q: 'Who is 1337 Wallet for?',
        a: (
          <>
            <p>
              Developers, security researchers, and advanced users who want a serious signer —
              readable confirms, RPC control, hardware — not a consumer toy and not a Foundry lab in
              the toolbar. If you already live in MetaMask or Rabby and wish the wallet assumed you
              can read a transaction, you are the audience.
            </p>
          </>
        ),
      },
      {
        q: 'Is this a consumer wallet?',
        a: (
          <>
            <p>
              It is self-custody for people who want power-user defaults, not onboarding for someone
              buying crypto for the first time. Seed, private key, Ledger, and Trezor are all
              supported. The UI does not hide details behind a cartoon.
            </p>
          </>
        ),
      },
      {
        q: 'Is it a Foundry or Etherscan replacement?',
        a: (
          <>
            <p>
              No. 1337 is a wallet you sign with: understand the request, judge the risk, sign or
              reject. Inspect, History, and the confirm sheet cover “what is this address / token /
              tx?” There is no ABI lab, storage inspector, or cast-style workbench. Use Foundry and
              explorers for that.
            </p>
          </>
        ),
      },
      {
        q: 'How is it different from MetaMask and Rabby as a product?',
        a: (
          <>
            <p>
              Same job — connect to dapps, send, sign — with a denser toolkit: per-chain RPC picker
              and network doctor, Inspect, approval revoke, LiFi swaps, multisend, ENS, side panel,
              optional Burner Mode on a disposable key. MetaMask is the compatibility baseline.
              Rabby is the closest “power user extension” cousin. 1337 is local-first and has no
              analytics.
            </p>
            <p className="mt-3">
              For keys and hardware, security is the same class. That question lives on the{' '}
              <Link href="/security" className={linkClass}>
                security FAQ
              </Link>
              .
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'using',
    title: 'Using the wallet',
    items: [
      {
        q: 'How do I install it?',
        a: (
          <>
            <p>
              Chrome, Developer mode → Load unpacked from a <code>dist/</code> build, or the Chrome
              Web Store listing when it is published. After install it opens in the side panel by
              default; switch to popup in Settings if you prefer MetaMask-style chrome.
            </p>
          </>
        ),
      },
      {
        q: 'Does it work with Uniswap and other existing dapps?',
        a: (
          <>
            <p>
              Yes. Enable MetaMask drop-in for <code>window.ethereum</code> sites that only look for
              MetaMask, or connect as 1337 via EIP-6963 (the same discovery Rabby documents). Most
              Wagmi / RainbowKit / Ethers stacks just work. Builders:{' '}
              <Link href="/integrate" className={linkClass}>
                integration guide
              </Link>
              .
            </p>
          </>
        ),
      },
      {
        q: 'Can I use more than one account?',
        a: (
          <>
            <p>
              Yes. A seed derives HD accounts on the same path style as MetaMask (
              <code>m/44&apos;/60&apos;/0&apos;/0/n</code>). You can also import extra private keys
              and attach Ledger or Trezor accounts. Pick the active account in the header.
            </p>
          </>
        ),
      },
      {
        q: 'How do networks and RPCs work?',
        a: (
          <>
            <p>
              Twenty-plus popular EVM chains ship with curated public RPCs. Switch the endpoint per
              chain, add your own URL, and run the network doctor when something looks off. You are
              not stuck on a single vendor RPC the way many consumer wallets feel.
            </p>
          </>
        ),
      },
      {
        q: 'Side panel or popup?',
        a: (
          <>
            <p>
              Side panel is the default so the dapp and the wallet can sit next to each other.
              Settings can switch you to a popup. Same extension, same vault.
            </p>
          </>
        ),
      },
      {
        q: 'What is Normal vs Burner Mode?',
        a: (
          <>
            <p>
              Normal (default) confirms every dapp sign/send, like MetaMask and Rabby. Burner Mode
              auto-signs ordinary requests on a local key you treat as disposable; risky actions
              still pause unless you ungate them. Hardware always confirms on the device. More on
              the{' '}
              <Link href="/security#signing" className={linkClass}>
                security FAQ
              </Link>
              .
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'features',
    title: 'Features',
    items: [
      {
        q: 'What can I do from Tools?',
        a: (
          <>
            <p>
              Inspect (address, token, ENS, tx hash), Approvals (ERC-20, NFT operators, Permit2),
              Swap (LI.FI), ENS &amp; DNS, Multisend, and Gas station. Hide what you do not use in
              Settings. Inspect is a search box, not a fourth tab — nav stays Assets / History /
              Tools.
            </p>
          </>
        ),
      },
      {
        q: 'How do swaps work?',
        a: (
          <>
            <p>
              Cross-chain routes come from LI.FI when you open Swap. 1337 does not run a swap
              backend. You still confirm (or, on hardware, confirm on the device). Slippage and
              route details are in the flow, same family as other wallets that embed a DEX
              aggregator.
            </p>
          </>
        ),
      },
      {
        q: 'What is Multisend?',
        a: (
          <>
            <p>
              Paste a list of addresses and batch native or ERC-20 through Disperse.app — the
              familiar no-fee batch contract, including on hardware accounts. If a chain has no
              Disperse yet but has CreateX, the first user can deploy that same Disperse for
              everyone. It is a send tool, not a CREATE2 playground.
            </p>
          </>
        ),
      },
      {
        q: 'Where does History come from?',
        a: (
          <>
            <p>
              Your own Etherscan-compatible API key in Settings. Rows deep-link to the explorer.
              Public RPCs cannot list “all txs for this address,” so we do not pretend otherwise.
              No 1337 history server.
            </p>
          </>
        ),
      },
      {
        q: 'Does it support ENS?',
        a: (
          <>
            <p>
              Yes. Names resolve on send, and Tools covers register / renew / DNS-style records.
              Paste an ENS name into Inspect the same way you would paste an address.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy and support',
    items: [
      {
        q: 'Does it track me?',
        a: (
          <>
            <p>
              No analytics, no telemetry, no 1337 backend. Vault and settings stay in Chrome
              extension storage on your machine. That is stricter than typical MetaMask/Rabby
              product analytics. Third parties you choose (RPC, LI.FI, explorer, Trezor Connect)
              still see what those features need.
            </p>
          </>
        ),
      },
      {
        q: 'Hardware wallets?',
        a: (
          <>
            <p>
              Ledger (WebHID) and Trezor Connect, alongside seed and private-key accounts. For
              “what if the extension is evil,” read{' '}
              <Link href="/security#hardware" className={linkClass}>
                hardware on the security FAQ
              </Link>
              .
            </p>
          </>
        ),
      },
      {
        q: 'Is it Chrome-only?',
        a: (
          <>
            <p>
              Yes today — a Chrome MV3 extension (side panel + popup). Chromium forks that run
              MV3 extensions may work; we develop against Chrome.
            </p>
          </>
        ),
      },
      {
        q: 'How do I get help?',
        a: (
          <>
            <p>
              Email{' '}
              <a href={`mailto:${SITE.contactEmail}`} className={linkClass}>
                {SITE.contactEmail}
              </a>
              . Dapp and AI integration lives on{' '}
              <Link href="/integrate" className={linkClass}>
                /integrate
              </Link>
              . Keys, hardware, and MetaMask/Rabby comparisons:{' '}
              <Link href="/security" className={linkClass}>
                /security
              </Link>
              .
            </p>
          </>
        ),
      },
    ],
  },
];
