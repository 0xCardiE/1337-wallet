#!/usr/bin/env node
/**
 * Chrome Web Store listing images → brand/chrome-web-store/
 * X / OG share images → brand/social/ (`npm run social:assets`)
 *
 * Upload set (max 5 screenshots + promos): `npm run store:billboards`
 * renders scripts/store-listing-billboards.html (website 3D device).
 *
 * Icon + website gallery frames still come from brand PNGs / marketing-frames.html.
 * `npm run store:frames` re-frames existing UI sources without launching the extension.
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
const siteShotsOnly = process.argv.includes('--site-shots');
const billboardsOnly = process.argv.includes('--billboards');
const socialOnly = process.argv.includes('--social');
const billboardsHtml = path.join(root, 'scripts/store-listing-billboards.html');
const socialDir = path.join(root, 'brand/social');
const websitePublic = path.join(root, 'website/public');

/** Chrome Web Store upload set: 5 screenshots + promo tiles. */
const STORE_BILLBOARDS = [
  { view: 'hero', dest: 'screenshot-01-hero-1280x800.jpg', w: 1280, h: 800 },
  { view: 'confirm', dest: 'screenshot-02-confirm-1280x800.jpg', w: 1280, h: 800 },
  { view: 'rpc', dest: 'screenshot-03-rpc-1280x800.jpg', w: 1280, h: 800 },
  { view: 'approvals', dest: 'screenshot-04-approvals-1280x800.jpg', w: 1280, h: 800 },
  { view: 'swap', dest: 'screenshot-05-swap-1280x800.jpg', w: 1280, h: 800 },
  { view: 'marquee', dest: 'promo-marquee-1400x560.jpg', w: 1400, h: 560 },
  { view: 'small', dest: 'promo-small-440x280.jpg', w: 440, h: 280 },
  { view: 'large', dest: 'promo-large-920x680.jpg', w: 920, h: 680 },
];

/** X / Open Graph share set: 16:9 feature tour + OG card. */
const SOCIAL_BILLBOARDS = [
  { view: 'x-hero', dest: 'x-01-hero-1200x675.jpg', w: 1200, h: 675 },
  { view: 'x-confirm', dest: 'x-02-confirm-1200x675.jpg', w: 1200, h: 675 },
  { view: 'x-rpc', dest: 'x-03-rpc-1200x675.jpg', w: 1200, h: 675 },
  { view: 'x-send', dest: 'x-04-send-1200x675.jpg', w: 1200, h: 675 },
  { view: 'x-swap', dest: 'x-05-swap-1200x675.jpg', w: 1200, h: 675 },
  { view: 'x-ens', dest: 'x-06-ens-1200x675.jpg', w: 1200, h: 675 },
  { view: 'x-multisend', dest: 'x-07-multisend-1200x675.jpg', w: 1200, h: 675 },
  { view: 'x-gas', dest: 'x-08-gas-1200x675.jpg', w: 1200, h: 675 },
  { view: 'x-burner', dest: 'x-09-burner-1200x675.jpg', w: 1200, h: 675 },
  { view: 'x-privacy', dest: 'x-10-privacy-1200x675.jpg', w: 1200, h: 675 },
  { view: 'og', dest: 'og-1200x630.jpg', w: 1200, h: 630 },
];

const SOCIAL_VIDEO_FRAMES = [
  { dest: 'x-01-hero-1200x675.jpg', hold: 2.6 },
  { dest: 'x-02-confirm-1200x675.jpg', hold: 2.15 },
  { dest: 'x-03-rpc-1200x675.jpg', hold: 2.15 },
  { dest: 'x-04-send-1200x675.jpg', hold: 2.15 },
  { dest: 'x-05-swap-1200x675.jpg', hold: 2.15 },
  { dest: 'x-06-ens-1200x675.jpg', hold: 2.15 },
  { dest: 'x-07-multisend-1200x675.jpg', hold: 2.15 },
  { dest: 'x-08-gas-1200x675.jpg', hold: 2.15 },
  { dest: 'x-09-burner-1200x675.jpg', hold: 2.15 },
  { dest: 'x-10-privacy-1200x675.jpg', hold: 2.8 },
];

/** Flat UI crops kept as extras. Chrome listing upload set is STORE_BILLBOARDS. */
const SITE_STORE_SHOTS = [
  ['features/confirm-summary.png', 'screenshot-01-confirm-1280x800.jpg'],
  ['features/assets.png', 'screenshot-02-assets-1280x800.jpg'],
  ['features/rpc.png', 'screenshot-03-rpc-1280x800.jpg'],
  ['features/swap.png', 'screenshot-04-swap-1280x800.jpg'],
  ['features/confirm-hardware.png', 'screenshot-05-hardware-1280x800.jpg'],
  ['features/approvals.png', 'screenshot-06-approvals-1280x800.jpg'],
  ['features/history.png', 'screenshot-07-history-1280x800.jpg'],
  ['features/multisend.png', 'screenshot-08-multisend-1280x800.jpg'],
  ['features/ens-manage.png', 'screenshot-09-ens-1280x800.jpg'],
  ['features/doctor.png', 'screenshot-10-doctor-1280x800.jpg'],
];

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
    theme: 'forest',
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
    theme: 'moss',
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
    theme: 'forest',
    kicker: '> lifi.quote',
    headline: 'MULTICHAIN SWAP|NO EXTRA FEES',
    sub: 'LI.FI route, then you sign. No extra tab required.',
  },
  {
    raw: '07-multisend.png',
    store: 'screenshot-07-multisend-1280x800.jpg',
    site: 'multisend.jpg',
    theme: 'forest',
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
    theme: 'moss',
    kicker: '> transfer.send',
    headline: 'SEND WITHOUT|LEAVING ASSETS',
    sub: 'Recipient and amount inline. Confirm in the same flow.',
  },
  {
    raw: 'history.png',
    fallback: 'history.jpg',
    site: 'history.jpg',
    theme: 'forest',
    kicker: '> history.decode',
    headline: 'YOUR TXS.|PLAIN LANGUAGE.',
    sub: 'Explorer key in, human rows out. Open the hash on Etherscan.',
  },
  {
    raw: 'ens.png',
    fallback: 'ens.jpg',
    site: 'ens.jpg',
    theme: 'moss',
    kicker: '> ens.manage',
    headline: 'NAMES|YOU OWN',
    sub: '.eth names, expiry, and content hashes.',
  },
  {
    raw: 'gas.png',
    fallback: 'gas.jpg',
    site: 'gas.jpg',
    theme: 'moss',
    kicker: '> gas.station',
    headline: 'TOP UP GAS.|PAY USDC.',
    sub: 'Native token when you are stuck on the chain you need.',
  },
  {
    raw: 'accounts.png',
    fallback: 'accounts.jpg',
    site: 'accounts.jpg',
    theme: 'lime',
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
    const skullPng = path.join(icons, '1337-skull.png');
    const wordPng = path.join(icons, '1337-wordmark.png');
    runPy(['promo-small', skullPng, wordPng, path.join(outDir, 'promo-small-440x280.jpg')]);
    runPy(['promo-marquee', skullPng, wordPng, path.join(outDir, 'promo-marquee-1400x560.jpg')]);

    const browser = await chromium.launch({ channel: 'chromium' });
    const page = await browser.newPage();
    try {
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
      const dest = path.join(siteShots, frame.site);
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

function frameWebsiteStoreShots() {
  mkdirSync(outDir, { recursive: true });
  for (const [rel, destName] of SITE_STORE_SHOTS) {
    const src = path.join(siteShots, rel);
    if (!existsSync(src)) {
      console.warn(`skip ${rel}: missing`);
      continue;
    }
    const dest = path.join(outDir, destName);
    runPy(['frame-ui', src, dest]);
    console.log('wrote', dest);
  }
}

async function renderBillboardSet(boards, destDir) {
  mkdirSync(destDir, { recursive: true });
  const html = pathToFileURL(billboardsHtml).href;
  const browser = await chromium.launch({ channel: 'chromium' });
  try {
    const page = await browser.newPage({
      viewport: { width: boards[0]?.w ?? 1280, height: boards[0]?.h ?? 800 },
      deviceScaleFactor: 2,
    });
    for (const board of boards) {
      await page.setViewportSize({ width: board.w, height: board.h });
      await page.goto(`${html}?view=${board.view}`, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.evaluate(async () => {
        await document.fonts.ready.catch(() => {});
        await Promise.all(
          [...document.images].map(img =>
            img.complete
              ? Promise.resolve()
              : new Promise(resolve => {
                  img.addEventListener('load', resolve, { once: true });
                  img.addEventListener('error', resolve, { once: true });
                }),
          ),
        );
      });
      await page.waitForTimeout(200);
      const tmp = path.join(destDir, `.tmp-${board.view}.png`);
      await page.screenshot({ path: tmp, type: 'png', animations: 'disabled' });
      const dest = path.join(destDir, board.dest);
      runPy(['resize-jpg', tmp, dest, String(board.w), String(board.h)]);
      rmSync(tmp, { force: true });
      console.log('wrote', dest);
    }
  } finally {
    await browser.close();
  }
}

async function renderStoreBillboards() {
  await renderBillboardSet(STORE_BILLBOARDS, outDir);
}

function renderSocialVideo(destDir) {
  const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (ffmpeg.status !== 0) {
    console.warn('skip social video: ffmpeg not found');
    return;
  }
  const fade = 0.3;
  const inputs = [];
  for (const frame of SOCIAL_VIDEO_FRAMES) {
    const src = path.join(destDir, frame.dest);
    if (!existsSync(src)) {
      console.warn(`skip social video: missing ${frame.dest}`);
      return;
    }
    inputs.push('-loop', '1', '-t', String(frame.hold), '-i', src);
  }
  const prep = SOCIAL_VIDEO_FRAMES.map(
    (_, i) =>
      `[${i}:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=30,format=yuv420p[v${i}]`,
  );
  const fades = [];
  let last = 'v0';
  let offset = 0;
  for (let i = 1; i < SOCIAL_VIDEO_FRAMES.length; i += 1) {
    offset += SOCIAL_VIDEO_FRAMES[i - 1].hold - fade;
    const next = i === SOCIAL_VIDEO_FRAMES.length - 1 ? 'vout' : `f${i}`;
    fades.push(`[${last}][v${i}]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(3)}[${next}]`);
    last = next;
  }
  const dest = path.join(destDir, '1337-features-1280x720.mp4');
  const result = spawnSync(
    'ffmpeg',
    [
      '-y',
      ...inputs,
      '-filter_complex',
      [...prep, ...fades].join(';'),
      '-map',
      '[vout]',
      '-an',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '18',
      '-profile:v',
      'high',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      dest,
    ],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || 'ffmpeg failed\n');
    process.exit(result.status ?? 1);
  }
  console.log('wrote', dest);
}

async function renderSocialBillboards() {
  await renderBillboardSet(SOCIAL_BILLBOARDS, socialDir);
  const ogSrc = path.join(socialDir, 'og-1200x630.jpg');
  const ogDest = path.join(websitePublic, 'og.jpg');
  if (existsSync(ogSrc)) {
    copyFileSync(ogSrc, ogDest);
    console.log('wrote', ogDest);
  }
  renderSocialVideo(socialDir);
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  mkdirSync(sourceDir, { recursive: true });
  const iconSrc = path.join(icons, 'icon-128.png');
  runPy(['icon', iconSrc, path.join(outDir, 'store-icon-128.png')]);

  if (socialOnly) {
    await renderSocialBillboards();
    return;
  }

  if (billboardsOnly) {
    await renderStoreBillboards();
    return;
  }

  if (siteShotsOnly) {
    frameWebsiteStoreShots();
    await renderStoreBillboards();
    return;
  }

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
  frameWebsiteStoreShots();
  await renderStoreBillboards();
  console.log(`wrote Chrome Web Store images in ${outDir}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
