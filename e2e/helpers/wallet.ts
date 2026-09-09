import type { BrowserContext, Page, Worker } from '@playwright/test';
import { expect } from '@playwright/test';
import { E2E_MNEMONIC, E2E_PASSWORD } from './constants';

export async function waitForServiceWorker(context: BrowserContext): Promise<Worker> {
  const existing = context.serviceWorkers()[0];
  if (existing) return existing;
  return context.waitForEvent('serviceworker', { timeout: 30_000 });
}

export function extensionIdFromWorker(worker: Worker): string {
  const id = new URL(worker.url()).host;
  if (!id) throw new Error(`Could not read extension id from ${worker.url()}`);
  return id;
}

export async function openWalletPage(
  context: BrowserContext,
  extensionId: string,
): Promise<Page> {
  const page = await context.newPage();
  await page.setViewportSize({ width: 420, height: 760 });
  await page.goto(`chrome-extension://${extensionId}/index.html`);
  return page;
}

/**
 * Import the Anvil test phrase through the real onboarding UI.
 * We do not seed chrome.storage from the service worker — LavaMoat scuttles
 * Playwright's `worker.evaluate` (`eval`).
 */
export async function importWalletViaOnboarding(
  page: Page,
  opts?: { mnemonic?: string; password?: string },
): Promise<void> {
  const password = opts?.password ?? E2E_PASSWORD;
  await expect(page.getByRole('tab', { name: 'Import' })).toBeVisible();
  await page.getByRole('tab', { name: 'Import' }).click();
  await page.getByTestId('onboarding-password').fill(password);
  await page.getByTestId('onboarding-password-confirm').fill(password);
  await page.getByTestId('onboarding-secret').fill(opts?.mnemonic ?? E2E_MNEMONIC);
  await page.getByTestId('onboarding-terms').check();
  await page.getByTestId('onboarding-submit').click();
  await expect(page.getByTestId('wallet-tab-assets')).toBeVisible({ timeout: 20_000 });
}

export async function unlockWallet(page: Page, password = E2E_PASSWORD): Promise<void> {
  await expect(page.getByTestId('unlock-password')).toBeVisible();
  await page.getByTestId('unlock-password').fill(password);
  await page.getByTestId('unlock-submit').click();
  await expect(page.getByTestId('wallet-tab-assets')).toBeVisible({ timeout: 20_000 });
}

export async function lockFromSettings(page: Page): Promise<void> {
  await page.getByTestId('open-settings').click();
  await page.getByTestId('settings-lock').click();
  await expect(page.getByTestId('unlock-password')).toBeVisible();
}

export async function enableBurnerMode(page: Page): Promise<void> {
  const toggle = page.getByTestId('burner-toggle').first();
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('aria-pressed')) === 'true') return;
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
}

export async function enableTool(page: Page, toolId: string): Promise<void> {
  await page.getByTestId('open-settings').click();
  await page.getByTestId('settings-tools-open').click();
  await page.locator(`#tool-${toolId}`).check();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
}

export async function openUnlockedWallet(
  context: BrowserContext,
  extensionId: string,
  opts?: { instant?: boolean },
): Promise<Page> {
  const page = await openWalletPage(context, extensionId);
  await importWalletViaOnboarding(page);
  if (opts?.instant) await enableBurnerMode(page);
  return page;
}
