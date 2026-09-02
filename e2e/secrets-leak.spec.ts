import type { Request } from '@playwright/test';
import { E2E_MNEMONIC, E2E_PK } from './helpers/constants';
import { openDappPage, providerRequest } from './helpers/dapp';
import { openUnlockedWallet } from './helpers/wallet';
import { expect, test } from './fixtures';

const SECRETS = [
  E2E_MNEMONIC,
  E2E_PK,
  E2E_PK.slice(2),
  E2E_PK.toLowerCase(),
  E2E_PK.slice(2).toLowerCase(),
];

function requestBlob(req: Request): string {
  const headers = req.headers();
  const headerText = Object.entries(headers)
    .filter(([k]) => k.toLowerCase() !== 'cookie')
    .map(([k, v]) => `${k}:${v}`)
    .join('\n');
  return `${req.url()}\n${req.method()}\n${req.postData() ?? ''}\n${headerText}`;
}

test.describe('secrets leak', () => {
  test('mnemonic and private key never leave the machine over the network', async ({
    context,
    extensionId,
  }) => {
    const hits: string[] = [];
    context.on('request', req => {
      const blob = requestBlob(req).toLowerCase();
      for (const secret of SECRETS) {
        if (blob.includes(secret.toLowerCase())) {
          hits.push(`${req.method()} ${req.url()}`);
        }
      }
    });

    const wallet = await openUnlockedWallet(context, extensionId);
    await wallet.getByTestId('wallet-tab-history').click();
    await wallet.getByTestId('wallet-tab-tools').click();
    await wallet.getByTestId('tools-tab-signings').click();
    await wallet.getByTestId('tools-tab-approvals').click();
    await wallet.getByTestId('open-settings').click();
    await expect(wallet.getByTestId('settings-lock')).toBeVisible();

    const dapp = await openDappPage(context);
    await providerRequest(dapp, 'eth_requestAccounts');
    await providerRequest(dapp, 'eth_chainId');

    expect(hits, `secrets appeared on the wire: ${hits.join(', ')}`).toEqual([]);
  });
});
