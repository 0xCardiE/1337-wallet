import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

const distDir = path.join(process.cwd(), 'dist');
const built = existsSync(path.join(distDir, 'background.js'))
  && existsSync(path.join(distDir, 'index.html'));

if (!built) {
  throw new Error(
    'Extension build missing. Run `npm run build` (or `npm run icons && npm run build`) before `npm run test:e2e`.',
  );
}

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
