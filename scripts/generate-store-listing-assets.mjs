#!/usr/bin/env node
/**
 * Chrome Web Store listing images → brand/chrome-web-store/
 * Icon + promo tiles from brand PNGs; screenshots from a live unpacked dist/
 * plus populated marketing mocks (LavaMoat blocks evaluate inside the extension).
 *
 * Billboard frames (headline + glowing UI) are rendered from
 * scripts/marketing-frames.html. `node scripts/generate-store-listing-assets.mjs --frames-only`
 * re-frames existing UI sources without launching the extension.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'brand/chrome-web-store');
const sourceDir = path.join(root, 'brand/screenshot-sources');
const siteShots = path.join(root, 'website/public/screenshots');
const icons = path.join(root, 'public/icons');
const py = path.join(root, 'scripts/store-listing-composite.py');
const mocksHtml = path.join(root, 'scripts/marketing-wallet-mocks.html');
const framesHtml = path.join(root, 'scripts/marketing-frames.html');
const framesOnly = process.argv.includes('--frames-only');

const STORE_FRAMES = [
  {
    raw: '01-onboarding.png',
    store: 'screenshot-01-onboarding-1280x800.jpg',
    site: 'onboarding.jpg',
    theme: 'lime',
    kicker: '> vault.encrypt',
    headline: 'KEYS|STAY HERE',
    sub: 'Create or import a seed or key. Encrypted on this machine.',
  },
  {
    raw: '02-assets.png',
    store: 'screenshot-02-assets-1280x800.jpg',
    site: 'assets.jpg',
    theme: 'cyan',
    kicker: '> assets.list',
    headline: 'YOUR RPC.|YOUR CALL.',
    sub: 'Balances on each chain. Switch endpoint when you need to.',
  },
  {
    raw: '03-confirm.png',
    store: 'screenshot-03-confirm-1280x800.jpg',
    site: 'confirm.jpg',
    theme: 'amber',
    kicker: '> confirm.simulate',
    headline: 'READ IT.|THEN SIGN.',
    sub: 'Human summary, local simulate, then reject or confirm.',
  },
  {
    raw: '04-signings.png',
    store: 'screenshot-04-signings-1280x800.jpg',
    site: 'signings.jpg',
    theme: 'magenta',
    kicker: '> signings.log',
    headline: 'WHAT YOU|ACTUALLY SIGNED',
    sub: 'SIWE, permits, and typed data — kept on this device.',
  },
  {
    raw: '05-approvals.png',
    store: 'screenshot-05-approvals-1280x800.jpg',
    site: 'approvals.jpg',
    theme: 'alert',
    kicker: '> allowances.burn',
    headline: 'REVOKE WHAT|YOU APPROVED',
    sub: 'ERC-20, NFT, and Permit2 allowances from one list.',
  },
  {
    raw: '06-swap.png',
    store: 'screenshot-06-swap-1280x800.jpg',
    site: 'swap.jpg',
    theme: 'violet',
    kicker: '> lifi.quote',
    headline: 'SWAP IN|THE SIGNER',
    sub: 'LI.FI route, then you sign. No extra tab required.',
  },
  {
    raw: '07-multisend.png',
    store: 'screenshot-07-multisend-1280x800.jpg',
    site: 'multisend.jpg',
    theme: 'ice',
    kicker: '> disperse.send',
    headline: 'ONE TX.|MANY ADDRESSES.',
    sub: 'Disperse.app batch. Leftover native refunded to you.',
  },
];

const SITE_EXTRA_FRAMES = [
  {
    raw: 'assets-send.png',
    fallback: 'assets-send.jpg',
    site: 'assets-send.jpg',
    theme: 'teal',
    kicker: '> transfer.send',
    headline: 'SEND WITHOUT|LEAVING ASSETS',
    sub: 'Recipient and amount inline. Confirm in the same flow.',
  },
  {
    raw: 'assets-empty.png',
    fallback: 'assets-empty.jpg',
    site: 'assets-empty.jpg',
    theme: 'void',
    kicker: '> balances.none',
    headline: 'EMPTY CHAIN.|SWITCH.',
    sub: 'Add a token or jump to a network that has a balance.',
  },
  {
    raw: 'history.png',
    fallback: 'history.jpg',
    site: 'history.jpg',
    theme: 'indigo',
    kicker: '> history.decode',
    headline: 'YOUR TXS.|PLAIN LANGUAGE.',
    sub: 'Explorer key in, human rows out. Open the hash on Etherscan.',
  },
  {
    raw: 'ens.png',
    fallback: 'ens.jpg',
    site: 'ens.jpg',
    theme: 'blue',
    kicker: '> ens.manage',
    headline: 'NAMES|YOU OWN',
    sub: '.eth names, expiry, and Swarm content hashes.',
  },
  {
    raw: 'gas.png',
    fallback: 'gas.jpg',
    site: 'gas.jpg',
    theme: 'orange',
    kicker: '> gas.station',
    headline: 'TOP UP GAS.|PAY USDC.',
    sub: 'Native token when you are stuck on the chain you need.',
  },
  {
    raw: 'accounts.png',
    fallback: 'accounts.jpg',
    site: 'accounts.jpg',
    theme: 'term',
    kicker: '> accounts.switch',
    headline: 'SEED.|HARDWARE.|BURNER.',
    sub: 'Local, imported, Ledger, and Trezor in one switcher.',
  },
  {
    raw: 'settings.png',
    fallback: 'settings.jpg',
    site: 'settings.jpg',
    theme: 'char',
    kicker: '> settings.cfg',
    headline: 'NETWORKS.|TOOLS.|LOCK.',
    sub: 'RPCs, burner mode, connected sites — all on this device.',
  },
];

const E2E_MNEMONIC =
  'test test test test test test test test test test test junk';
const E2E_PASSWORD = '1337-e2e-password';

function runPy(args) {
  const result = spawnSync('python3', [py, ...args], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || 'python failed\n');
    process.exit(result.status ?? 1);
  }
}

function npmBuild() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const built = spawnSync(npm, ['run', 'build'], { cwd: root, stdio: 'inherit' });
  if (built.status !== 0) process.exit(built.status ?? 1);
}

async function waitForServiceWorker(context) {
  const existing = context.serviceWorkers()[0];
  if (existing) return existing;
  return context.waitForEvent('serviceworker', { timeout: 30_000 });
}

async function shot(page, dest) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: dest, type: 'png', animations: 'disabled' });
}

async function waitImages(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(400);
}

async function captureLive(rawDir) {
  const distDir = path.join(root, 'dist');
  if (!existsSync(path.join(distDir, 'background.js'))) npmBuild();

  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [`--disable-extensions-except=${distDir}`, `--load-extension=${distDir}`],
  });

  try {
    const worker = await waitForServiceWorker(context);
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.setViewportSize({ width: 420, height: 760 });
    await page.goto(`chrome-extension://${extensionId}/index.html`);

    await page.getByRole('tab', { name: 'Create' }).waitFor();
    await shot(page, path.join(rawDir, '01-onboarding.png'));

    await page.getByRole('tab', { name: 'Import' }).click();
    await page.getByTestId('onboarding-password').fill(E2E_PASSWORD);
    await page.getByTestId('onboarding-password-confirm').fill(E2E_PASSWORD);
    await page.getByTestId('onboarding-secret').fill(E2E_MNEMONIC);
    await page.getByTestId('onboarding-terms').check();
    await page.getByTestId('onboarding-submit').click();
    await page.getByTestId('wallet-tab-assets').waitFor({ timeout: 20_000 });

    await page.getByTestId('wallet-tab-tools').click();
    await page.getByTestId('tools-tab-swap').click();
    await page.locator('.w1337-exchange-card').waitFor({ timeout: 25_000 });
    await page.waitForTimeout(2000);
    const toCell = page.locator('.w1337-pair-cell').nth(1);
    if (await toCell.count()) {
      await toCell.click();
      const search = page.getByPlaceholder('Search token or address');
      if (await search.count()) {
        await search.fill('USDC');
        await page.waitForTimeout(400);
        const usdc = page.getByRole('button', { name: /USDC/i }).first();
        if (await usdc.count()) await usdc.click();
        else await page.keyboard.press('Escape');
      }
    }
    const amount = page.locator('.w1337-amount-massive');
    if (await amount.count()) await amount.fill('0.42');
    await page.waitForTimeout(400);
    await shot(page, path.join(rawDir, '06-swap.png'));

    await page.getByTestId('tools-tab-multisend').click();
    await page.locator('#ms-addrs').waitFor({ timeout: 10_000 });
    await page.locator('#ms-addrs').click();
    await page.locator('#ms-addrs').fill(
      [
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      ].join('\n'),
    );
    await page.locator('#ms-amt').click();
    await page.locator('#ms-amt').fill('0.05');
    await page.waitForTimeout(500);
    await shot(page, path.join(rawDir, '07-multisend.png'));
  } finally {
    await context.close();
  }
}

async function captureMocks(rawDir) {
  const browser = await chromium.launch({ channel: 'chromium' });
  const page = await browser.newPage({ viewport: { width: 420, height: 760 } });
  try {
    for (const [view, dest] of [
      ['assets', '02-assets.png'],
      ['confirm', '03-confirm.png'],
      ['signings', '04-signings.png'],
      ['approvals', '05-approvals.png'],
    ]) {
      await page.goto(`${pathToFileURL(mocksHtml).href}?view=${view}`);
      await waitImages(page);
      await shot(page, path.join(rawDir, dest));
    }
  } finally {
    await browser.close();
  }
}

function ensureUiSource(rawName, candidates) {
  const dest = path.join(sourceDir, rawName);
  if (existsSync(dest)) return dest;
  for (const candidate of candidates) {
    if (!candidate || !existsSync(candidate)) continue;
    runPy(['extract-ui', candidate, dest]);
    if (existsSync(dest)) return dest;
  }
  return null;
}

function frameUrl(params) {
  const url = new URL(pathToFileURL(framesHtml).href);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.href;
}

async function renderFrame(page, dest, params, size) {
  await page.setViewportSize(size);
  await page.goto(frameUrl(params), { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    await document.fonts.ready.catch(() => {});
    await Promise.all(
      [...document.images].map(img =>
        img.complete ? Promise.resolve() : new Promise(resolve => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        }),
      ),
    );
  });
  await page.waitForTimeout(150);
  await page.screenshot({
    path: dest,
    type: 'jpeg',
    quality: 92,
    animations: 'disabled',
  });
}

async function renderListingFrames() {
  mkdirSync(sourceDir, { recursive: true });
  mkdirSync(siteShots, { recursive: true });

  const skull = pathToFileURL(path.join(icons, '1337-skull.png')).href;
  const word = pathToFileURL(path.join(icons, '1337-wordmark.png')).href;
  const browser = await chromium.launch({ channel: 'chromium' });
  const page = await browser.newPage();
  try {
    await renderFrame(
      page,
      path.join(outDir, 'promo-small-440x280.jpg'),
      {
        layout: 'small',
        theme: 'lime',
        kicker: 'EVM SIGNER',
        headline: '1337',
        skull,
      },
      { width: 440, height: 280 },
    );
    await renderFrame(
      page,
      path.join(outDir, 'promo-marquee-1400x560.jpg'),
      {
        layout: 'marquee',
        theme: 'lime',
        kicker: '> 1337.wallet',
        headline: 'AN EVM WALLET|FOR HACKERS',
        sub: 'Self-custody signer · no analytics · no tracking server',
        skull,
        word,
      },
      { width: 1400, height: 560 },
    );

    for (const frame of STORE_FRAMES) {
      const ui = ensureUiSource(frame.raw, [
        path.join(sourceDir, frame.raw),
        path.join(outDir, frame.store),
        path.join(siteShots, frame.site),
      ]);
      if (!ui) {
        console.warn(`skip ${frame.raw}: no UI source`);
        continue;
      }
      const dest = path.join(outDir, frame.store);
      await renderFrame(
        page,
        dest,
        {
          layout: 'shot',
          theme: frame.theme,
          kicker: frame.kicker,
          headline: frame.headline,
          sub: frame.sub,
          shot: pathToFileURL(ui).href,
          skull,
        },
        { width: 1280, height: 800 },
      );
      copyFileSync(dest, path.join(siteShots, frame.site));
    }

    for (const frame of SITE_EXTRA_FRAMES) {
      const ui = ensureUiSource(frame.raw, [
        path.join(sourceDir, frame.raw),
        path.join(siteShots, frame.fallback),
      ]);
      if (!ui) {
        console.warn(`skip ${frame.raw}: no UI source`);
        continue;
      }
      await renderFrame(
        page,
        path.join(siteShots, frame.site),
        {
          layout: 'shot',
          theme: frame.theme,
          kicker: frame.kicker,
          headline: frame.headline,
          sub: frame.sub,
          shot: pathToFileURL(ui).href,
          skull,
        },
        { width: 1280, height: 800 },
      );
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  mkdirSync(sourceDir, { recursive: true });
  const iconSrc = path.join(icons, 'icon-128.png');
  runPy(['icon', iconSrc, path.join(outDir, 'store-icon-128.png')]);

  if (!framesOnly) {
    const rawDir = mkdtempSync(path.join(tmpdir(), '1337-cws-'));
    try {
      await captureLive(rawDir);
      await captureMocks(rawDir);
      for (const frame of STORE_FRAMES) {
        const captured = path.join(rawDir, frame.raw);
        if (existsSync(captured)) copyFileSync(captured, path.join(sourceDir, frame.raw));
      }
    } finally {
      rmSync(rawDir, { recursive: true, force: true });
    }
  }

  await renderListingFrames();
  console.log(`wrote Chrome Web Store images in ${outDir}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
