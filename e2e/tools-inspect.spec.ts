import { E2E_ADDRESS } from './helpers/constants';
import { enableTool, openUnlockedWallet } from './helpers/wallet';
import { expect, test } from './fixtures';

test.describe('Tools', () => {
  test('Signings is the default tool and Inspect is hidden until enabled', async ({
    context,
    extensionId,
  }) => {
    const page = await openUnlockedWallet(context, extensionId);
    await page.getByTestId('wallet-tab-tools').click();
    await expect(page.getByTestId('tools-tab-signings')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('signings-empty')).toBeVisible();
    await expect(page.getByTestId('tools-tab-inspect')).toHaveCount(0);
  });

  test('Inspect accepts an address without crashing', async ({
    context,
    extensionId,
  }) => {
    const page = await openUnlockedWallet(context, extensionId);
    await enableTool(page, 'inspect');
    await page.getByTestId('wallet-tab-tools').click();
    await page.getByTestId('tools-tab-inspect').click();
    await page.getByTestId('inspect-input').fill(E2E_ADDRESS);
    await page.getByTestId('inspect-submit').click();
    await expect(page.locator('.w1337-inspect__card, .error').first()).toBeVisible({
      timeout: 25_000,
    });
  });

  test('Multisend tool is reachable', async ({ context, extensionId }) => {
    const page = await openUnlockedWallet(context, extensionId);
    await page.getByTestId('wallet-tab-tools').click();
    await page.getByTestId('tools-tab-multisend').click();
    await expect(page.getByTestId('tools-tab-multisend')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('body')).toContainText(/address|recipient|disperse|paste/i);
  });
});
