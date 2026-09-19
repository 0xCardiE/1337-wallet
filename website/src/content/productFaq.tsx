import Link from 'next/link';
import type { FaqGroup } from '@/components/FaqList';
import { WalletComparisonTable } from '@/components/WalletComparisonTable';
import { SITE } from '@/lib/site';

const linkClass = 'text-text underline-offset-4 hover:underline';

export const PRIVACY_COMPARISON = [
  {
    topic: 'Account with the vendor',
    metamask: 'Yes, for some features',
    rabby: 'Not for the basic wallet',
    us: 'No',
  },
  {
    topic: 'Wallet server / backend',
    metamask: 'Yes',
    rabby: 'Yes',
    us: 'No 1337 wallet server',
  },
  {
    topic: 'Analytics / telemetry',
    metamask: 'Yes — MetaMetrics',
    rabby: 'Usage / service data',
    us: 'No',
  },
  {
    topic: 'Crash / error telemetry',
    metamask: 'Yes, depending on the feature',
    rabby: 'Yes',
    us: 'No',
  },
  {
    topic: 'Vendor can process your IP',
    metamask: 'Yes',
    rabby: 'Yes',
    us: 'No 1337 server that receives it',
  },
  {
    topic: 'Wallet address can reach the vendor',
    metamask: 'Yes, through APIs',
    rabby: 'Yes, depending on services',
    us: 'Not to a 1337 server',
  },
  {
    topic: 'Private key / seed',
    metamask: 'Never leaves the device',
    rabby: 'Never leaves the device',
    us: 'Never leaves the device',
  },
  {
    topic: 'RPC provider sees addresses',
    metamask: 'Yes',
    rabby: 'Yes',
    us: 'Yes, if you use that RPC',
  },
  {
    topic: 'Bring your own RPC',
    metamask: 'Yes',
    rabby: 'Yes',
    us: 'Yes',
  },
  {
    topic: 'Vendor can correlate usage with a wallet',
    metamask: 'Possible through MetaMetrics',
    rabby: 'Depends on their services',
    us: 'No 1337 backend that could do that',
  },
] as const;

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
              Developers, security researchers, and advanced users who want a serious signer.
              Detailed confirms, easy RPC switching, and hardware. If you already live in MetaMask
              or Rabby and wish the wallet assumed you can inspect a transaction, you are the audience.
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
        q: 'Is 1337 open source?',
        a: (
          <>
            <p>
              Yes. The wallet is open source under the MIT license. Read the code, open issues, and
              send pull requests on{' '}
              <a href={SITE.githubUrl} className={linkClass} target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
              . Install the signed build from the{' '}
              <a href={SITE.chromeStoreUrl} className={linkClass} target="_blank" rel="noopener noreferrer">
                Chrome Web Store
              </a>
              ; the repository is how you inspect what that build is made from.
            </p>
          </>
        ),
      },
      {
        q: 'How is it different from MetaMask and Rabby as a product?',
        a: (
          <>
            <p>
              Same job (connect to dapps, send, sign) with a denser toolkit: per-chain RPC picker
              and network doctor, Inspect, approval revoke, LiFi swaps, multisend, ENS, side panel,
              optional Burner Mode on a disposable key. MetaMask is the compatibility baseline.
              Rabby is the closest power-user cousin. 1337 is privacy and power: no analytics, no
              1337 server, no central entity that could watch you. User data stays on the user&apos;s
              machine.
            </p>
            <p className="mt-3">
              For keys and hardware, security is the same class. That question lives on{' '}
              <Link href="/security" className={linkClass}>
                Security
              </Link>
              . For what the vendor can collect about you, see the{' '}
              <Link href="/faq#privacy" className={linkClass}>
                privacy comparison
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
              Install from the{' '}
              <a href={SITE.chromeStoreUrl} className={linkClass} target="_blank" rel="noopener noreferrer">
                Chrome Web Store
              </a>
              . Chrome, Brave, Opera, and Arc all use that same listing. After install it opens in
              the side panel by default. Switch to popup in Settings if you prefer MetaMask-style
              chrome. You can also clone and build from{' '}
              <a href={SITE.githubUrl} className={linkClass} target="_blank" rel="noopener noreferrer">
                source
              </a>
              .
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
              MetaMask, or connect as 1337 via EIP-6963. Most Wagmi / RainbowKit / Ethers stacks just
              work. Builders:{' '}
              <Link href="/integrate" className={linkClass}>
                integration guide
              </Link>
              {' · '}
              <Link href="/rpc" className={linkClass}>
                RPC methods
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
              chain in one click, add a custom URL if you want, and run the network doctor when
              something looks off.
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
              auto-signs ordinary requests on a local key you treat as disposable. Risky actions
              still pause unless you ungate them. Hardware always confirms on the device. More on{' '}
              <Link href="/security#signing" className={linkClass}>
                Security
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
              Signings (local message / typed-data history), Approvals (ERC-20, NFT operators,
              Permit2), Swap (LI.FI), ENS &amp; DNS, Multisend, and Gas station. Inspect (address,
              token, ENS, tx hash) is off until you enable it in Settings. Inspect is a search box,
              not a fourth tab. Nav stays Assets / History / Tools.
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
              route details are in the flow.
            </p>
          </>
        ),
      },
      {
        q: 'What is Multisend?',
        a: (
          <>
            <p>
              Paste a list of addresses and batch native or ERC-20 through Disperse.app, the
              familiar no-fee batch contract, including on hardware accounts. If a chain has no
              Disperse yet but has CreateX, the first user can deploy that same Disperse for
              everyone. It is a send tool.
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
              There is no 1337 history backend.
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
    title: 'Privacy',
    intro:
      'Keep all user data where it belongs on the user\'s machine. There is no 1337 server that could collect it, and there never will be.',
    extra: (
      <div>
        <h3 className="text-lg font-medium tracking-tight">What the vendor can collect</h3>
        <p className="mt-2 max-w-3xl text-muted">
          If we look at how much the wallet maker itself collects about you, 1337 is a more
          privacy-minimal model than MetaMask and Rabby. Your RPC and the dapps you use still see
          what you send them — that is true in every wallet.
        </p>
        <div className="mt-6">
          <WalletComparisonTable
            rows={PRIVACY_COMPARISON}
            emphasizeUs
            caption="What the vendor can collect compared with MetaMask and Rabby"
          />
        </div>
        <p className="mt-3 max-w-3xl text-sm text-muted">
          MetaMask and Rabby change their stacks; this is typical current behavior, not a legal
          audit. 1337 has no collection server to add later.
        </p>
      </div>
    ),
    items: [
      {
        q: 'How does 1337 compare to MetaMask and Rabby on privacy?',
        a: (
          <>
            <p>
              Same self-custody on the device: seed and private keys do not leave the machine in
              1337, MetaMask, or Rabby. The split is what the vendor can collect. MetaMask ships
              MetaMetrics and vendor APIs. Rabby runs product and security services that can see
              usage. 1337 has no account, no analytics, no crash telemetry, and no 1337 server that
              could receive your IP or address.
            </p>
            <p className="mt-3">
              An RPC you choose still sees requests from your wallet. That is true in every signer.
              Bring your own RPC if you do not want a public endpoint to see those calls. Third
              parties you opt into — LI.FI, an explorer key, Trezor Connect — still see what those
              features need. We do not get a copy. Full policy:{' '}
              <Link href="/privacy" className={linkClass}>
                Privacy
              </Link>
              .
            </p>
          </>
        ),
      },
      {
        q: 'Is 1337 private by design?',
        a: (
          <>
            <p>
              Privacy is only possible when there is no central entity with the power to violate it.
              Other wallets keep that power: analytics, accounts, or a server that could watch you
              if they chose to. 1337 does not. There is no 1337 backend, no user database, and no
              analytics SDK. Keep all user data where it belongs on the user&apos;s machine. We
              cannot leak or sell what we do not have. That is architecture, not a privacy setting
              we might change later.
            </p>
          </>
        ),
      },
      {
        q: 'Do you collect any information?',
        a: (
          <>
            <p>
              No. The wallet does not collect analytics, telemetry, addresses, balances, or usage.
              There is no 1337 server that receives your data, and there never will be. Vault,
              settings, and session stay in Chrome extension storage on the user&apos;s machine.
            </p>
            <p className="mt-3">
              Third parties you choose — RPC, LI.FI when you swap, the explorer key you paste for
              History, Trezor Connect — still see what those features need. We do not get a copy.
              Full policy:{' '}
              <Link href="/privacy" className={linkClass}>
                Privacy
              </Link>
              .
            </p>
          </>
        ),
      },
      {
        q: 'Will you add analytics later?',
        a: (
          <>
            <p>
              No. A wallet that can collect is not private; it is promising not to. We will not add
              a 1337 analytics SDK, tracking server, or user database. If a feature talks to a
              third party you opt into, it is listed on the privacy page — it still does not phone
              home to us.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'support',
    title: 'Support',
    items: [
      {
        q: 'Do you guarantee my funds?',
        a: (
          <>
            <p>
              No. 1337 is a self-custody tool, not a bank. You hold the keys. We cannot recover a
              lost seed, reverse a send, or reimburse stolen or mis-sent assets. Software is
              provided as-is. Simulation and danger flags help you judge a request. They do not
              insure the outcome. Full text:{' '}
              <Link href="/terms" className={linkClass}>
                Terms
              </Link>
              .
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
                hardware on Security
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
              It is a Chrome MV3 extension (side panel + popup). Chrome, Brave, Opera, and Arc
              install from the same{' '}
              <a href={SITE.chromeStoreUrl} className={linkClass} target="_blank" rel="noopener noreferrer">
                Chrome Web Store
              </a>{' '}
              listing. We develop against Chrome. Firefox is not listed.
            </p>
          </>
        ),
      },
      {
        q: 'How do I get help?',
        a: (
          <>
            <p>
              Join{' '}
              <a href={SITE.discordUrl} className={linkClass} target="_blank" rel="noopener noreferrer">
                Discord
              </a>
              , follow{' '}
              <a href={SITE.xUrl} className={linkClass} target="_blank" rel="noopener noreferrer">
                @1337wallet on X
              </a>
              , or open an issue on{' '}
              <a href={SITE.githubUrl} className={linkClass} target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
              . Dapp and AI integration lives on{' '}
              <Link href="/integrate" className={linkClass}>
                Integrate
              </Link>
              . Keys and hardware:{' '}
              <Link href="/security" className={linkClass}>
                Security
              </Link>
              . Privacy compared with MetaMask and Rabby:{' '}
              <Link href="/faq#privacy" className={linkClass}>
                Privacy FAQ
              </Link>
              .
            </p>
          </>
        ),
      },
    ],
  },
];
