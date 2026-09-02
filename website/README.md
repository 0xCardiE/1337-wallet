# 1337 Wallet — marketing site

Next.js landing page and integration docs for **1337 Wallet**.

## Pages

- `/` — landing (features, tools, video placeholder, privacy, contact/FAQ)
- `/security` — security FAQ (MetaMask / Rabby comparisons, hardware, burner keys)
- `/faq` — product FAQ
- `/integrate` — builder & AI integration guide (EIP-1193, EIP-6963, Wagmi, Ethers)

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
- Chrome Web Store URL: set `SITE.chromeStoreUrl` when published
- Contact email: set `SITE.contactEmail`
- Product video: replace placeholder in `src/components/VideoSection.tsx`
