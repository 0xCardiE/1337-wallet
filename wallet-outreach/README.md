# @1337wallet replies

Watches X for talk about wallets, wallet security, and transactions, then drafts a reply from @1337wallet.

- **Note** — a reply about what that person actually wrote. No two replies use the same text.
- **Plug** — names 1337 and the site, only when they are choosing a wallet.

Quiet posts (few or no likes) are the ones worth a reply. A post that already has a crowd is held.

Seed-phrase threads and Bitcoin-only posts are held.

Post from the [@1337wallet](https://x.com/1337wallet) session. Pain research stays in wallet-research.

## Run

```bash
cd wallet-outreach
npm install
npm test
npm run dev          # UI http://localhost:5175
```

From the repo root: `npm run wallet-outreach`.

## What the loop does

Each tick searches the next complaint (privacy, RPC, confirm, approval, account). If a post clears the bar, it drafts an insight. With autopilot on, it sends one reply.

- **Dry run is on by default.** The log records the post it would reply to and does not call X.
- **Autopilot is off by default.** It runs only while `npm run dev` or `npm run loop` is open.
- **Auto-approve is off.** With autopilot alone, only drafts you marked Approve are sent.
- New installs cap at 2 posts a day, 3 hours apart. **Post now** is a manual send and ignores the cap.
- Reddit is off unless you turn it on. X is the account this tool posts as.

## Auth

Stored in `wallet-outreach/data/` (gitignored).

**X** — cookies `auth_token` and `ct0` from x.com while logged in as @1337wallet. If outreach has no session, it reuses the wallet-research session file, which has to be that same account.

**Reddit** — optional. A script app on reddit.com/prefs/apps.

`npm run x:setup` installs Chromium for X search and replies.
