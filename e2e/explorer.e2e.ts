// Real-app e2e for the Explorer feature. Drives the actual built desktop app: picks a real temp folder
// (only the native OS chooser is stubbed), then exercises the real folder/file IPC use cases and the OS
// watcher through the UI exactly as a user would.
//
// @e2e feature:explorer
// @e2e operation:folder.pick operation:folder.list operation:folder.create operation:folder.delete
// @e2e operation:folder.watch operation:folder.changed operation:file.create operation:file.delete

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
      await window.getByRole('button', { name: 'Open folder' }).click()

      await expect(window.getByTestId('explorer')).toBeVisible()
      await expect(window.getByTestId(`file-row:${join(folder, 'chapter-1.md')}`)).toBeVisible()
    } finally {
      await app.close()
    }
  })
})

test('creates a file through the UI and selects it', async () => {
  await withTempFolder([], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open folder' }).click()
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

test('reflects an externally created file via the OS watcher', async () => {
  await withTempFolder([], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open folder' }).click()
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
      await window.getByRole('button', { name: 'Open folder' }).click()

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

test('reflects an externally deleted file via the OS watcher', async () => {
  await withTempFolder([{ name: 'vanish.md', content: 'here' }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open folder' }).click()

      const path = join(folder, 'vanish.md')
      await expect(window.getByTestId(`file-row:${path}`)).toBeVisible()

      await rm(path, { force: true })
      await expect(window.getByTestId(`file-row:${path}`)).toHaveCount(0, { timeout: 15000 })
    } finally {
      await app.close()
    }
  })
})
