import Link from 'next/link';
import type { FaqGroup } from '@/components/FaqList';
import { SITE } from '@/lib/site';

const linkClass = 'text-text underline-offset-4 hover:underline';

export const SECURITY_COMPARISON = [
  {
    topic: 'Who holds the keys',
    metamask: 'You. Encrypted on your machine.',
    rabby: 'You. Encrypted on your machine.',
    us: 'You. Encrypted on your machine.',
  },
  {
    topic: 'Default before signing',
    metamask: 'Confirm every request',
    rabby: 'Confirm every request',
    us: 'Confirm every request (Normal)',
  },
  {
    topic: 'Hardware wallets',
    metamask: 'Ledger, Trezor. Keys stay on the device.',
    rabby: 'Ledger, Trezor. Keys stay on the device.',
    us: 'Ledger, Trezor. Keys stay on the device.',
  },
  {
    topic: 'If Chrome is hacked + hardware',
    metamask: 'Attacker can prompt. You still approve on the device.',
    rabby: 'Same. Device is the last line.',
    us: 'Same. Device is the last line.',
  },
  {
    topic: 'Can a company server spend?',
    metamask: 'No. Self-custody.',
    rabby: 'No. Self-custody.',
    us: 'No. There is no tracking server that can spend.',
  },
  {
    topic: 'If you lose keys or get phished',
    metamask: 'They cannot recover or reimburse funds.',
    rabby: 'They cannot recover or reimburse funds.',
    us: 'Same. Tool only. You are responsible for the keys.',
  },
  {
    topic: 'Analytics about your wallet',
    metamask: 'Product telemetry in the extension',
    rabby: 'Product / security services in the stack',
    us: 'None. Never. No 1337 telemetry.',
  },
] as const;

export const SECURITY_FAQ: FaqGroup[] = [
  {
    id: 'trust',
    title: 'If you do not trust a new wallet yet',
    intro:
      'You do not have to put everything on 1337. Pick the account type that matches the amount.',
    items: [
      {
        q: 'What if I do not trust 1337?',
        a: (
          <>
            <p>
              Then do not put meaningful funds on a software key. That is true in 1337, MetaMask, or
              Rabby. Treat the extension as a hot wallet: generate or import a private key (or a
              cheap seed) and keep only working amounts there.
            </p>
            <p className="mt-3">
              For larger amounts, connect Ledger or Trezor. 1337 never sees the hardware seed. It
              only stores the address and the derivation path. Signing happens on the device. Even
              if this extension, Chrome, or a dependency were fully compromised, an attacker cannot
              pull keys off a hardware wallet. They can only ask you to sign. If you reject on the
              device, nothing moves.
            </p>
            <p className="mt-3">
              The remaining hardware risk is approving a malicious transaction on the device screen.
              Read the address and amount on the device, not only in the extension.
            </p>
          </>
        ),
      },
      {
        q: 'Can I use 1337 only as a burner / hot wallet?',
        a: (
          <>
            <p>
              Yes. That is a good way to start. Create a private key or a seed you are willing to
              treat as disposable, fund it with amounts you can afford to lose, and leave your main
              stack on hardware.
            </p>
            <p className="mt-3">
              Burner Mode (auto-sign ordinary requests) is opt-in and still pauses on high-risk
              actions by default. Keep it for throwaway keys. Leave Normal mode on for anything you
              care about.
            </p>
          </>
        ),
      },
      {
        q: 'If I lose funds, will 1337 reimburse me?',
        a: (
          <>
            <p>
              No. 1337 is a self-custody tool. We do not hold your keys, cannot reverse chain
              transactions, and do not insure or reimburse lost, stolen, or mis-sent assets. If the
              seed is gone or you approved a drain, nobody at the wallet company can get the funds
              back. Read{' '}
              <Link href="/terms" className={linkClass}>
                terms of use
              </Link>{' '}
              before you put value on a software key.
            </p>
          </>
        ),
      },
      {
        q: 'If the wallet is compromised, can someone steal my hardware funds?',
        a: (
          <>
            <p>
              Not by extracting the key. Ledger and Trezor keep the seed on the device. 1337 only
              brokers the request. A compromised extension can pop a signing prompt. It cannot dump
              the hardware secret.
            </p>
            <p className="mt-3">
              Theft still happens if you sign a bad transaction on the device: a drain, an unlimited
              approval, a wrong recipient. That attack works against every wallet that talks to
              hardware. The defense is the same: Normal mode in the UI, then verify on the device
              screen.
            </p>
          </>
        ),
      },
      {
        q: 'Why should I believe any of this?',
        a: (
          <>
            <p>
              Encrypted vaults, browser extensions, and hardware signing are the same primitives
              MetaMask and Rabby already use. 1337 does not invent a new way to hold keys. It is a
              signer in that family, with no 1337 backend that could hold a copy.
            </p>
            <p className="mt-3">
              If you want proof instead of copy, install only from the official Chrome Web Store,
              start with a burner key, and keep size on hardware until you are satisfied.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'compare',
    title: 'Compared to MetaMask and Rabby',
    intro:
      '1337 is the same class of product: a self-custody Chrome extension plus optional hardware. The product differences are workflow and privacy, not a weaker key model.',
    items: [
      {
        q: 'Is 1337 as secure as MetaMask?',
        a: (
          <>
            <p>
              For who holds the keys, whether a company server can spend, whether you confirm
              before signing, and whether hardware stays off-computer: yes, it is the same model.
              Both encrypt a software vault on your machine. Both confirm every dapp request by
              default. Both talk to Ledger and Trezor without ever learning the device seed.
            </p>
            <p className="mt-3">
              MetaMask is older, more widely reviewed, and ships extra consumer protections
              (phishing lists, a conservative unlock story). 1337 matches the signer core and adds
              MetaMask-style LavaMoat isolation on the popup and background bundles. It does not
              magically beat a decade of MetaMask production time. It also does not ask you to
              accept a different custody class.
            </p>
          </>
        ),
      },
      {
        q: 'How does it compare to Rabby?',
        a: (
          <>
            <p>
              Rabby is also a self-custody browser wallet: local keys, confirm-by-default, hardware,
              readable transactions. If you already trust Rabby’s model, 1337 sits in that same
              bucket.
            </p>
            <p className="mt-3">
              Rabby invests more in reputation and simulation services (known-scam checks, richer
              previews). 1337 stays local-first: human summary, a local simulate for pass / fail /
              revert, and contract danger flags, without a 1337 security cloud. That is a product
              choice, not a weaker vault. If you want third-party blocklists, Rabby still does more
              of that today.
            </p>
          </>
        ),
      },
      {
        q: 'If security is similar, what is actually different?',
        a: (
          <>
            <p>
              Defaults and extras. MetaMask and Rabby optimize for a huge consumer audience. 1337
              optimizes for power users: easy RPC switching, Inspect, approvals revoke, LiFi swaps,
              multisend, side panel, optional Burner Mode on a disposable key.
            </p>
            <p className="mt-3">
              Privacy is a real split: 1337 is private by design. No analytics, no tracking server,
              and no central entity that could watch you. Side-by-side vendor collection is on the{' '}
              <Link href="/faq#privacy" className={linkClass}>
                privacy FAQ
              </Link>
              . Supply-chain hardening is in MetaMask’s family (LavaMoat compartments on the
              sensitive bundles).
              Auto-lock is available but off by default. Turn it on if the machine is shared.
            </p>
          </>
        ),
      },
      {
        q: 'Is a new wallet automatically riskier than a famous one?',
        a: (
          <>
            <p>
              A fake “MetaMask” in the store is more dangerous than an honest small wallet you
              built from source. The risks that scale with popularity are phishing clones and social
              engineering, not the secp256k1 math.
            </p>
            <p className="mt-3">
              What is fair: MetaMask and Rabby have more eyes on the code and more production miles.
              Treat 1337 like you would a new Rabby alternative. Verify the install, start with a
              burner, put size on hardware.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'keys',
    title: 'Where keys live',
    items: [
      {
        q: 'Where are my seed phrase and private keys stored?',
        a: (
          <>
            <p>
              On your machine, in Chrome extension storage, encrypted with your password (a slow
              password-based key derivation plus AES-GCM, the same idea as MetaMask’s vault). 1337
              does not upload the vault. There is no 1337 account and no 1337 cloud backup.
            </p>
            <p className="mt-3">
              Hardware accounts are different: only the public address, label, and path are stored.
              The seed stays on Ledger or Trezor.
            </p>
          </>
        ),
      },
      {
        q: 'Does 1337 have a server that could steal funds?',
        a: (
          <>
            <p>
              No. There is no tracking server, no hosted wallet, and no recovery email. Network
              calls happen when you use an RPC, open Swap (LI.FI), fetch history with{' '}
              <em>your</em> explorer key, or talk to a hardware SDK. The chain sees broadcasts. A
              company named 1337 does not get a copy of the key.
            </p>
          </>
        ),
      },
      {
        q: 'Seed phrase vs private key. Which should I use?',
        a: (
          <>
            <p>
              Seed (BIP-39, same path style as MetaMask) if you want several accounts from one
              backup. A single private key if you want a disposable burner with nothing else tied to
              it. MetaMask’s “import private key” is the same shape.
            </p>
            <p className="mt-3">
              Write the backup on paper, offline. Never paste a seed into a website. That advice is
              identical for every self-custody wallet.
            </p>
          </>
        ),
      },
      {
        q: 'What happens when I lock, close the panel, or restart Chrome?',
        a: (
          <>
            <p>
              Lock (or auto-lock) clears the unlocked session. Closing the side panel does not lock
              you. Restarting the browser relocks. The encrypted vault stays.
            </p>
            <p className="mt-3">
              While unlocked, a software account is a hot wallet. Anyone with that unlocked Chrome
              profile can use it until you lock. Use Lock when you step away.
            </p>
          </>
        ),
      },
      {
        q: 'Can 1337 see my balances or history on a company server?',
        a: (
          <>
            <p>
              Balances come from the RPC you picked. History uses an explorer API key you paste in
              Settings. It goes to that explorer, not to 1337. If you never add a key, we do not
              invent a 1337 history service.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'hardware',
    title: 'Hardware wallets',
    items: [
      {
        q: 'How do Ledger and Trezor work in 1337?',
        a: (
          <>
            <p>
              Ledger talks over WebHID. Trezor uses Trezor Connect. 1337 shows the request, then the
              device must confirm. Sends, swaps, dapp transactions, personal_sign, and typed data
              for hardware accounts go through the device, not through a software key in the
              extension.
            </p>
          </>
        ),
      },
      {
        q: 'Is hardware “unhackable” if 1337 is malicious?',
        a: (
          <>
            <p>
              The key stays on the device. A hostile or buggy extension cannot export a Ledger or
              Trezor seed. That is the point of hardware.
            </p>
            <p className="mt-3">
              Firmware bugs exist. Blind signing exists. You can still approve a drain on the tiny
              screen. What hardware does buy you: extension malware does not get a copy of the key.
              It has to fool you into signing.
            </p>
          </>
        ),
      },
      {
        q: 'Do I still need to read the device screen?',
        a: (
          <>
            <p>
              Yes. Always. The extension UI can be spoofed if the machine is hostile. The device
              screen is the check. If the recipient, amount, or contract looks wrong on the device,
              reject it.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'signing',
    title: 'What you see before you sign',
    items: [
      {
        q: 'Does 1337 confirm every transaction like MetaMask?',
        a: (
          <>
            <p>
              Yes by default. Normal mode queues each dapp sign/send in the confirm sheet: human
              summary, local simulation (pass / fail / revert / gas), and contract danger flags when
              we can see source. The dapp is untrusted. You are the gate.
            </p>
          </>
        ),
      },
      {
        q: 'What is Burner Mode?',
        a: (
          <>
            <p>
              An opt-in auto-sign for ordinary requests on a <em>local</em> account you have marked
              as disposable. Hardware never auto-signs. The device always confirms. Even in Burner
              Mode, risky stuff still opens the sheet unless you turn those gates off: unlimited
              approvals, unknown contracts, high-value sends, permits, chain-id mismatches, and
              login-message domain mismatches.
            </p>
            <p className="mt-3">
              Use it like a throwaway account you are willing to empty, not like a vault.
            </p>
          </>
        ),
      },
      {
        q: 'Why is eth_sign disabled?',
        a: (
          <>
            <p>
              It is a classic foot-gun. Same reason MetaMask turned it off. Dapps should use
              personal_sign or typed data (eth_signTypedData_v4). 1337 rejects eth_sign instead of
              letting a site ask you to sign a hash you cannot read.
            </p>
          </>
        ),
      },
      {
        q: 'Can a malicious dapp drain me?',
        a: (
          <>
            <p>
              If you approve an unlimited token spend or sign a bad transaction, yes. That is true
              in 1337, MetaMask, and Rabby. The wallet cannot know your intent better than you.
              What we do: show a human line (“allow Uniswap to spend unlimited USDC”), flag unknown
              contracts, simulate locally, warn on weird login domains and typed-data chain
              mismatches, and keep hardware behind the device.
            </p>
            <p className="mt-3">Revoke leftovers in Tools → Approvals.</p>
          </>
        ),
      },
      {
        q: 'Does 1337 block phishing sites and scam addresses?',
        a: (
          <>
            <p>
              Not with a live blocklist. Rabby and MetaMask invest more here (known-phishing lists,
              address reputation). 1337 shows the full dapp URL, checksum warnings, and SIWE domain
              checks, and stays local-first instead of phoning a reputation API by default.
            </p>
            <p className="mt-3">
              You still need to check the domain, even when a green badge exists. A list is a bonus,
              not a substitute for hardware on size.
            </p>
          </>
        ),
      },
      {
        q: 'What does “local simulation” actually tell me?',
        a: (
          <>
            <p>
              Whether the call is likely to pass, revert, or fail, plus gas. It does not promise a
              full “you will receive X tokens” preview. That needs a simulation service MetaMask and
              Rabby sometimes bolt on. We would rather say pass/fail honestly than invent a balance
              diff a public RPC cannot provide.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'build',
    title: 'How the software is built',
    items: [
      {
        q: 'How do I know the install is not a backdoor?',
        a: (
          <>
            <p>
              Use the official{' '}
              <Link href={SITE.chromeStoreUrl} className={linkClass} target="_blank" rel="noopener noreferrer">
                Chrome Web Store listing
              </Link>
              . Do not sideload a zip from Discord or anywhere else.
            </p>
            <p className="mt-3">
              The extension pages use a strict script policy (scripts shipped with the extension
              only). Sensitive bundles run in LavaMoat compartments, the same open-source isolation
              MetaMask built on, so a random npm dependency cannot freely reach your vault APIs
              unless the policy allows it. That shrinks blast radius. It does not replace hardware
              for funds you cannot lose.
            </p>
          </>
        ),
      },
      {
        q: 'What is LavaMoat, in plain language?',
        a: (
          <>
            <p>
              A seatbelt around third-party JavaScript. Each package in the protected bundles runs
              in its own box with a short list of what it may touch. After setup, most of the real
              global object is stripped so a leaked handle is less useful. MetaMask pioneered this
              in wallet-land. 1337 uses it on the background and popup, not on the thin in-page
              script that has to speak the dapp’s language (locking that down would break Uniswap).
            </p>
          </>
        ),
      },
      {
        q: 'Where should I install from?',
        a: (
          <>
            <p>
              Only the official{' '}
              <Link href={SITE.chromeStoreUrl} className={linkClass} target="_blank" rel="noopener noreferrer">
                Chrome Web Store listing
              </Link>
              . Questions and reports go to{' '}
              <Link href={SITE.discordUrl} className={linkClass} target="_blank" rel="noopener noreferrer">
                Discord
              </Link>
              {' '}or{' '}
              <Link href={SITE.xUrl} className={linkClass} target="_blank" rel="noopener noreferrer">
                @1337wallet on X
              </Link>
              . Start with a burner account until you are comfortable.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'practice',
    title: 'How to keep risk lower',
    items: [
      {
        q: 'What is the practical setup you recommend?',
        a: (
          <>
            <p>
              Software key = hot wallet for small, daily amounts. Ledger or Trezor = anything that
              would hurt. Leave Normal mode on. Turn auto-lock on if other people use the computer.
              Lock when you walk away. Back up the seed or key offline. Install from a path you
              trust.
            </p>
          </>
        ),
      },
      {
        q: 'What remaining risks should I accept?',
        a: (
          <>
            <p>
              An unlocked Chrome profile is a hot wallet. Malware or a sibling at the keyboard can
              use software keys until lock. A malicious or buggy dependency is still a supply-chain
              story. Compartments help. They do not make review unnecessary. You must trust the RPC
              you pick. Content scripts that talk to the page are intentionally less locked down so
              dapps keep working.
            </p>
            <p className="mt-3">
              None of that is unique to 1337. Hardware plus “I read the device” is how you step
              outside most of it.
            </p>
          </>
        ),
      },
      {
        q: 'Should auto-lock be on?',
        a: (
          <>
            <p>
              If the machine is yours alone and you like “stay unlocked,” you can leave it off. If
              anyone else can sit down, turn it on (idle options in Settings). Default-off is a
              convenience choice, not a claim that unlocked is safer.
            </p>
          </>
        ),
      },
    ],
  },
];
