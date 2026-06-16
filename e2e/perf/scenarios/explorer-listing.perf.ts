// Scenario: explorer listing. Measures how long a large folder takes to list and render — from picking
// the folder to all of its rows being in the tree. The explorer renders every entry (no virtualization),
// so the row count reaching the seeded total is a true "fully rendered" signal. Listing happens once per
// folder open, so each iteration relaunches and times just the pick→rendered (timer starts after launch,
// excluding launch cost). Emits list-to-rendered (ms).

import { test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { launchApp } from '../../support/launch-app'
import { stubFolderPicker } from '../../support/stub-folder-picker'
import { withTempFolder } from '../../support/temp-folder'
import type { Seed } from '../../support/temp-folder'
import { collectSamples } from '../support/collect-samples'
import { resolveIterations } from '../support/resolve-iterations'
import { writePending } from '../support/write-pending'

const iterations = resolveIterations(process.env.PERF_ITERATIONS)
const ENTRY_COUNT = 500
const RENDER_TIMEOUT = 60_000

const seeds: readonly Seed[] = Array.from({ length: ENTRY_COUNT }, (_, i) => ({
  name: `file-${String(i).padStart(3, '0')}.md`,
  content: '# entry'
}))

const waitForRows = (window: Page): Promise<unknown> =>
  window.waitForFunction(
    (expected) => document.querySelectorAll('[data-testid^="file-row:"]').length >= expected,
    ENTRY_COUNT,
    { timeout: RENDER_TIMEOUT }
  )

const measureListing = async (folder: string): Promise<number> => {
  const { app, window } = await launchApp()
  try {
    await stubFolderPicker(app, folder)
    const start = performance.now()
    await window.getByRole('button', { name: 'Open Folder', exact: false }).click()
    await waitForRows(window)
    return performance.now() - start
  } finally {
    await app.close()
  }
}

test('explorer listing: pick to rendered', async () => {
  test.setTimeout(iterations * 60_000 + 120_000)
  await withTempFolder(seeds, async (folder) => {
    const samples = await collectSamples(iterations, () => measureListing(folder))
    await writePending({
      scenario: 'explorer-listing',
      iterations,
      metrics: [{ name: 'list-to-rendered', unit: 'ms', samples }]
    })
  })
})
