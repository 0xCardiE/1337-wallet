import { E2E_MNEMONIC, E2E_PASSWORD, E2E_PK } from './helpers/constants';
import { openWalletPage } from './helpers/wallet';
import { expect, test } from './fixtures';

test.describe('onboarding', () => {
  test('create with seed phrase reaches the backup screen then Assets', async ({
    context,
    extensionId,
  }) => {
    const page = await openWalletPage(context, extensionId);
    await expect(page.getByRole('tab', { name: 'Create' })).toBeVisible();
    await page.getByTestId('onboarding-password').fill(E2E_PASSWORD);
    await page.getByTestId('onboarding-password-confirm').fill(E2E_PASSWORD);
    await expect(page.getByTestId('onboarding-submit')).toBeDisabled();
    await page.getByTestId('onboarding-terms').check();
    await page.getByTestId('onboarding-submit').click();
    await expect(page.getByRole('heading', { name: /Back up your seed phrase/i })).toBeVisible();
    await expect(page.locator('.mono')).toContainText(/\w+ \w+ \w+/);
    await page.getByTestId('onboarding-continue').click();
    await expect(page.getByTestId('wallet-tab-assets')).toBeVisible();
  });

  test('import seed phrase unlocks the known test account', async ({
    context,
    extensionId,
  }) => {
    const page = await openWalletPage(context, extensionId);
    await page.getByRole('tab', { name: 'Import' }).click();
    await page.getByTestId('onboarding-password').fill(E2E_PASSWORD);
    await page.getByTestId('onboarding-password-confirm').fill(E2E_PASSWORD);
    await page.getByTestId('onboarding-secret').fill(E2E_MNEMONIC);
    await page.getByTestId('onboarding-terms').check();
    await page.getByTestId('onboarding-submit').click();
    await expect(page.getByTestId('wallet-tab-assets')).toBeVisible();
    await expect(page.locator('body')).toContainText(/0xf39F|E2E|2266/i);
  });

  test('import private key works and mismatched passwords are rejected', async ({
    context,
    extensionId,
  }) => {
    const page = await openWalletPage(context, extensionId);
    await page.getByRole('tab', { name: 'Import' }).click();
    await page.getByRole('tab', { name: 'Private key' }).click();
    await page.getByTestId('onboarding-password').fill(E2E_PASSWORD);
    await page.getByTestId('onboarding-password-confirm').fill('different-password');
    await page.getByTestId('onboarding-secret').fill(E2E_PK);
    await page.getByTestId('onboarding-terms').check();
    await page.getByTestId('onboarding-submit').click();
    await expect(page.locator('.error')).toContainText(/do not match/i);

    await page.getByTestId('onboarding-password-confirm').fill(E2E_PASSWORD);
    await page.getByTestId('onboarding-submit').click();
    await expect(page.getByTestId('wallet-tab-assets')).toBeVisible();
  });
});
