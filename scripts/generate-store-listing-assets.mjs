#!/usr/bin/env node
/**
 * Chrome Web Store listing images → brand/chrome-web-store/
 * X / OG share images → brand/social/ (`npm run social:assets`)
 *
 * Upload set (max 5 screenshots + promos): `npm run store:billboards`
 * renders scripts/store-listing-billboards.html (website 3D device).
 *
 * Extra store crops come from website/public/screenshots/features/.
 * `npm run store:frames` rebuilds icon, extras, and billboards without recapture.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'brand/chrome-web-store');
const siteShots = path.join(root, 'website/public/screenshots');
const icons = path.join(root, 'public/icons');
const py = path.join(root, 'scripts/store-listing-composite.py');
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

function runPy(args) {
  const result = spawnSync('python3', [py, ...args], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || 'python failed\n');
    process.exit(result.status ?? 1);
  }
}

function writeStorePromos() {
  const skullPng = path.join(icons, '1337-skull.png');
  const wordPng = path.join(icons, '1337-wordmark.png');
  runPy(['promo-small', skullPng, wordPng, path.join(outDir, 'promo-small-440x280.jpg')]);
  runPy(['promo-marquee', skullPng, wordPng, path.join(outDir, 'promo-marquee-1400x560.jpg')]);
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

  writeStorePromos();
  frameWebsiteStoreShots();
  await renderStoreBillboards();
  console.log(`wrote Chrome Web Store images in ${outDir}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
