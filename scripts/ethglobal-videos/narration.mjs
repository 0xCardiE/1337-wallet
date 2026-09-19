/** Spoken lines for macOS `say`. Write "leet" so it is not read as a number. */

export const DEMO_VOICE = 'Daniel';
export const PITCH_VOICE = 'Daniel';
export const DEMO_RATE = 152;
export const PITCH_RATE = 150;

export const DEMO_SEGMENTS = [
  {
    id: 'title',
    caption: 'A signer you actually read.',
    sub: 'Live product · Chrome extension',
    speak:
      'This is leet. [[slnc 420]] A Chrome extension you sign with. [[slnc 280]] Not a slide deck. The live product.',
  },
  {
    id: 'onboard',
    caption: 'Vault on this machine.',
    sub: 'Password encrypted. No 1337 account.',
    speak:
      'The vault is created on this machine. Password encrypted. There is no leet account, and no leet server.',
  },
  {
    id: 'assets',
    caption: 'Chain and RPC in the header.',
    sub: 'We do not run an RPC.',
    speak:
      'Assets. Pick the chain. Pick the R P C. If an endpoint dies, switch it. Doctor probes chain I D. We do not run an R P C of our own.',
  },
  {
    id: 'tools',
    caption: 'Tools you use with the signer.',
    sub: 'Approvals, swap, ENS, multisend.',
    speak:
      'Tools are things you do with the signer. Approvals to revoke. Swaps. E N S. Multisend through Disperse. Not a Foundry lab.',
  },
  {
    id: 'privacy',
    caption: 'Private by design.',
    sub: 'No analytics. Not now, not later.',
    speak:
      'Private by design. No analytics. No tracking. The vault stays in Chrome storage on this device.',
  },
  {
    id: 'approve',
    caption: 'See the request. Then sign.',
    sub: 'Unlimited USDC approve — in English.',
    speak:
      'Here is the job. A dapp asks for an unlimited U S D C approve. The confirm sheet says so in English. Local simulation: pass, fail, revert, or gas. Reject it.',
  },
  {
    id: 'siwe',
    caption: 'Phishing gets called out.',
    sub: 'Domain mismatch before you sign.',
    speak:
      'A phishing sign-in. The domain does not match this page. Called out before you sign.',
  },
  {
    id: 'end',
    caption: 'Install, then read the sheet.',
    sub: '1337wallet.io',
    speak:
      'Install leet. Connect a dapp you already use. Read the sheet. Then sign. leet wallet dot i o.',
  },
];

export const PITCH_SEGMENTS = [
  {
    id: 'intro',
    caption: 'Marko · built 1337',
    sub: 'A signer, not a lab',
    speak: 'I am Marko. I built leet.',
  },
  {
    id: 'problem',
    caption: 'Stop signing blind.',
    sub: 'Most wallets hide the request. Labs are not the job.',
    speak:
      'I was tired of two kinds of wallets. Ones that flatten the confirm screen until you cannot tell what you are signing. And ones that turn into labs: A B I playgrounds, storage inspectors, converters. That is not the daily job.',
  },
  {
    id: 'job',
    caption: 'Understand. Judge. Sign.',
    sub: 'Then live with the result.',
    speak:
      'The daily job is: understand the request, judge the risk, sign or reject, then live with the result.',
  },
  {
    id: 'product',
    caption: 'Human summary. Local simulate.',
    sub: 'Seed, key, Ledger, or Trezor.',
    speak:
      'So I built a signer. Chrome extension. Every request gets a human summary, a local eth call simulation, and contract danger flags. Keys stay on your machine: seed, imported key, Ledger, or Trezor.',
  },
  {
    id: 'privacy',
    caption: 'Private by design.',
    sub: 'No 1337 server. No analytics. Never.',
    speak:
      'There is no leet server. No analytics. Not now, not later. Privacy only holds when nobody in the middle has the power to break it.',
  },
  {
    id: 'whyme',
    caption: 'A real product. Open source.',
    sub: 'Chrome Web Store · I use it myself.',
    speak:
      'I ship this as a real product. It is on the Chrome Web Store. The code is open source. And I use it myself.',
  },
  {
    id: 'close',
    caption: 'Read the sheet. Then sign.',
    sub: '1337wallet.io',
    speak:
      'If you already sign, install leet, and read the sheet. That is the whole pitch.',
  },
];

export const DEMO_NARRATION_HUMAN = `This is 1337. A Chrome extension you sign with. Not a slide deck. The live product.

The vault is created on this machine. Password encrypted. There is no 1337 account, and no 1337 server.

Assets. Pick the chain. Pick the RPC. If an endpoint dies, switch it. Doctor probes chainId. We do not run an RPC of our own.

Tools are things you do with the signer. Approvals to revoke. Swaps. ENS. Multisend through Disperse. Not a Foundry lab.

Private by design. No analytics. No tracking. The vault stays in Chrome storage on this device.

Here is the job. A dapp asks for an unlimited USDC approve. The confirm sheet says so in English. Local simulation: pass, fail, revert, or gas. Reject it.

A phishing sign-in. The domain does not match this page. Called out before you sign.

Install 1337. Connect a dapp you already use. Read the sheet. Then sign. 1337wallet.io
`;

export const PITCH_NARRATION_HUMAN = `I'm Marko. I built 1337.

I was tired of two kinds of wallets. Ones that flatten the confirm screen until you cannot tell what you're signing. And ones that turn into labs: ABI playgrounds, storage inspectors, converters. That is not the daily job.

The daily job is: understand the request, judge the risk, sign or reject, then live with the result.

So I built a signer. Chrome extension. Every request gets a human summary, a local eth_call simulation, and contract danger flags. Keys stay on your machine: seed, imported key, Ledger, or Trezor.

There is no 1337 server. No analytics. Not now, not later. Privacy only holds when nobody in the middle has the power to break it.

I ship this as a real product. It is on the Chrome Web Store. The code is open source. And I use it myself.

If you already sign, install 1337, and read the sheet. That's the whole pitch.
`;
