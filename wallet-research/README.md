# Wallet Pain Research

Source crypto wallet complaints from **Reddit**, **Google/web**, and **X** into a local corpus, auto-tag them, then export for LLM analysis.

Insight replies for @1337wallet live in the sibling tool `wallet-outreach` (`npm run wallet-outreach` from the repo root). This corpus tool is unchanged.

No manual approval needed. The database is just a file you paste into Cursor / ChatGPT.

## Quick start

```bash
cd wallet-research
npm install
npm run dev          # UI at http://localhost:5174
```

Or CLI-only:

```bash
npm run search                          # Reddit + Google
npm run search -- --sources reddit,x    # include X (needs session)
npm run export                          # writes exports/wallet-pain-*.md
```

## Workflow

1. **Collect** — batch search (UI or `npm run search`)
2. **Inspect** — browse / filter posts in the UI (optional)
3. **Export** — copy corpus or `npm run export`, paste into an LLM
4. **Analyze** — ask the LLM for top pain themes & product opportunities

Local DB: `data/store.json`  
Exports: `exports/` (gitignored)

## Sources

| Source | Needs | Notes |
|--------|-------|-------|
| Reddit | nothing | Arctic Shift archive API |
| Google/web | nothing | Bing RSS (+ DuckDuckGo fallback) |
| X | login session | unofficial GraphQL via saved cookies |

### X session (optional)

You need cookies named **`auth_token`** and **`ct0`** — not `__cf_bm` / `_cuid`.

1. Open **x.com** in regular Chrome while **logged in**
2. DevTools → Application → Cookies → `https://x.com`
3. **Scroll** the list until you see `auth_token` and `ct0`
4. Paste them in the UI, or:

```bash
X_AUTH_TOKEN=... X_CT0=... npm run x:cookies
```

Browser login alternative: `npm run x:setup && npm run x:login`

## CLI reference

```bash
# Search
npm run search -- --sources reddit,google,x --time year
npm run search -- -q reddit-metamask,reddit-ethdev

# Export for LLM
npm run export                              # compact markdown → exports/
npm run export -- --filter relevant         # wallet-relevant posts only
npm run export -- --format json -o exports/corpus.json
npm run export -- --filter high-pain
npm run export -- --filter developer_integration --limit 100

# Drop noise already in the store
npm run prune -- --dry-run                  # preview
npm run prune                               # write store.json
```

## Noise controls

New searches apply a **relevance gate** (wallet/crypto anchor + pain language) before saving.
X queries use dedicated `xQuery` strings instead of stripped Google boolean soup.
Arctic Shift seeds prefer wallet terms (`metamask`, `wallet`, …) never bare `help`/`problem`.

## Customize queries

Edit `server/queries.ts` or toggle queries in the UI sidebar.
Optional per-query `xQuery` is used when searching X.
