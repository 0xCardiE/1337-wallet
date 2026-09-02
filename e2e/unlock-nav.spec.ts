import { E2E_PASSWORD } from './helpers/constants';
import {
  importWalletViaOnboarding,
  lockFromSettings,
  openUnlockedWallet,
  openWalletPage,
  unlockWallet,
} from './helpers/wallet';
import { expect, test } from './fixtures';

test.describe('unlock and navigation', () => {
  test('wrong password stays locked', async ({ context, extensionId }) => {
    const page = await openWalletPage(context, extensionId);
    await importWalletViaOnboarding(page);
    await lockFromSettings(page);
    await page.getByTestId('unlock-password').fill('not-the-password');
    await page.getByTestId('unlock-submit').click();
    await expect(page.locator('.unlock-error')).toContainText(/wrong password|corrupted/i);
    await expect(page.getByTestId('wallet-tab-assets')).toHaveCount(0);
  });

  test('unlock, switch tabs, lock, unlock again', async ({ context, extensionId }) => {
    const page = await openUnlockedWallet(context, extensionId);
    await expect(page.getByTestId('wallet-tab-assets')).toHaveAttribute('aria-current', 'page');

    await page.getByTestId('wallet-tab-history').click();
    await expect(page.getByTestId('wallet-tab-history')).toHaveAttribute('aria-current', 'page');

    await page.getByTestId('wallet-tab-tools').click();
    await expect(page.getByTestId('wallet-tab-tools')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('tools-tab-inspect')).toBeVisible();
    await expect(page.getByTestId('tools-tab-approvals')).toBeVisible();
    await expect(page.getByTestId('tools-tab-multisend')).toBeVisible();

    await lockFromSettings(page);
    await unlockWallet(page, E2E_PASSWORD);
    await expect(page.getByTestId('wallet-tab-assets')).toBeVisible();
  });
});
