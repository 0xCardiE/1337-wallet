import { E2E_ADDRESS } from './helpers/constants';
import { openDappPage, providerFlags, providerRequest, providerRequestError } from './helpers/dapp';
import { openUnlockedWallet } from './helpers/wallet';
import { expect, test } from './fixtures';

test.describe('dapp provider', () => {
  test('injects window.ethereum and connects without a confirm sheet', async ({
    context,
    extensionId,
  }) => {
    const wallet = await openUnlockedWallet(context, extensionId);
    const dapp = await openDappPage(context);

    const flags = await providerFlags(dapp);
    expect(flags.is1337).toBe(true);
    expect(flags.isMetaMask).toBe(true);

    const chainId = await providerRequest(dapp, 'eth_chainId');
    expect(chainId).toBe('0x1');

    const accounts = await providerRequest(dapp, 'eth_requestAccounts');
    expect(accounts).toEqual([E2E_ADDRESS]);
    await expect(wallet.getByTestId('tx-approve')).toHaveCount(0);

    const again = await providerRequest(dapp, 'eth_accounts');
    expect(again).toEqual([E2E_ADDRESS]);
  });

  test('rejects eth_sign with 4200', async ({ context, extensionId }) => {
    await openUnlockedWallet(context, extensionId);
    const dapp = await openDappPage(context);
    await providerRequest(dapp, 'eth_requestAccounts');
    const err = await providerRequestError(dapp, 'eth_sign', [
      E2E_ADDRESS,
      '0x68656c6c6f',
    ]);
    expect(err.code).toBe(4200);
    expect(err.message).toMatch(/eth_sign is disabled/i);
  });

  test('switches to a catalogued chain without a confirm sheet', async ({
    context,
    extensionId,
  }) => {
    await openUnlockedWallet(context, extensionId);
    const dapp = await openDappPage(context);
    await providerRequest(dapp, 'eth_requestAccounts');
    await providerRequest(dapp, 'wallet_switchEthereumChain', [{ chainId: '0x2105' }]);
    expect(await providerRequest(dapp, 'eth_chainId')).toBe('0x2105');
  });

  test('answers wallet_getCapabilities without advertising atomic batching', async ({
    context,
    extensionId,
  }) => {
    await openUnlockedWallet(context, extensionId);
    const dapp = await openDappPage(context);
    await providerRequest(dapp, 'eth_requestAccounts');
    const caps = (await providerRequest(dapp, 'wallet_getCapabilities', [
      E2E_ADDRESS,
    ])) as Record<string, Record<string, unknown>>;
    expect(caps['0x1']).toEqual({});
    expect(caps['0xa4b1']).toEqual({});
    expect(caps['0x1']).not.toHaveProperty('atomic');
  });

  test('rejects NFT wallet_watchAsset with 4200', async ({ context, extensionId }) => {
    await openUnlockedWallet(context, extensionId);
    const dapp = await openDappPage(context);
    await providerRequest(dapp, 'eth_requestAccounts');
    const err = await providerRequestError(dapp, 'wallet_watchAsset', {
      type: 'ERC721',
      options: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    });
    expect(err.code).toBe(4200);
    expect(err.message).toMatch(/NFT|ERC-20/i);
  });
});
