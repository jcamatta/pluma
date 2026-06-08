// Real-app e2e for the Editor feature. Drives the actual built desktop app: picks a real temp folder,
// selects a real file, types into the editor, and asserts the debounced autosave wrote the edit back to
// the real file on disk through the file:write IPC — exactly as a user editing a manuscript would.
//
// @e2e feature:editor
// @e2e operation:file.write

import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import { launchApp } from './support/launch-app'
import { stubFolderPicker } from './support/stub-folder-picker'
import { withTempFolder } from './support/temp-folder'

test('edits a file and autosaves it back to disk', async () => {
  await withTempFolder(
    [{ name: 'chapter-1.md', content: '# Chapter One\n\nOnce upon a time.' }],
    async (folder) => {
      const { app, window } = await launchApp()
      try {
        await stubFolderPicker(app, folder)
        await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

        const path = join(folder, 'chapter-1.md')
        const row = window.getByTestId(`file-row:${path}`)
        await expect(row).toBeVisible()
        await row.click()

        const surface = window.locator('.ProseMirror')
        await expect(surface.locator('h1')).toHaveText('Chapter One')

        // The top bar shows the open file's name (basename without the .md extension).
        await expect(window.getByText('chapter-1', { exact: true })).toBeVisible()

        // Type at the end of the document; the debounced autosave must persist it to the real file.
        await surface.click()
        await window.keyboard.press('End')
        await surface.pressSequentially(' The end.')

        await expect.poll(() => readFile(path, 'utf8'), { timeout: 5000 }).toContain('The end.')
      } finally {
        await app.close()
      }
    }
  )
})
