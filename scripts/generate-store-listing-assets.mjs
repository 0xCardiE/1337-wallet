#!/usr/bin/env node
/**
 * Chrome Web Store listing images → brand/chrome-web-store/
 * Icon + promo tiles from brand PNGs; screenshots from a live unpacked dist/
 * plus populated marketing mocks (LavaMoat blocks evaluate inside the extension).
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'brand/chrome-web-store');
const icons = path.join(root, 'public/icons');
const py = path.join(root, 'scripts/store-listing-composite.py');
const mocksHtml = path.join(root, 'scripts/marketing-wallet-mocks.html');

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

async function main() {
  mkdirSync(outDir, { recursive: true });
  const skull = path.join(icons, '1337-skull.png');
  const word = path.join(icons, '1337-wordmark.png');
  const iconSrc = path.join(icons, 'icon-128.png');

  runPy(['icon', iconSrc, path.join(outDir, 'store-icon-128.png')]);
  runPy(['promo-small', skull, word, path.join(outDir, 'promo-small-440x280.jpg')]);
  runPy(['promo-marquee', skull, word, path.join(outDir, 'promo-marquee-1400x560.jpg')]);

  const rawDir = mkdtempSync(path.join(tmpdir(), '1337-cws-'));
  try {
    await captureLive(rawDir);
    await captureMocks(rawDir);
    const shots = [
      ['01-onboarding.png', 'screenshot-01-onboarding-1280x800.jpg'],
      ['02-assets.png', 'screenshot-02-assets-1280x800.jpg'],
      ['03-confirm.png', 'screenshot-03-confirm-1280x800.jpg'],
      ['04-signings.png', 'screenshot-04-signings-1280x800.jpg'],
      ['05-approvals.png', 'screenshot-05-approvals-1280x800.jpg'],
      ['06-swap.png', 'screenshot-06-swap-1280x800.jpg'],
      ['07-multisend.png', 'screenshot-07-multisend-1280x800.jpg'],
    ];
    for (const [raw, named] of shots) {
      runPy(['screenshot', path.join(rawDir, raw), path.join(outDir, named)]);
    }
    const siteShots = path.join(root, 'website/public/screenshots');
    mkdirSync(siteShots, { recursive: true });
    const siteNames = [
      ['screenshot-01-onboarding-1280x800.jpg', 'onboarding.jpg'],
      ['screenshot-02-assets-1280x800.jpg', 'assets.jpg'],
      ['screenshot-03-confirm-1280x800.jpg', 'confirm.jpg'],
      ['screenshot-04-signings-1280x800.jpg', 'signings.jpg'],
      ['screenshot-05-approvals-1280x800.jpg', 'approvals.jpg'],
      ['screenshot-06-swap-1280x800.jpg', 'swap.jpg'],
      ['screenshot-07-multisend-1280x800.jpg', 'multisend.jpg'],
    ];
    for (const [from, to] of siteNames) {
      copyFileSync(path.join(outDir, from), path.join(siteShots, to));
    }
  } finally {
    rmSync(rawDir, { recursive: true, force: true });
  }

  console.log(`wrote Chrome Web Store images in ${outDir}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
