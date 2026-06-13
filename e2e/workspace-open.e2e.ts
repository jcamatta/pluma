// Real-app e2e for the workspace-open flow. Drives the actual built desktop app: opening a folder lands
// the user in the first markdown file when one exists (no manual click), and shows the empty state when
// the root has no markdown file — at which point creating one through the explorer opens it. Only the
// native folder chooser is stubbed; the real folder/file IPC and the OS watcher run.
//
// @e2e feature:workspace-open
// @e2e operation:file.create operation:file.write

import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import { launchApp } from './support/launch-app'
import { stubFolderPicker } from './support/stub-folder-picker'
import { withTempFolder } from './support/temp-folder'

test('opens the first markdown file on project open', async () => {
  await withTempFolder(
    [
      { name: 'zeta.md', content: '# Zeta' },
      { name: 'alpha.md', content: '# Alpha Chapter\n\nOnce upon a time.' }
    ],
    async (folder) => {
      const { app, window } = await launchApp()
      try {
        await stubFolderPicker(app, folder)
        await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

        // No click in the explorer: the first markdown file (alphabetical) loads on its own.
        const surface = window.locator('.ProseMirror')
        await expect(surface.locator('h1')).toHaveText('Alpha Chapter')
        await expect(window.getByText('alpha', { exact: true })).toBeVisible()

        // The auto-opened file is a real, autosaving file: a typed edit persists to it on disk.
        await surface.click()
        await window.keyboard.press('End')
        await surface.pressSequentially(' The end.')

        await expect
          .poll(() => readFile(join(folder, 'alpha.md'), 'utf8'), { timeout: 5000 })
          .toContain('The end.')
      } finally {
        await app.close()
      }
    }
  )
})

test('shows the empty state for a project with no markdown file, then opens a created file', async () => {
  await withTempFolder([], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

      // No markdown file at the root: the editor shows the empty state, not a writable surface.
      await expect(window.getByText('No file open')).toBeVisible()
      await expect(window.locator('.ProseMirror')).toHaveCount(0)

      // Creating a file through the explorer selects it, which mounts the real editor on it.
      await window.getByRole('button', { name: 'New file' }).first().click()
      await window.getByPlaceholder('Untitled').fill('draft.md')
      await window.getByPlaceholder('Untitled').press('Enter')

      await expect(window.getByTestId(`file-row:${join(folder, 'draft.md')}`)).toBeVisible()
      await expect(window.getByText('No file open')).toHaveCount(0)
      await expect(window.locator('.ProseMirror')).toBeVisible()
    } finally {
      await app.close()
    }
  })
})
