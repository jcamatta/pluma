// Scenario: long-session memory. A writer keeps the app open for hours, moving between many files; the
// question is whether memory balloons and stays. Each iteration relaunches, snapshots memory with the
// folder open but no file shown, opens every seeded file in turn (each mounts its own editor), then
// snapshots again — reporting the growth. JS heap comes from a CDP Performance metric (after a forced GC
// so the number is stable); process memory is summed across all Electron processes via getAppMetrics.
// Emits heap-growth and rss-growth (bytes).

import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import type { CDPSession, ElectronApplication, Page } from '@playwright/test'
import { launchApp } from '../../support/launch-app'
import { stubFolderPicker } from '../../support/stub-folder-picker'
import { withTempFolder } from '../../support/temp-folder'
import type { Seed } from '../../support/temp-folder'
import { collectSamples } from '../support/collect-samples'
import { metricValue } from '../support/metric-value'
import { resolveIterations } from '../support/resolve-iterations'
import { writePending } from '../support/write-pending'

const iterations = resolveIterations(process.env.PERF_ITERATIONS)
const FILE_COUNT = 20
const OPEN_TIMEOUT = 30_000

const seeds: readonly Seed[] = Array.from({ length: FILE_COUNT }, (_, i) => ({
  name: `file-${i}.md`,
  content: `# File ${i}`
}))

type Memory = { readonly heap: number; readonly rss: number }

const rssBytes = async (app: ElectronApplication): Promise<number> => {
  const metrics = await app.evaluate((electron) => electron.app.getAppMetrics())
  return metrics.reduce((sum, metric) => sum + metric.memory.workingSetSize, 0) * 1024
}

const snapshot = async (app: ElectronApplication, cdp: CDPSession): Promise<Memory> => {
  await cdp.send('Performance.enable').catch(() => undefined)
  await cdp.send('HeapProfiler.collectGarbage').catch(() => undefined)
  const metrics: unknown = await cdp.send('Performance.getMetrics')
  return { heap: metricValue(metrics, 'JSHeapUsedSize'), rss: await rssBytes(app) }
}

const openAll = async (window: Page, folder: string): Promise<void> => {
  const heading = window.locator('.ProseMirror:visible h1')
  for (const i of Array.from({ length: FILE_COUNT }, (_, k) => k)) {
    await window.getByTestId(`file-row:${join(folder, `file-${i}.md`)}`).click()
    await expect(heading).toHaveText(`File ${i}`, { timeout: OPEN_TIMEOUT })
  }
}

const measureMemory = async (folder: string): Promise<Memory> => {
  const { app, window } = await launchApp()
  try {
    await stubFolderPicker(app, folder)
    await window.getByRole('button', { name: 'Open Folder', exact: false }).click()
    await expect(window.getByTestId(`file-row:${join(folder, 'file-0.md')}`)).toBeVisible()
    const cdp = await window.context().newCDPSession(window)
    const before = await snapshot(app, cdp)
    await openAll(window, folder)
    const after = await snapshot(app, cdp)
    return { heap: after.heap - before.heap, rss: after.rss - before.rss }
  } finally {
    await app.close()
  }
}

test('long session memory: growth after opening files', async () => {
  test.setTimeout(iterations * 90_000 + 120_000)
  await withTempFolder(seeds, async (folder) => {
    const growth = await collectSamples(iterations, () => measureMemory(folder))
    await writePending({
      scenario: 'long-session-memory',
      iterations,
      metrics: [
        { name: 'heap-growth', unit: 'bytes', samples: growth.map((memory) => memory.heap) },
        { name: 'rss-growth', unit: 'bytes', samples: growth.map((memory) => memory.rss) }
      ]
    })
  })
})
