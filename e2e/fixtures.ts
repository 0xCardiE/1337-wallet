import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';
import { extensionIdFromWorker, waitForServiceWorker } from './helpers/wallet';

type Fixtures = {
  context: BrowserContext;
  extensionId: string;
  serviceWorker: Worker;
};

export const test = base.extend<Fixtures>({
  context: async ({}, use) => {
    const pathToExtension = path.join(process.cwd(), 'dist');
    const context = await chromium.launchPersistentContext('', {
      // `chromium` channel = new headless, required for MV3 --load-extension.
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    const worker = await waitForServiceWorker(context);
    await use(worker);
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(extensionIdFromWorker(serviceWorker));
  },
});

export { expect } from '@playwright/test';
