import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E config for sistema-modular.
 *
 * Pre-requisitos:
 *   1. Levantar el dev server: pnpm dev (puerto 3001)
 *   2. Hacer login manual una vez: pnpm e2e:setup
 *   3. Correr los tests: pnpm e2e
 */

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/global-setup.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'e2e-report', open: 'never' }],
    ['json', { outputFile: 'e2e-report/results.json' }],
    ['list'],
  ],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
