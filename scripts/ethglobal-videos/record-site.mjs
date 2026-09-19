import { chromium } from '@playwright/test';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rawDir = path.join(root, 'brand/ethglobal/raw');

export async function recordSite() {
  mkdirSync(rawDir, { recursive: true });
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    recordVideo: { dir: rawDir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  try {
    await page.goto('https://1337wallet.io/', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(2400);

    async function scrollBy(px, ms) {
      const steps = Math.max(1, Math.ceil(ms / 40));
      const dy = px / steps;
      for (let i = 0; i < steps; i += 1) {
        await page.mouse.wheel(0, dy);
        await page.waitForTimeout(40);
      }
    }

    await scrollBy(700, 4000);
    await page.waitForTimeout(1200);
    const confirm = page.locator('a.feature-pitch__item', { hasText: 'Confirm' }).first();
    if (await confirm.count()) {
      await confirm.click();
      await page.waitForTimeout(2800);
    } else {
      await page.evaluate(() => document.querySelector('#confirm')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      await page.waitForTimeout(2200);
    }
    await scrollBy(900, 5000);
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.querySelector('#privacy')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    await page.waitForTimeout(2800);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(2200);

    const video = page.video();
    await page.close();
    const src = video ? await video.path() : null;
    await context.close();
    await browser.close();
    if (!src || !existsSync(src)) throw new Error('No website video');
    const dest = path.join(rawDir, 'site.webm');
    copyFileSync(src, dest);
    console.log('wrote', dest);
    return dest;
  } catch (err) {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    throw err;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  recordSite().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
