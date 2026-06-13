// Real-app e2e for the Settings feature. Drives the actual built desktop app: opens a real folder so the
// editor (and its top-bar settings button) renders, opens the settings modal, picks the Dark theme, and
// asserts the choice takes effect — the document root gains data-theme="dark", which is exactly what
// repaints the app's palette. Settings is localStorage-backed (no IPC channel), so this claims only the
// feature, not an operation.
//
// @e2e feature:settings

import { test, expect } from '@playwright/test'
import { launchApp } from './support/launch-app'
import { stubFolderPicker } from './support/stub-folder-picker'
import { withTempFolder } from './support/temp-folder'

test('opens settings and applies the chosen theme', async () => {
  await withTempFolder([{ name: 'chapter-1.md', content: '# Chapter One' }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

      // The editor top bar (with the settings button) renders once a folder is open.
      await window.getByRole('button', { name: 'Settings', exact: true }).click()

      const dialog = window.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // Pick the Dark theme; the document root must gain the data-theme override.
      await dialog.getByRole('radio', { name: 'Dark', exact: true }).click()
      await expect
        .poll(() => window.evaluate(() => document.documentElement.getAttribute('data-theme')))
        .toBe('dark')

      // Closing the modal dismisses it.
      await window.getByRole('button', { name: 'Close settings', exact: true }).click()
      await expect(dialog).toBeHidden()
    } finally {
      await app.close()
    }
  })
})

test('switches the interface language to Spanish and back', async () => {
  await withTempFolder([{ name: 'chapter-1.md', content: '# Chapter One' }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

      await window.getByRole('button', { name: 'Settings', exact: true }).click()
      const dialog = window.getByRole('dialog')
      await expect(dialog).toBeVisible()

      // Picking Español re-renders the whole UI in Spanish immediately — the dialog title switches.
      await dialog.getByRole('radio', { name: 'Español', exact: true }).click()
      await expect(dialog.getByText('Configuración', { exact: true })).toBeVisible()
      await expect
        .poll(() => window.evaluate(() => localStorage.getItem('pluma.language')))
        .toBe('es')

      // Switch back to English so the shared userData store is left clean for other specs.
      await dialog.getByRole('radio', { name: 'English', exact: true }).click()
      await expect(dialog.getByText('Settings', { exact: true })).toBeVisible()
    } finally {
      await app.close()
    }
  })
})
