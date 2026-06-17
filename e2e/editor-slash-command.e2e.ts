// Real-app e2e for the slash command menu. Drives the actual built desktop app: opens a real temp folder,
// opens a file, types `/` in the editor, filters the menu, and picks a block type — asserting the menu
// appears and the line is converted with the `/query` text removed, exactly as a user would. No new IPC
// channel, so this rides the existing `editor` feature claim.
//
// @e2e feature:editor

import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { launchApp } from './support/launch-app'
import { stubFolderPicker } from './support/stub-folder-picker'
import { withTempFolder } from './support/temp-folder'

test('opens the slash menu, filters it, and converts the block', async () => {
  await withTempFolder([{ name: 'slash.md', content: '' }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

      const row = window.getByTestId(`file-row:${join(folder, 'slash.md')}`)
      await expect(row).toBeVisible()
      await row.click()

      const surface = window.locator('.ProseMirror')
      await surface.click()
      await surface.pressSequentially('/head')

      const menu = window.getByRole('listbox', { name: 'Basic blocks' })
      await expect(menu).toBeVisible()
      await expect(menu.getByRole('option')).toHaveCount(3)

      await menu.getByRole('option', { name: 'Heading 1' }).click()

      await expect(surface.locator('h1')).toBeVisible()
      await expect(surface).not.toContainText('/head')
      await expect(menu).toBeHidden()
    } finally {
      await app.close()
    }
  })
})

test('shows the last command (Divider) fully within the menu, and inserts it', async () => {
  await withTempFolder([{ name: 'divider.md', content: '' }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

      const row = window.getByTestId(`file-row:${join(folder, 'divider.md')}`)
      await expect(row).toBeVisible()
      await row.click()

      const surface = window.locator('.ProseMirror')
      await surface.click()
      await surface.pressSequentially('/')

      const menu = window.getByRole('listbox', { name: 'Basic blocks' })
      await expect(menu).toBeVisible()
      // The full catalogue is shown — Divider is the last of the nine commands.
      await expect(menu.getByRole('option')).toHaveCount(9)

      // Proof the last row is actually on screen, not clipped below the menu's capped height: how far the
      // Divider row's bottom sits past the menu's bottom edge. <= 1px (sub-pixel tolerance) means it is fully
      // within the visible menu. This is the regression the user hit — Divider was reachable by keyboard but
      // rendered past the fold; a positive overflow here would catch it returning.
      const overflowBelow = await menu.evaluate((menuEl) => {
        const option = Array.from(menuEl.querySelectorAll('[role="option"]')).find((o) =>
          o.textContent?.includes('Divider')
        )
        if (!option) return null
        return option.getBoundingClientRect().bottom - menuEl.getBoundingClientRect().bottom
      })
      expect(overflowBelow).not.toBeNull()
      expect(overflowBelow ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1)

      // And it works end to end: choosing it inserts a horizontal rule.
      await menu.getByRole('option', { name: 'Divider' }).click()
      await expect(surface.locator('hr')).toBeVisible()
      await expect(menu).toBeHidden()
    } finally {
      await app.close()
    }
  })
})
