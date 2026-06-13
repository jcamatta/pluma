// Real-app e2e for the editor tab strip. Drives the actual built desktop app: opening a second file
// from the explorer adds a tab, clicking a tab switches the active file, and a tab's close button drops
// it from the open set and falls back to the neighbour. Only the native folder chooser is stubbed; the
// real folder/file IPC runs. Switching and closing are pure renderer state, so there is no new IPC
// operation to claim — just the feature.
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
