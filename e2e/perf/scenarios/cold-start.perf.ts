// Scenario: cold start. Measures how long a fresh launch takes to become interactive — from spawning the
// real built app to the launcher's "Open Folder" button being visible (the first thing a user can act
// on). Each iteration is a full launch→close cycle so nothing is warm between runs. Emits one metric,
// launch-to-interactive (ms), as this scenario's pending piece; the teardown folds it into the run report.

import { test, expect } from '@playwright/test'
import { launchApp } from '../../support/launch-app'
import { collectSamples } from '../support/collect-samples'
import { resolveIterations } from '../support/resolve-iterations'
import { writePending } from '../support/write-pending'

const iterations = resolveIterations(process.env.PERF_ITERATIONS)

const measureColdStart = async (): Promise<number> => {
  const start = performance.now()
  const { app, window } = await launchApp()
  try {
    await expect(window.getByRole('button', { name: 'Open Folder', exact: false })).toBeVisible()
    return performance.now() - start
  } finally {
    await app.close()
  }
}

test('cold start: launch to interactive', async () => {
  test.setTimeout(iterations * 60_000)
  const samples = await collectSamples(iterations, measureColdStart)
  await writePending({
    scenario: 'cold-start',
    iterations,
    metrics: [{ name: 'launch-to-interactive', unit: 'ms', samples }]
  })
})
