// Real-app e2e for the gated filesystem-approval flow. Drives the actual built desktop app end to end:
// opens a real folder, runs a real agent turn that asks the agent to call the gated `create_file` backend
// tool at a known absolute path. That tool suspends mid-run and surfaces an Approve/Reject card in the rail
// instead of touching disk; the spec asserts the card appears and names the target file, clicks Approve,
// then asserts the real file lands in the explorer through the OS watcher. Nothing about the agent, the
// tools, IPC, or the filesystem is mocked — the reply and the tool call come from real Claude, so the
// prompt pins the exact absolute path and tells the agent to do nothing else; only the native folder dialog
// is stubbed (the one sanctioned human-gesture stub).
//
// @e2e feature:agent-filesystem-approval

import { join } from 'node:path'
import { access } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import { launchApp } from './support/launch-app'
import { stubFolderPicker } from './support/stub-folder-picker'
import { withTempFolder } from './support/temp-folder'

const SEED = 'chapter-1.md'
const NEW_FILE = 'draft.md'

// True iff `path` exists on the real filesystem — so the spec can confirm Approve actually created the
// file on disk, not just rendered a tree row.
const onDisk = async (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false
  )

// A real Claude tool round-trip plus the approval and OS-watcher UI steps need well over the default.
test.setTimeout(240_000)

test('approving a gated create_file call creates the file and shows it in the explorer', async () => {
  await withTempFolder([{ name: SEED, content: '# Chapter One' }], async (folder) => {
    const targetPath = join(folder, NEW_FILE)
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

      const rail = window.getByTestId('conversation-rail')
      await expect(rail).toBeVisible({ timeout: 30_000 })

      // Ask the agent to call the gated create_file tool at an exact absolute path and nothing else, so the
      // real model reliably triggers the one tool call this flow gates.
      const composer = rail.locator('textarea[data-rail-composer]')
      await composer.click()
      await composer.fill(
        `Use the create_file tool to create an empty markdown file at the exact absolute path ` +
          `${targetPath}. Call the tool with that path verbatim and do nothing else — do not reply ` +
          `with prose and do not ask for confirmation.`
      )
      await rail.getByRole('button', { name: 'Send', exact: true }).click()

      // The gated tool suspends the run and surfaces the approval card (a real Claude round-trip first).
      // The card names the file the agent wants to create.
      const card = window.getByTestId('approval-cards')
      await expect(card).toBeVisible({ timeout: 120_000 })
      await expect(card).toContainText(NEW_FILE)

      // Approve: the backend now runs the real create-file use case in-process.
      await card.getByRole('button', { name: 'Approve' }).click()

      // The created file lands in the explorer (generous timeout for the OS watcher) and on disk.
      await expect(window.getByTestId(`file-row:${targetPath}`)).toBeVisible({ timeout: 30_000 })
      await expect.poll(() => onDisk(targetPath)).toBe(true)
    } finally {
      await app.close()
    }
  })
})
