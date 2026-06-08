// Playwright config for the real-app e2e suite. Specs match *.e2e.ts under e2e/ and drive the built
// Electron app (out/), so globalSetup builds it first. Electron cannot be parallelized across windows
// safely here, so workers are pinned to 1. This is intentionally separate from Vitest (unit/jsdom).

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  globalSetup: './e2e/support/global-setup.ts',
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  }
})
