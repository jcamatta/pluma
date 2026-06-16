// Playwright config for the performance suite. Distinct from the e2e config (which matches *.e2e.ts):
// here scenarios live in e2e/perf/scenarios as *.perf.ts and drive the built app to *measure*, never to
// assert — a perf run always passes, and judgment happens downstream in the rendered report. globalSetup
// reuses the e2e build of out/; workers are pinned to 1 so scenarios run sequentially and their per-run
// numbers are not perturbed by parallel load. globalTeardown consolidates the per-scenario pending pieces
// into one run file (and, once layered on, the rendered report).

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/perf/scenarios',
  testMatch: '**/*.perf.ts',
  globalSetup: './e2e/support/global-setup.ts',
  globalTeardown: './e2e/perf/support/teardown.ts',
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure'
  }
})
