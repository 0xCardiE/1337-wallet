import type { BrowserContext, Page } from '@playwright/test';

export async function openDappPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForFunction(() => {
    const w = window as Window & { ethereum?: { request?: unknown } };
    return typeof w.ethereum?.request === 'function';
  }, null, { timeout: 20_000 });
  return page;
}

export async function providerRequest(
  page: Page,
  method: string,
  params?: unknown,
): Promise<unknown> {
  return page.evaluate(
    async ({ method: m, params: p }) => {
      const eth = (window as Window & { ethereum?: { request: (a: unknown) => Promise<unknown> } })
        .ethereum;
      if (!eth?.request) throw new Error('window.ethereum is missing');
      return eth.request({ method: m, params: p });
    },
    { method, params },
  );
}

export async function providerRequestError(
  page: Page,
  method: string,
  params?: unknown,
): Promise<{ code?: number; message: string }> {
  return page.evaluate(
    async ({ method: m, params: p }) => {
      const eth = (window as Window & { ethereum?: { request: (a: unknown) => Promise<unknown> } })
        .ethereum;
      if (!eth?.request) throw new Error('window.ethereum is missing');
      try {
        await eth.request({ method: m, params: p });
        return { message: 'expected provider error' };
      } catch (e) {
        const err = e as { code?: number; message?: string };
        return { code: err.code, message: err.message ?? String(e) };
      }
    },
    { method, params },
  );
}

export async function providerFlags(page: Page): Promise<{
  is1337?: boolean;
  isMetaMask?: boolean;
}> {
  return page.evaluate(() => {
    const eth = window as Window & { ethereum?: { is1337?: boolean; isMetaMask?: boolean } };
    return { is1337: eth.ethereum?.is1337, isMetaMask: eth.ethereum?.isMetaMask };
  });
}
