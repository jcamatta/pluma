// Real-app e2e for the composer's context meter. Drives the built desktop app: opens a real folder,
// runs one real agent turn, and asserts the meter — fed live from the run's STATE_SNAPSHOT over
// agent.event — appears in the composer showing the thread's context occupancy, and that opening it
// reveals the per-component token breakdown. Nothing about the agent is mocked; only the native folder
// dialog is stubbed. One short turn keeps the real Claude round-trip cheap.
//
// @e2e feature:rail-context-meter

import { test, expect } from '@playwright/test'
import { launchApp } from './support/launch-app'
import { stubFolderPicker } from './support/stub-folder-picker'
import { withTempFolder } from './support/temp-folder'

const PROMPT = 'Reply with the single word OK and nothing else.'

// A real Claude round-trip needs well over Playwright's 30s default.
test.setTimeout(120_000)

test('shows the context meter after a turn and reveals the token breakdown', async () => {
  await withTempFolder([{ name: 'chapter-1.md', content: '# Chapter One' }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

      const rail = window.getByTestId('conversation-rail')
      await expect(rail).toBeVisible({ timeout: 30_000 })

      // No meter before any run has reported usage.
      await expect(rail.getByTestId('context-meter')).toBeHidden()

      const composer = rail.locator('textarea[data-rail-composer]')
      await composer.click()
      await composer.fill(PROMPT)
      await rail.getByRole('button', { name: 'Send', exact: true }).click()

      // The run settles and its assistant message publishes a context snapshot; the meter appears,
      // labelled with the worded summary it exposes for screen readers.
      await expect(rail.getByText('Worked', { exact: true })).toBeVisible({ timeout: 60_000 })
      const meter = rail.getByRole('button', { name: /Context/ })
      await expect(meter).toBeVisible({ timeout: 60_000 })

      // Opening the meter reveals the window title and the token breakdown rows.
      await meter.click()
      await expect(window.getByText('Context window')).toBeVisible()
      await expect(window.getByText('Input', { exact: true })).toBeVisible()
    } finally {
      await app.close()
    }
  })
})
