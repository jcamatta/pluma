// Real-app e2e for thread history. Drives the actual built desktop app end to end: opens a real folder,
// runs a real agent turn (creating a thread), opens the threads list (agent.list-threads), renames the
// thread (agent.rename-thread) and asserts the new title, selects it to load its transcript
// (agent.thread-history), sends a follow-up that resumes the same SDK session, then deletes it
// (agent.delete-thread) and asserts it leaves the list. The replies come from real Claude calls, so the
// prompts pin a sentinel word and assertions are case-insensitive with generous timeouts. Nothing about
// the agent or threads is mocked; only the native folder dialog is stubbed.
//
// @e2e feature:thread-history
// @e2e operation:agent.list-threads operation:agent.thread-history operation:agent.rename-thread operation:agent.delete-thread

import { test, expect } from '@playwright/test'
import { launchApp } from './support/launch-app'
import { stubFolderPicker } from './support/stub-folder-picker'
import { withTempFolder } from './support/temp-folder'

const SENTINEL = 'PLUMA'
const PROMPT = `Reply with exactly the single word ${SENTINEL} and nothing else.`
const FOLLOW_UP = `Once more, reply with exactly the single word ${SENTINEL} and nothing else.`
const NEW_TITLE = 'My first chat'

// Two real Claude round-trips plus several UI steps need well over Playwright's default.
test.setTimeout(240_000)

test('lists, renames, resumes and deletes a past thread', async () => {
  await withTempFolder([{ name: 'chapter-1.md', content: '# Chapter One' }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

      const rail = window.getByTestId('conversation-rail')
      await expect(rail).toBeVisible({ timeout: 30_000 })

      // Run one turn so a thread (SDK session) exists for this workspace.
      const composer = rail.locator('textarea[data-rail-composer]')
      await composer.click()
      await composer.fill(PROMPT)
      await rail.getByRole('button', { name: 'Send', exact: true }).click()
      await expect(rail.getByTestId('assistant-reply')).toContainText(SENTINEL, {
        ignoreCase: true,
        timeout: 120_000
      })

      // Open the threads list; the run that just finished should have surfaced one thread.
      await rail.getByRole('button', { name: 'Show chats' }).click()
      const panel = window.getByTestId('threads-panel')
      await expect(panel).toBeVisible()
      const row = panel.locator('[data-testid^="thread-row:"]').first()
      await expect(row).toBeVisible({ timeout: 30_000 })

      // Rename it inline and assert the new title shows.
      await row.hover()
      await row.getByRole('button', { name: 'Rename chat' }).click()
      const titleField = panel.getByRole('textbox')
      await titleField.fill(NEW_TITLE)
      await titleField.press('Enter')
      await expect(panel.getByText(NEW_TITLE)).toBeVisible({ timeout: 30_000 })

      // Select it: the panel closes back to chat and its transcript loads with the original exchange.
      await panel.locator('[data-testid^="thread-row:"]', { hasText: NEW_TITLE }).click()
      await expect(rail).toBeVisible({ timeout: 30_000 })
      const transcript = rail.getByTestId('thread-transcript')
      await expect(transcript).toBeVisible({ timeout: 30_000 })
      await expect(transcript).toContainText('Reply with exactly')

      // Send a follow-up; resuming the session yields another sentinel reply.
      await composer.click()
      await composer.fill(FOLLOW_UP)
      await rail.getByRole('button', { name: 'Send', exact: true }).click()
      await expect(rail.getByTestId('assistant-reply')).toContainText(SENTINEL, {
        ignoreCase: true,
        timeout: 120_000
      })

      // Delete the thread from the list; confirming closes the panel (the active thread was removed).
      await rail.getByRole('button', { name: 'Show chats' }).click()
      const namedRow = panel.locator('[data-testid^="thread-row:"]', { hasText: NEW_TITLE })
      await namedRow.hover()
      await namedRow.getByRole('button', { name: 'Delete chat' }).click()
      await window.getByRole('button', { name: 'Delete', exact: true }).click()

      // Re-open the list and assert the thread is gone.
      await rail.getByRole('button', { name: 'Show chats' }).click()
      await expect(panel.getByText(NEW_TITLE)).toHaveCount(0, { timeout: 30_000 })
    } finally {
      await app.close()
    }
  })
})
