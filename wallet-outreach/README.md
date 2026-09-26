# @1337wallet replies

Watches X for talk about wallets, wallet security, and transactions, then drafts a reply from @1337wallet.

- **Note** — a reply about what that person actually wrote. No two replies use the same text.
- **Plug** — names 1337 and the site, only when they are choosing a wallet.

Posts with no likes or replies are held, along with promo and all-caps blasts. A reply is for someone who already has a small audience.

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
- **Posting without Approve is on.** With autopilot on, suggested replies go out. Turn that off to send only ones you marked Approve.
- New installs cap at 50 posts a day. After each reply the next wait is picked at random between 4 and 16 minutes. **Send for real** is a manual send and ignores the cap and the wait.
- Reddit search is off unless you turn it on. A Reddit reply is copied to the clipboard and the thread opens so you can paste it. X is the account this tool posts as.

## Auth

Stored in `wallet-outreach/data/` (gitignored).

**X** — cookies `auth_token` and `ct0` from x.com while logged in as @1337wallet. If outreach has no session, it reuses the wallet-research session file, which has to be that same account.

**Reddit** — no login in this tool. Open the thread from a draft and paste the copied reply while you are logged in on Reddit.

`npm run x:setup` installs Chromium for X search and replies.
