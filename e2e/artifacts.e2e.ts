// Real-app e2e for the artifacts panel. Drives the actual built desktop app: opens a real folder, opens a
// seeded manuscript, and asks the real agent to propose an edit with its tools. The proposal the agent
// produces lands in the editor's plugin state; the rail's Review tab lists it as a card. The spec switches
// to Review, sees the proposal card, accepts it, and asserts the manuscript text actually changed — the
// whole produce → review → apply loop a writer sees. Nothing about the agent is mocked; only the native
// folder dialog is stubbed (the one sanctioned human-gesture stub). The proposal comes from a real Claude
// tool call, so the prompt pins the exact edit and the assertions use generous timeouts for the round-trip.
//
// @e2e feature:artifacts

import { test, expect } from '@playwright/test'
import { launchApp } from './support/launch-app'
import { stubFolderPicker } from './support/stub-folder-picker'
import { withTempFolder } from './support/temp-folder'

const FILE = 'chapter.md'
const ORIGINAL = 'The cat sat on the mat.'
// A single, fully specified edit so the agent's tool call is deterministic enough to assert on.
const PROMPT =
  'Use your editing tools to propose replacing the word "cat" with "dog" in the document. ' +
  'Call propose_edit. Do not reply with prose and do not ask for confirmation.'

// A real Claude round-trip (resolve the range, then call propose_edit) needs well over Playwright's default.
test.setTimeout(120_000)

test('shows an agent proposal in the Review tab and applies it on Accept', async () => {
  await withTempFolder([{ name: FILE, content: ORIGINAL }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

      const rail = window.getByTestId('conversation-rail')
      await expect(rail).toBeVisible({ timeout: 30_000 })

      // Open the seeded manuscript so the editor holds the content the agent's tools read.
      await window.getByText(FILE, { exact: true }).click()
      await expect(window.locator('.ProseMirror')).toContainText('cat', { timeout: 30_000 })

      // Ask the agent to propose the edit; wait for the run to settle.
      const composer = rail.locator('textarea[data-rail-composer]')
      await composer.click()
      await composer.fill(PROMPT)
      await rail.getByRole('button', { name: 'Send', exact: true }).click()
      await expect(rail.getByText('Worked', { exact: true })).toBeVisible({ timeout: 90_000 })

      // The proposal appears as a card under the Review tab.
      await rail.getByRole('button', { name: /Review/ }).click()
      const card = rail.locator('[data-testid^="artifact-card:"]').first()
      await expect(card).toBeVisible({ timeout: 30_000 })
      await expect(card).toContainText('dog')

      // Accepting applies the rewrite to the manuscript text.
      await card.getByRole('button', { name: 'Accept', exact: true }).click()
      await expect(window.locator('.ProseMirror')).toContainText('dog', { timeout: 30_000 })
    } finally {
      await app.close()
    }
  })
})
