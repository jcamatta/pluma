// Scenario: open a large file. Measures the latency a writer feels when opening a novel-sized manuscript
// — from clicking its row to the document being rendered in the editor. The editor keeps every opened
// file mounted, so re-selecting a file is only a show/hide toggle; to measure a genuine first open every
// time, each iteration relaunches the app and times just the click→render (the timer starts after launch,
// so launch cost is excluded). Emits open-to-rendered (ms).

import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { launchApp } from '../../support/launch-app'
import { stubFolderPicker } from '../../support/stub-folder-picker'
import { withTempFolder } from '../../support/temp-folder'
import { collectSamples } from '../support/collect-samples'
import { resolveIterations } from '../support/resolve-iterations'
import { largeMarkdown } from '../support/seed-large-doc'
import { writePending } from '../support/write-pending'

const iterations = resolveIterations(process.env.PERF_ITERATIONS)
const LARGE_WORDS = 50_000
const RENDER_TIMEOUT = 60_000

const measureOpen = async (folder: string): Promise<number> => {
  const { app, window } = await launchApp()
  try {
    await stubFolderPicker(app, folder)
    await window.getByRole('button', { name: 'Open Folder', exact: false }).click()
    const row = window.getByTestId(`file-row:${join(folder, 'large.md')}`)
    await expect(row).toBeVisible()
    const start = performance.now()
    await row.click()
    await expect(window.locator('.ProseMirror:visible h1')).toHaveText('Large manuscript', {
      timeout: RENDER_TIMEOUT
    })
    return performance.now() - start
  } finally {
    await app.close()
  }
}

test('open large file: click to rendered', async () => {
  test.setTimeout(iterations * 90_000 + 120_000)
  await withTempFolder(
    [{ name: 'large.md', content: largeMarkdown(LARGE_WORDS) }],
    async (folder) => {
      const samples = await collectSamples(iterations, () => measureOpen(folder))
      await writePending({
        scenario: 'open-large-file',
        iterations,
        metrics: [{ name: 'open-to-rendered', unit: 'ms', samples }]
      })
    }
  )
})
