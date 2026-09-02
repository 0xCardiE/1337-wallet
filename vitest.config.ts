import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/unit/setup.ts'],
    environment: 'node',
    restoreMocks: true,
    testTimeout: 20_000,
  },
});
