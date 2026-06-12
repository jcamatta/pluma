// Real-app e2e for the Editor feature. Drives the actual built desktop app: picks a real temp folder,
// selects a real file, types into the editor, and asserts the debounced autosave wrote the edit back to
// the real file on disk through the file:write IPC — exactly as a user editing a manuscript would. A
// second test drops a real image file onto the editor and checks it renders and round-trips to markdown.
//
// @e2e feature:editor
// @e2e operation:file.write

import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import { launchApp } from './support/launch-app'
import { stubFolderPicker } from './support/stub-folder-picker'
import { withTempFolder } from './support/temp-folder'
import { dropImage } from './support/drop-image'

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

test('drops an image into the editor and persists it as markdown', async () => {
  await withTempFolder(
    [
      { name: 'chapter-1.md', content: '# Chapter One\n\nOnce upon a time.' },
      { name: 'chapter-2.md', content: '# Chapter Two' }
    ],
    async (folder) => {
      const { app, window } = await launchApp()
      try {
        await stubFolderPicker(app, folder)
        await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

        const path = join(folder, 'chapter-1.md')
        await window.getByTestId(`file-row:${path}`).click()

        const surface = window.locator('.ProseMirror')
        await expect(surface.locator('h1')).toHaveText('Chapter One')

        await dropImage(surface, 'pic.png')
        await expect(surface.locator('img')).toBeVisible()

        // Clicking the image selects the node, which must show the selected affordance.
        await surface.locator('img').click()
        await expect(surface.locator('img')).toHaveClass(/ProseMirror-selectednode/)

        // The debounced autosave must persist the image as a markdown data-URI reference.
        await expect
          .poll(() => readFile(path, 'utf8'), { timeout: 5000 })
          .toContain('data:image/png')

        // Switching away and back reloads the file from disk; the saved image must render again.
        await window.getByTestId(`file-row:${join(folder, 'chapter-2.md')}`).click()
        await expect(surface.locator('h1')).toHaveText('Chapter Two')
        await window.getByTestId(`file-row:${path}`).click()
        await expect(surface.locator('img')).toBeVisible()
      } finally {
        await app.close()
      }
    }
  )
})
