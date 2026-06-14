// Real-app e2e for external-write sync. Drives the actual built desktop app: opens a real file in the
// editor, then has another program rewrite that same file on disk (a real fs.writeFile, nothing
// stubbed but the native folder chooser). The OS watcher must carry the change through and the editor
// must reload it in place — disk-wins — instead of leaving stale content or overwriting the change.
//
// @e2e feature:editor-external-sync
// @e2e operation:folder.changed operation:file.read

import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import { launchApp } from './support/launch-app'
import { stubFolderPicker } from './support/stub-folder-picker'
import { withTempFolder } from './support/temp-folder'

test('reloads the open file when it is changed on disk by another program', async () => {
  await withTempFolder(
    [{ name: 'chapter-1.md', content: '# Chapter One\n\nOriginal body.' }],
    async (folder) => {
      const { app, window } = await launchApp()
      try {
        await stubFolderPicker(app, folder)
        await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

        const path = join(folder, 'chapter-1.md')
        const row = window.getByTestId(`file-row:${path}`)
        await expect(row).toBeVisible()
        await row.click()

        const surface = window.locator('.ProseMirror:visible')
        await expect(surface.locator('h1')).toHaveText('Chapter One')
        await expect(surface).toContainText('Original body.')

        // Another program rewrites the open file; the watcher must drive a reload into the editor.
        await writeFile(path, '# Rewritten\n\nNew body from outside.')
        await expect(surface.locator('h1')).toHaveText('Rewritten', { timeout: 15000 })
        await expect(surface).toContainText('New body from outside.')
      } finally {
        await app.close()
      }
    }
  )
})
