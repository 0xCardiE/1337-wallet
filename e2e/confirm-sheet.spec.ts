import { encodeFunctionData, maxUint256 } from 'viem';
import { E2E_ADDRESS } from './helpers/constants';
import { openDappPage, providerRequest, providerRequestError } from './helpers/dapp';
import { openUnlockedWallet } from './helpers/wallet';
import { expect, test } from './fixtures';

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const SPENDER = '0x1111111111111111111111111111111111111111';

test.describe('confirm sheet', () => {
  test('personal_sign can be rejected and approved', async ({
    context,
    extensionId,
  }) => {
    const wallet = await openUnlockedWallet(context, extensionId);
    const dapp = await openDappPage(context);
    await providerRequest(dapp, 'eth_requestAccounts');

    const rejected = providerRequestError(dapp, 'personal_sign', ['hello from e2e', E2E_ADDRESS]);
    await expect(wallet.getByTestId('tx-reject')).toBeVisible();
    await expect(wallet.locator('body')).toContainText(/sign a message|hello from e2e/i);
    await wallet.getByTestId('tx-reject').click();
    const rejectErr = await rejected;
    expect(rejectErr.code).toBe(4001);

    const signed = providerRequest(dapp, 'personal_sign', ['hello from e2e', E2E_ADDRESS]);
    await expect(wallet.getByTestId('tx-approve')).toBeVisible();
    await wallet.getByTestId('tx-approve').click();
    const sig = await signed;
    expect(typeof sig).toBe('string');
    expect(sig).toMatch(/^0x[0-9a-fA-F]{130}$/);
  });

  test('SIWE domain mismatch is called out before sign', async ({
    context,
    extensionId,
  }) => {
    const wallet = await openUnlockedWallet(context, extensionId);
    const dapp = await openDappPage(context);
    await providerRequest(dapp, 'eth_requestAccounts');

    const siwe = `evil.com wants you to sign in with your Ethereum account:
${E2E_ADDRESS}

URI: https://evil.com
Version: 1
Chain ID: 1
Nonce: e2e
Issued At: 2026-01-01T00:00:00.000Z`;

    const pending = providerRequestError(dapp, 'personal_sign', [siwe, E2E_ADDRESS]);
    await expect(wallet.getByTestId('tx-reject')).toBeVisible();
    await expect(wallet.locator('body')).toContainText(/does not match this page|evil\.com/i);
    await wallet.getByTestId('tx-reject').click();
    expect((await pending).code).toBe(4001);
  });

  test('unlimited approve shows a human summary and can be rejected', async ({
    context,
    extensionId,
  }) => {
    const wallet = await openUnlockedWallet(context, extensionId);
    const dapp = await openDappPage(context);
    await providerRequest(dapp, 'eth_requestAccounts');

    const data = encodeFunctionData({
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

    const pending = providerRequestError(dapp, 'eth_sendTransaction', [
      { from: E2E_ADDRESS, to: USDC, data },
    ]);
    await expect(wallet.getByTestId('tx-reject')).toBeVisible();
    await expect(wallet.locator('body')).toContainText(/unlimited|approve|spend/i);
    await wallet.getByTestId('tx-reject').click();
    expect((await pending).code).toBe(4001);
  });

  test('Burner Mode auto-signs an ordinary message', async ({
    context,
    extensionId,
  }) => {
    const wallet = await openUnlockedWallet(context, extensionId, {
      instant: true,
    });
    const dapp = await openDappPage(context);
    await providerRequest(dapp, 'eth_requestAccounts');

    const sig = await providerRequest(dapp, 'personal_sign', ['ordinary hello', E2E_ADDRESS]);
    expect(sig).toMatch(/^0x[0-9a-fA-F]{130}$/);
    await expect(wallet.getByTestId('tx-approve')).toHaveCount(0);
  });
});
