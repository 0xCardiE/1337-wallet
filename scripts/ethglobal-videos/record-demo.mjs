import { chromium } from '@playwright/test';
import { mkdtempSync, readFileSync, copyFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeFunctionData, maxUint256 } from 'viem';
import { DEMO_SEGMENTS } from './narration.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const distDir = path.join(root, 'dist');
const rawDir = path.join(root, 'brand/ethglobal/raw');
const dappHtml = readFileSync(path.join(root, 'scripts/ethglobal-videos/dapp.html'), 'utf8');

const E2E_PASSWORD = 'leet-demo-99';
const E2E_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const E2E_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const SPENDER = '0x1111111111111111111111111111111111111111';

function loadManifest() {
  const p = path.join(root, 'brand/ethglobal/audio/manifest.json');
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

function holdMsFor(id, fallback) {
  const man = loadManifest();
  const seg = man?.demo?.segments?.find(s => s.id === id);
  if (!seg) return fallback;
  return Math.ceil(seg.duration * 1000) + 550;
}

async function waitForServiceWorker(context) {
  const existing = context.serviceWorkers()[0];
  if (existing) return existing;
  return context.waitForEvent('serviceworker', { timeout: 30_000 });
}

async function holdRemaining(page, startedAt, id, fallback = 5000) {
  const ms = holdMsFor(id, fallback);
  const used = Date.now() - startedAt;
  const wait = Math.max(450, ms - used);
  await page.waitForTimeout(wait);
}

async function clickChain(wallet) {
  await wallet
    .locator('.w1337-dd')
    .filter({ has: wallet.locator('.w1337-dd__label', { hasText: /^Chain$/ }) })
    .locator('.w1337-dd__trigger')
    .click();
  await wallet.locator('.w1337-dd__option-label').filter({ hasText: /^Base$/ }).click();
}

async function clickOtherRpc(wallet) {
  await wallet
    .locator('.w1337-dd')
    .filter({ has: wallet.locator('.w1337-dd__label', { hasText: /^RPC$/ }) })
    .locator('.w1337-dd__trigger')
    .click();
  const other = wallet.locator('[role="option"][aria-selected="false"]').first();
  if (await other.count()) await other.click();
  else await wallet.keyboard.press('Escape');
}

export async function recordDemo() {
  if (!existsSync(path.join(distDir, 'index.html')) || !existsSync(path.join(distDir, 'background.js'))) {
    throw new Error('dist/ missing. Run npm run build first.');
  }
  mkdirSync(rawDir, { recursive: true });
  const userData = mkdtempSync(path.join(tmpdir(), '1337-demo-'));
  const context = await chromium.launchPersistentContext(userData, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 400, height: 720 },
    deviceScaleFactor: 1,
    recordVideo: { dir: rawDir, size: { width: 400, height: 720 } },
    args: [
      `--disable-extensions-except=${distDir}`,
      `--load-extension=${distDir}`,
    ],
    slowMo: 35,
  });

  const markers = [];
  const startedAt = Date.now();
  const mark = id => markers.push({ id, t: (Date.now() - startedAt) / 1000 });

  try {
    const worker = await waitForServiceWorker(context);
    const extensionId = new URL(worker.url()).host;

    await context.route('https://acme-dex.example/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: dappHtml,
      });
    });

    for (const page of context.pages()) {
      await page.close();
    }

    const wallet = await context.newPage();
    await wallet.setViewportSize({ width: 400, height: 720 });
    await wallet.goto(`chrome-extension://${extensionId}/index.html`);
    mark('title');
    const titleAt = Date.now();
    await wallet.getByRole('tab', { name: 'Create' }).waitFor({ timeout: 20_000 });
    await holdRemaining(wallet, titleAt, 'title', 8000);

    mark('onboard');
    const onboardAt = Date.now();
    await wallet.getByRole('tab', { name: 'Import' }).click();
    await wallet.getByRole('tab', { name: 'Private key' }).click();
    await wallet.getByTestId('onboarding-password').pressSequentially(E2E_PASSWORD, { delay: 45 });
    await wallet.getByTestId('onboarding-password-confirm').pressSequentially(E2E_PASSWORD, { delay: 35 });
    await wallet.getByTestId('onboarding-secret').fill(E2E_PK);
    await wallet.getByTestId('onboarding-terms').check();
    await wallet.getByTestId('onboarding-submit').click();
    await wallet.getByTestId('wallet-tab-assets').waitFor({ timeout: 25_000 });
    await holdRemaining(wallet, onboardAt, 'onboard', 7000);

    mark('assets');
    const assetsAt = Date.now();
    try {
      await clickChain(wallet);
      await wallet.waitForTimeout(1200);
      await clickOtherRpc(wallet);
      await wallet.waitForTimeout(800);
      const doctor = wallet.getByRole('button', { name: 'Doctor' });
      if (await doctor.isVisible()) {
        await doctor.click();
        await wallet.getByRole('dialog', { name: /Network doctor/i }).waitFor({ timeout: 8_000 });
        await wallet.waitForTimeout(2200);
        await wallet.locator('.w1337-sheet-back').click({ timeout: 3_000 }).catch(async () => {
          await wallet.keyboard.press('Escape');
        });
      }
    } catch (e) {
      console.warn('assets tour:', e.message);
    }
    await holdRemaining(wallet, assetsAt, 'assets', 9000);

    mark('tools');
    const toolsAt = Date.now();
    await wallet.getByTestId('wallet-tab-tools').click();
    for (const id of ['approvals', 'swap', 'ens', 'multisend', 'gas']) {
      const tab = wallet.getByTestId(`tools-tab-${id}`);
      if (await tab.count()) {
        await tab.click();
        await wallet.waitForTimeout(1100);
      }
    }
    await holdRemaining(wallet, toolsAt, 'tools', 8000);

    mark('privacy');
    const privacyAt = Date.now();
    await wallet.getByTestId('open-settings').click();
    await wallet.getByText(/Privacy & data|Private by design|No analytics/i).first().waitFor({ timeout: 8_000 });
    await wallet.getByText(/Privacy & data|No analytics SDK/i).last().scrollIntoViewIfNeeded().catch(() => {});
    await holdRemaining(wallet, privacyAt, 'privacy', 7000);
    await wallet.getByRole('button', { name: 'Close' }).click();
    await wallet.getByTestId('wallet-tab-assets').waitFor({ timeout: 8_000 });

    const dapp = await context.newPage();
    await dapp.setViewportSize({ width: 400, height: 720 });
    await dapp.goto('https://acme-dex.example/');
    await dapp.waitForFunction(
      () => typeof window.ethereum?.request === 'function',
      null,
      { timeout: 20_000 },
    );
    await wallet.setViewportSize({ width: 400, height: 720 });
    await wallet.bringToFront();
    await dapp.getByRole('button', { name: 'Connect wallet' }).click();
    await wallet.bringToFront();
    const connectApprove = wallet.getByTestId('tx-approve');
    if (await connectApprove.isVisible({ timeout: 2500 }).catch(() => false)) {
      await connectApprove.click();
    }
    await wallet.waitForTimeout(800);

    mark('approve');
    const approveAt = Date.now();
    const approveData = encodeFunctionData({
      abi: [
        {
          name: 'approve',
          type: 'function',
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [{ type: 'bool' }],
        },
      ],
      functionName: 'approve',
      args: [SPENDER, maxUint256],
    });
    const approvePending = dapp.evaluate(
      async ({ from, to, data }) => {
        try {
          await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{ from, to, data }],
          });
        } catch (e) {
          return String(e && e.message ? e.message : e);
        }
      },
      { from: E2E_ADDRESS, to: USDC, data: approveData },
    );
    await wallet.getByTestId('tx-reject').waitFor({ timeout: 20_000 });
    await wallet.setViewportSize({ width: 400, height: 720 });
    await wallet.waitForTimeout(1200);
    await holdRemaining(wallet, approveAt, 'approve', 10000);
    await wallet.getByTestId('tx-reject').click();
    await approvePending.catch(() => {});

    mark('siwe');
    const siweAt = Date.now();
    const siwePending = dapp.evaluate(async from => {
      const siwe = `evil.com wants you to sign in with your Ethereum account:
${from}

URI: https://evil.com
Version: 1
Chain ID: 1
Nonce: demo
Issued At: 2026-09-19T00:00:00.000Z`;
      try {
        await window.ethereum.request({ method: 'personal_sign', params: [siwe, from] });
      } catch (e) {
        return String(e && e.message ? e.message : e);
      }
    }, E2E_ADDRESS);
    await wallet.getByTestId('tx-reject').waitFor({ timeout: 20_000 });
    await holdRemaining(wallet, siweAt, 'siwe', 7000);
    await wallet.getByTestId('tx-reject').click();
    await siwePending.catch(() => {});

    mark('end');
    const endAt = Date.now();
    await wallet.getByTestId('wallet-tab-tools').click();
    await wallet.getByTestId('tools-tab-signings').click().catch(() => {});
    await holdRemaining(wallet, endAt, 'end', 6000);

    writeFileSync(path.join(rawDir, 'demo-markers.json'), JSON.stringify({ markers, segments: DEMO_SEGMENTS }, null, 2));

    const walletVideo = wallet.video();
    await dapp.close();
    await wallet.close();
    const src = walletVideo ? await walletVideo.path() : null;
    await context.close();
    if (!src || !existsSync(src)) throw new Error('Playwright did not write a wallet video');
    const dest = path.join(rawDir, 'demo-wallet.webm');
    copyFileSync(src, dest);
    console.log('wrote', dest);
    return dest;
  } catch (err) {
    await context.close().catch(() => {});
    throw err;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  recordDemo().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
