# 1337 Wallet — marketing site

Next.js landing page and integration docs for **1337 Wallet**.

## Pages

- `/` — landing (features, tools, screenshots, privacy, contact/FAQ)
- `/privacy` — privacy policy (Chrome Web Store privacy-policy URL)
- `/terms` — terms of use (self-custody tool; no fund guarantee)
- `/security` — security FAQ (MetaMask / Rabby comparisons, hardware, burner keys)
- `/faq` — product FAQ
- `/integrate` — builder & AI integration guide (EIP-1193, EIP-6963, Wagmi, Ethers)
- `/rpc` — supported / missing provider methods and what dapps fall back to

## Development

From repo root:

```bash
npm run website
```

Or from this folder:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run website:build
```

## Customize

- Copy & links: `src/lib/site.ts`
- Chrome Web Store URL: `SITE.chromeStoreUrl`
- Discord: `SITE.discordUrl`
- Screenshots: `npm run store:assets` from the repo root copies store cards into `public/screenshots/`. `npm run store:frames` re-renders the billboard frames from `brand/screenshot-sources/`
- How-it-works gallery: `src/components/VideoSection.tsx`
