// Real-app e2e for the Launcher feature: the open-a-folder entry screen. Drives the actual built
// desktop app — the launcher renders, its Open Folder button triggers the real folder.pick IPC (only
// the native OS chooser is stubbed), and picking a folder swaps the launcher for the workspace.
//
// @e2e feature:launcher
// @e2e operation:folder.pick

import { test, expect } from '@playwright/test'
import { launchApp } from './support/launch-app'
import { stubFolderPicker } from './support/stub-folder-picker'
import { withTempFolder } from './support/temp-folder'

test('shows the launcher and opens the workspace after picking a folder', async () => {
  await withTempFolder([], async (folder) => {
    const { app, window } = await launchApp()
    try {
      const open = window.getByRole('button', { name: 'Open Folder', exact: false })
      await expect(open).toBeVisible()
      await expect(
        window.getByRole('img', { name: 'Preview of the Pluma workspace' })
      ).toBeVisible()

      await stubFolderPicker(app, folder)
      await open.click()

      await expect(window.getByTestId('explorer')).toBeVisible()
      await expect(open).toHaveCount(0)
    } finally {
      await app.close()
    }
  })
})
