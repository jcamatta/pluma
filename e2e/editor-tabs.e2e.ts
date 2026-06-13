// Real-app e2e for the editor tab strip. Drives the actual built desktop app: opening a second file
// from the explorer adds a tab, clicking a tab switches the active file, and a tab's close button drops
// it from the open set and falls back to the neighbour. Only the native folder chooser is stubbed; the
// real folder/file IPC runs. Switching and closing are pure renderer state, so there is no new IPC
// operation to claim — just the feature.
//
// A second test proves the agent's editing tools act on the active tab while several tabs are open:
// with two files open it switches the active file through the tab strip, then the real agent (nothing
// mocked) proposes an edit on the active document and the rewrite lands in that tab — confirming a tab
// switch rebinds the editor the active-bound tools reach.
//
// @e2e feature:editor-tabs

import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { launchApp } from './support/launch-app'
import { stubFolderPicker } from './support/stub-folder-picker'
import { withTempFolder } from './support/temp-folder'

test('opens files as tabs, switches between them, and closes one', async () => {
  await withTempFolder(
    [
      { name: 'alpha.md', content: '# Alpha Chapter' },
      { name: 'beta.md', content: '# Beta Chapter' }
    ],
    async (folder) => {
      const { app, window } = await launchApp()
      try {
        await stubFolderPicker(app, folder)
        await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

        // The first markdown file auto-opens, so its tab is present and selected.
        await expect(window.getByRole('tab', { name: 'alpha' })).toHaveAttribute(
          'aria-selected',
          'true'
        )

        // Opening a second file from the explorer adds its tab and makes it active.
        await window.getByTestId(`file-row:${join(folder, 'beta.md')}`).click()
        await expect(window.getByRole('tab', { name: 'beta' })).toHaveAttribute(
          'aria-selected',
          'true'
        )
        await expect(window.getByRole('tab', { name: 'alpha' })).toHaveAttribute(
          'aria-selected',
          'false'
        )

        // Clicking the first tab switches back to it; its surface becomes visible.
        await window.getByRole('tab', { name: 'alpha' }).click()
        await expect(window.getByRole('tab', { name: 'alpha' })).toHaveAttribute(
          'aria-selected',
          'true'
        )
        await expect(window.getByRole('heading', { name: 'Alpha Chapter' })).toBeVisible()

        // Closing the beta tab drops it and leaves the neighbour active.
        await window.getByRole('button', { name: 'Close beta' }).click()
        await expect(window.getByRole('tab', { name: 'beta' })).toHaveCount(0)
        await expect(window.getByRole('tab', { name: 'alpha' })).toHaveAttribute(
          'aria-selected',
          'true'
        )
      } finally {
        await app.close()
      }
    }
  )
})

// One real Claude tool round-trip (resolve a range, then propose the edit) needs well over the default.
const TOOL_PROMPT =
  'Use your editing tools to replace one word in the active document, then stop. ' +
  'First call list_open_files to find the path of the active file, then read it with get_content and ' +
  'pass that path to get_ranges to resolve the word "owl", then call propose_edit to replace "owl" ' +
  'with "hawk". Do not reply with prose and do not ask for confirmation.'

test('agent editing tools act on the active tab while several tabs are open', async () => {
  test.setTimeout(180_000)
  await withTempFolder(
    [
      { name: 'alpha.md', content: 'The owl flew over the hill.' },
      { name: 'beta.md', content: 'The fox crossed the road.' }
    ],
    async (folder) => {
      const { app, window } = await launchApp()
      try {
        await stubFolderPicker(app, folder)
        await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

        const rail = window.getByTestId('conversation-rail')
        await expect(rail).toBeVisible({ timeout: 30_000 })

        // Open the second file so both tabs are present, then switch the active file back to alpha
        // through the tab strip — the agent's active-bound tools must follow this selection.
        await window.getByTestId(`file-row:${join(folder, 'beta.md')}`).click()
        await expect(window.getByRole('tab', { name: 'beta' })).toHaveAttribute(
          'aria-selected',
          'true'
        )
        await window.getByRole('tab', { name: 'alpha' }).click()
        await expect(window.locator('.ProseMirror:visible')).toContainText('owl', {
          timeout: 30_000
        })

        // Ask the real agent to edit the active document; wait for the run to settle.
        const composer = rail.locator('textarea[data-rail-composer]')
        await composer.click()
        await composer.fill(TOOL_PROMPT)
        await rail.getByRole('button', { name: 'Send', exact: true }).click()
        await expect(rail.getByText('Worked', { exact: true })).toBeVisible({ timeout: 120_000 })

        // The proposal lands on alpha (the active tab). Accepting it rewrites alpha's text, while beta
        // stays open as its own tab — the edit reached the active editor, not the other open one.
        await rail.getByRole('button', { name: /Review/ }).click()
        await rail.getByRole('button', { name: 'Accept', exact: true }).click()
        await expect(window.locator('.ProseMirror:visible')).toContainText('hawk', {
          timeout: 30_000
        })
        await expect(window.getByRole('tab', { name: 'beta' })).toHaveCount(1)
      } finally {
        await app.close()
      }
    }
  )
})
