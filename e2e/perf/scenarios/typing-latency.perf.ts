// Scenario: typing latency. The most perception-sensitive interaction in a writing app — a keystroke
// should paint within ~50ms. For each of many keystrokes we time from dispatching the key to the editor
// text reflecting it on the next animation frame (waitForFunction polls on rAF), giving a p50/p95
// distribution. Measured in a small document and again in the large seeded one, since editor work can
// grow with document size. Emits keystroke-to-paint (ms, carries the perception budget) and
// keystroke-to-paint-large-doc (ms). Both files stay mounted, so the visible editor is the one whose
// element has an offsetParent (hidden editors are display:none).

import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { launchApp } from '../../support/launch-app'
import { stubFolderPicker } from '../../support/stub-folder-picker'
import { withTempFolder } from '../../support/temp-folder'
import { collectSamples } from '../support/collect-samples'
import { largeMarkdown } from '../support/seed-large-doc'
import { writePending } from '../support/write-pending'

const KEYSTROKES = 30
const RENDER_TIMEOUT = 60_000

const visibleLength = (window: Page): Promise<number> =>
  window.evaluate(() => {
    const editors = Array.from(document.querySelectorAll('.ProseMirror'))
    const visible = editors.find(
      (element) => element instanceof HTMLElement && element.offsetParent !== null
    )
    return visible?.textContent?.length ?? 0
  })

type TypingInput = {
  readonly window: Page
  readonly rowTestId: string
  readonly heading: string
}

const measureTyping = async (input: TypingInput): Promise<readonly number[]> => {
  const { window, rowTestId, heading } = input
  await window.getByTestId(rowTestId).click()
  const surface = window.locator('.ProseMirror:visible')
  await expect(surface.locator('h1')).toHaveText(heading, { timeout: RENDER_TIMEOUT })
  await surface.click()
  await window.keyboard.press('Control+End')
  const base = await visibleLength(window)
  const press = async (i: number): Promise<number> => {
    const start = performance.now()
    await window.keyboard.press('a')
    await window.waitForFunction(
      (expected) => {
        const editors = Array.from(document.querySelectorAll('.ProseMirror'))
        const visible = editors.find((el) => el instanceof HTMLElement && el.offsetParent !== null)
        return (visible?.textContent?.length ?? 0) >= expected
      },
      base + i + 1
    )
    return performance.now() - start
  }
  return collectSamples(KEYSTROKES, press)
}

test('typing latency: keystroke to paint', async () => {
  test.setTimeout(180_000)
  await withTempFolder(
    [
      { name: 'small.md', content: '# Small\n\nshort.' },
      { name: 'large.md', content: largeMarkdown(50_000) }
    ],
    async (folder) => {
      const { app, window } = await launchApp()
      try {
        await stubFolderPicker(app, folder)
        await window.getByRole('button', { name: 'Open Folder', exact: false }).click()
        await expect(window.getByTestId(`file-row:${join(folder, 'small.md')}`)).toBeVisible()

        const small = await measureTyping({
          window,
          rowTestId: `file-row:${join(folder, 'small.md')}`,
          heading: 'Small'
        })
        const large = await measureTyping({
          window,
          rowTestId: `file-row:${join(folder, 'large.md')}`,
          heading: 'Large manuscript'
        })

        await writePending({
          scenario: 'typing-latency',
          iterations: KEYSTROKES,
          metrics: [
            { name: 'keystroke-to-paint', unit: 'ms', samples: small },
            { name: 'keystroke-to-paint-large-doc', unit: 'ms', samples: large }
          ]
        })
      } finally {
        await app.close()
      }
    }
  )
})
