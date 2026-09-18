# 1337 Wallet — marketing site

Next.js landing page and integration docs for **1337 Wallet**.

## Pages

- `/` — landing (feature screenshots, privacy, contact/FAQ)
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

Static files land in `website/out/` (`output: "export"`). nginx on 1337wallet.io serves that folder.

## Deploy

Production is `https://1337wallet.io` — nginx root `/var/www/1337-wallet/website/out`.

Pushes to `main` that touch `website/` run `.github/workflows/website.yml`: build on GitHub Actions, then rsync `out/` to the server. Use **Actions → Deploy website → Run workflow** for a manual deploy.

From this machine (SSH key already on the server):

```bash
npm run website:deploy
```

Do not put SSH passwords or private keys in the repo. The Actions key is GitHub secret `WEBSITE_DEPLOY_KEY`.

## Customize

- Copy & links: `src/lib/site.ts`
- Chrome Web Store URL: `SITE.chromeStoreUrl`
- Discord: `SITE.discordUrl`
- X: `SITE.xUrl`
- Feature tour copy: `src/lib/site.ts` (`PRODUCT_FEATURES`)
- Live UI captures for the landing gallery: `public/screenshots/features/` (not overwritten by store frames)
- Chrome Web Store billboards: `npm run store:assets` from the repo root copies framed cards into `public/screenshots/`. `npm run store:frames` re-renders those from `brand/screenshot-sources/`
- Feature gallery: `src/components/VideoSection.tsx`
