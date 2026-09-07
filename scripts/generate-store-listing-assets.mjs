#!/usr/bin/env node
/**
 * Chrome Web Store listing images → brand/chrome-web-store/
 * Icon + promo tiles from brand PNGs; screenshots from a live unpacked dist/.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'brand/chrome-web-store');
const icons = path.join(root, 'public/icons');
const py = path.join(root, 'scripts/store-listing-composite.py');

const E2E_MNEMONIC =
  'test test test test test test test test test test test junk';
const E2E_PASSWORD = '1337-e2e-password';
const E2E_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

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

async function openWallet(context, extensionId) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 420, height: 760 });
  await page.goto(`chrome-extension://${extensionId}/index.html`);
  return page;
}

async function shot(page, dest) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: dest, type: 'png', animations: 'disabled' });
}

async function captureScreens(rawDir) {
  const distDir = path.join(root, 'dist');
  if (!existsSync(path.join(distDir, 'background.js'))) npmBuild();

  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [`--disable-extensions-except=${distDir}`, `--load-extension=${distDir}`],
  });

  try {
    const worker = await waitForServiceWorker(context);
    const extensionId = new URL(worker.url()).host;
    const page = await openWallet(context, extensionId);

    await page.getByRole('tab', { name: 'Create' }).waitFor();
    await shot(page, path.join(rawDir, '01-onboarding.png'));

    await page.getByRole('tab', { name: 'Import' }).click();
    await page.getByTestId('onboarding-password').fill(E2E_PASSWORD);
    await page.getByTestId('onboarding-password-confirm').fill(E2E_PASSWORD);
    await page.getByTestId('onboarding-secret').fill(E2E_MNEMONIC);
    await page.getByTestId('onboarding-submit').click();
    await page.getByTestId('wallet-tab-assets').waitFor({ timeout: 20_000 });
    await shot(page, path.join(rawDir, '02-assets.png'));

    const dapp = await context.newPage();
    await dapp.goto('https://example.com');
    await dapp.waitForFunction(
      () => typeof window.ethereum?.request === 'function',
      null,
      { timeout: 20_000 },
    );
    await dapp.evaluate(() => window.ethereum.request({ method: 'eth_requestAccounts' }));

    const pending = dapp
      .evaluate(
        ({ addr }) =>
          window.ethereum.request({
            method: 'personal_sign',
            params: ['Sign in to example.com', addr],
          }),
        { addr: E2E_ADDRESS },
      )
      .catch(() => {});
    await page.bringToFront();
    await page.getByTestId('tx-approve').waitFor();
    await shot(page, path.join(rawDir, '03-confirm.png'));
    await page.getByTestId('tx-reject').click();
    await pending;
    const dismiss = page.getByRole('button', { name: 'Dismiss' });
    if (await dismiss.count()) await dismiss.click();
    await page.getByTestId('tx-approve').waitFor({ state: 'hidden' });

    await page.getByTestId('wallet-tab-tools').click();
    await page.getByTestId('tools-tab-signings').waitFor();
    await shot(page, path.join(rawDir, '04-tools.png'));

    await page.getByTestId('tools-tab-multisend').click();
    await page.getByTestId('tools-tab-multisend').waitFor();
    await shot(page, path.join(rawDir, '05-multisend.png'));
  } finally {
    await context.close();
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
    await captureScreens(rawDir);
    const shots = [
      ['01-onboarding.png', 'screenshot-01-onboarding-1280x800.jpg'],
      ['02-assets.png', 'screenshot-02-assets-1280x800.jpg'],
      ['03-confirm.png', 'screenshot-03-confirm-1280x800.jpg'],
      ['04-tools.png', 'screenshot-04-tools-1280x800.jpg'],
      ['05-multisend.png', 'screenshot-05-multisend-1280x800.jpg'],
    ];
    for (const [raw, named] of shots) {
      const dest = path.join(outDir, named);
      runPy(['screenshot', path.join(rawDir, raw), dest]);
    }
    const siteShots = path.join(root, 'website/public/screenshots');
    mkdirSync(siteShots, { recursive: true });
    const siteNames = [
      ['screenshot-01-onboarding-1280x800.jpg', 'onboarding.jpg'],
      ['screenshot-02-assets-1280x800.jpg', 'assets.jpg'],
      ['screenshot-03-confirm-1280x800.jpg', 'confirm.jpg'],
      ['screenshot-04-tools-1280x800.jpg', 'tools.jpg'],
      ['screenshot-05-multisend-1280x800.jpg', 'multisend.jpg'],
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
