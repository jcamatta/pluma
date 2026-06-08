// A tiny demo of the see/screenshot loop: open the real app, pick a folder with files, and save a
// screenshot to e2e/.artifacts/. Not a coverage spec — it has no @e2e tags; it exists to show the
// agent how to capture what the app looks like.

import { test } from '@playwright/test'
import { launchApp } from './support/launch-app'
import { stubFolderPicker } from './support/stub-folder-picker'
import { withTempFolder } from './support/temp-folder'

test('capture the explorer', async () => {
  await withTempFolder([{ name: 'chapter-1.md', content: '# One' }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open folder' }).click()
      await window.getByTestId('explorer').waitFor()
      await window.screenshot({ path: 'e2e/.artifacts/explorer.png' })
    } finally {
      await app.close()
    }
  })
})
