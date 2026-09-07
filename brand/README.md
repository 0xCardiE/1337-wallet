# Brand & product manifest

`product.manifest.json` is the **single source of truth** for:

- Product positioning (developer / hacker / advanced Ethereum wallet)
- Privacy and no-analytics claims
- Chrome Web Store description drafts and listing assets (`brand/chrome-web-store/`, `npm run store:assets`)
- Onboarding and Settings copy (imported via `src/lib/productManifest.ts`)
- Future website, landing page, or promo material

Edit the JSON first, then wire new strings through `productManifest.ts` if they appear in the extension UI.

**Privacy claims must stay accurate.** The wallet talks to public RPCs, LI.FI, optional explorer APIs, and hardware SDKs when *you* use those features — but there is no 1337 backend, analytics SDK, or user database.
