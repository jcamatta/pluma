// Real-app e2e for the Explorer feature. Drives the actual built desktop app: picks a real temp folder
// (only the native OS chooser is stubbed), then exercises the real folder/file IPC use cases and the OS
// watcher through the UI exactly as a user would.
//
// @e2e feature:explorer
// @e2e operation:folder.pick operation:folder.list operation:folder.create operation:folder.delete
// @e2e operation:folder.rename operation:folder.watch operation:folder.changed
// @e2e operation:file.create operation:file.delete operation:file.rename operation:file.read

import { join } from 'node:path'
import { access, readdir, writeFile, rm } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import { launchApp } from './support/launch-app'
import { stubFolderPicker } from './support/stub-folder-picker'
import { withTempFolder } from './support/temp-folder'

// True iff `path` exists on the real filesystem — so a test can assert the app's UI action actually
// changed the disk, not just the rendered tree.
const onDisk = async (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false
  )

test('picks a folder and lists its real contents', async () => {
  await withTempFolder([{ name: 'chapter-1.md', content: '# One' }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

      await expect(window.getByTestId('explorer')).toBeVisible()
      await expect(window.getByTestId(`file-row:${join(folder, 'chapter-1.md')}`)).toBeVisible()
    } finally {
      await app.close()
    }
  })
})

test('lists only Markdown files, filtering out other file types', async () => {
  await withTempFolder(
    [
      { name: 'chapter-1.md', content: '# One' },
      { name: 'notes.txt', content: 'plain' }
    ],
    async (folder) => {
      const { app, window } = await launchApp()
      try {
        await stubFolderPicker(app, folder)
        await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

        await expect(window.getByTestId('explorer')).toBeVisible()
        await expect(window.getByTestId(`file-row:${join(folder, 'chapter-1.md')}`)).toBeVisible()

        // The non-Markdown file exists on disk but is filtered out of the listing.
        expect(await readdir(folder)).toContain('notes.txt')
        await expect(window.getByTestId(`file-row:${join(folder, 'notes.txt')}`)).toHaveCount(0)
      } finally {
        await app.close()
      }
    }
  )
})

test('creates a file through the UI and selects it', async () => {
  await withTempFolder([], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()
      await expect(window.getByTestId('explorer')).toBeVisible()

      await window.getByRole('button', { name: 'New file' }).first().click()
      await window.getByPlaceholder('Untitled').fill('draft.md')
      await window.getByPlaceholder('Untitled').press('Enter')

      const row = window.getByTestId(`file-row:${join(folder, 'draft.md')}`)
      await expect(row).toBeVisible()
      await expect(row).toHaveClass(/border-action-primary/)

      // The UI action must have created the real file on disk, not just a tree row.
      await expect.poll(() => onDisk(join(folder, 'draft.md'))).toBe(true)
      expect(await readdir(folder)).toContain('draft.md')
    } finally {
      await app.close()
    }
  })
})

test('creates a file when the name is typed without the .md extension', async () => {
  await withTempFolder([], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()
      await expect(window.getByTestId('explorer')).toBeVisible()

      await window.getByRole('button', { name: 'New file' }).first().click()
      await window.getByPlaceholder('Untitled').fill('notes')
      await window.getByPlaceholder('Untitled').press('Enter')

      // The bare name is normalized to notes.md and the real file lands on disk.
      await expect(window.getByTestId(`file-row:${join(folder, 'notes.md')}`)).toBeVisible()
      await expect.poll(() => onDisk(join(folder, 'notes.md'))).toBe(true)
      expect(await readdir(folder)).toContain('notes.md')
    } finally {
      await app.close()
    }
  })
})

test('opens a collapsed folder when creating inside it, revealing the name input', async () => {
  await withTempFolder([], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()
      await expect(window.getByTestId('explorer')).toBeVisible()

      // Create a subfolder through the root toolbar; it lands collapsed.
      await window.getByRole('button', { name: 'New folder' }).first().click()
      await window.getByPlaceholder('Untitled').fill('sub')
      await window.getByPlaceholder('Untitled').press('Enter')

      const subRow = window.getByTestId(`folder-row:${join(folder, 'sub')}`)
      await expect(subRow).toBeVisible()

      // Creating a file inside the collapsed folder must open it so its draft input is visible.
      await subRow.hover()
      await subRow.getByRole('button', { name: 'New file' }).click()
      await expect(window.getByPlaceholder('Untitled')).toBeVisible()

      await window.getByPlaceholder('Untitled').fill('inside.md')
      await window.getByPlaceholder('Untitled').press('Enter')

      const path = join(folder, 'sub', 'inside.md')
      await expect(window.getByTestId(`file-row:${path}`)).toBeVisible()
      await expect.poll(() => onDisk(path)).toBe(true)
    } finally {
      await app.close()
    }
  })
})

test('reads a selected file into the editor', async () => {
  await withTempFolder(
    [{ name: 'chapter-1.md', content: '# Chapter One\n\nOnce upon a time.' }],
    async (folder) => {
      const { app, window } = await launchApp()
      try {
        await stubFolderPicker(app, folder)
        await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

        const row = window.getByTestId(`file-row:${join(folder, 'chapter-1.md')}`)
        await expect(row).toBeVisible()
        await row.click()

        // Selecting the file must read its real content through the file:read IPC and render it.
        await expect(window.locator('.ProseMirror h1')).toHaveText('Chapter One')
        await expect(window.locator('.ProseMirror')).toContainText('Once upon a time.')
      } finally {
        await app.close()
      }
    }
  )
})

test('reflects an externally created file via the OS watcher', async () => {
  await withTempFolder([], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()
      await expect(window.getByTestId('explorer')).toBeVisible()

      await writeFile(join(folder, 'external.md'), '# external')
      await expect(window.getByTestId(`file-row:${join(folder, 'external.md')}`)).toBeVisible({
        timeout: 15000
      })
    } finally {
      await app.close()
    }
  })
})

test('deletes a file through the UI', async () => {
  await withTempFolder([{ name: 'gone.md', content: 'bye' }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

      const path = join(folder, 'gone.md')
      const row = window.getByTestId(`file-row:${path}`)
      await expect(row).toBeVisible()
      expect(await onDisk(path)).toBe(true)

      await row.hover()
      await row.getByRole('button', { name: 'Delete file' }).click()
      await expect(window.getByTestId(`file-row:${path}`)).toHaveCount(0)

      // The UI delete must have removed the real file from disk, not just the tree row.
      await expect.poll(() => onDisk(path)).toBe(false)
    } finally {
      await app.close()
    }
  })
})

test('renames a folder in place through the UI', async () => {
  await withTempFolder([], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()
      await expect(window.getByTestId('explorer')).toBeVisible()

      // Create the folder to rename through the real folder:create IPC.
      await window.getByRole('button', { name: 'New folder' }).first().click()
      await window.getByPlaceholder('Untitled').fill('draft')
      await window.getByPlaceholder('Untitled').press('Enter')

      const oldPath = join(folder, 'draft')
      const newPath = join(folder, 'final')
      const oldRow = window.getByTestId(`folder-row:${oldPath}`)
      await expect(oldRow).toBeVisible()
      await expect.poll(() => onDisk(oldPath)).toBe(true)

      // Rename it in place via the inline field.
      await oldRow.hover()
      await oldRow.getByRole('button', { name: 'Rename folder' }).click()
      const input = oldRow.getByRole('textbox')
      await input.fill('final')
      await input.press('Enter')

      // The row re-renders under the new path, the old one is gone, and the directory moved on disk.
      await expect(window.getByTestId(`folder-row:${newPath}`)).toBeVisible()
      await expect(window.getByTestId(`folder-row:${oldPath}`)).toHaveCount(0)
      await expect.poll(() => onDisk(newPath)).toBe(true)
      await expect.poll(() => onDisk(oldPath)).toBe(false)
    } finally {
      await app.close()
    }
  })
})

test('renames a file in place through the UI', async () => {
  await withTempFolder([{ name: 'old.md', content: '# Old' }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()
      await expect(window.getByTestId('explorer')).toBeVisible()

      const oldPath = join(folder, 'old.md')
      const newPath = join(folder, 'new.md')
      const oldRow = window.getByTestId(`file-row:${oldPath}`)
      await expect(oldRow).toBeVisible()
      await expect.poll(() => onDisk(oldPath)).toBe(true)

      // Rename it in place via the inline field, driving the real file:rename IPC.
      await oldRow.hover()
      await oldRow.getByRole('button', { name: 'Rename file' }).click()
      const input = oldRow.getByRole('textbox')
      await input.fill('new.md')
      await input.press('Enter')

      // The row re-renders under the new path, the old one is gone, and the file moved on disk.
      await expect(window.getByTestId(`file-row:${newPath}`)).toBeVisible()
      await expect(window.getByTestId(`file-row:${oldPath}`)).toHaveCount(0)
      await expect.poll(() => onDisk(newPath)).toBe(true)
      await expect.poll(() => onDisk(oldPath)).toBe(false)
    } finally {
      await app.close()
    }
  })
})

test('reflects an externally deleted file via the OS watcher', async () => {
  await withTempFolder([{ name: 'vanish.md', content: 'here' }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

      const path = join(folder, 'vanish.md')
      await expect(window.getByTestId(`file-row:${path}`)).toBeVisible()

      await rm(path, { force: true })
      await expect(window.getByTestId(`file-row:${path}`)).toHaveCount(0, { timeout: 15000 })
    } finally {
      await app.close()
    }
  })
})
