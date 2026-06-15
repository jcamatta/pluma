// Real-app e2e for the agent's INSERT path. Drives the actual built desktop app: opens a real folder,
// opens a seeded one-sentence manuscript, and asks the real agent to ADD a sentence after a named passage
// with propose_edit's insert operation — not the replace it has always done. The insert rides the existing
// agent-run + artifacts surfaces (the proposal is a from===to point, rendered as an all-green insert diff),
// so this spec claims the existing feature:artifacts manifest id — no new UI region or IPC channel, hence
// no new id. It switches to Review, sees exactly one proposal card showing the inserted text, accepts it,
// and asserts the manuscript actually grew the new sentence while keeping the original passage. Nothing
// about the agent is mocked; only the native folder dialog is stubbed (the one sanctioned human-gesture
// stub). The proposal comes from a real Claude tool call, so the prompt pins the insert deterministically
// (the exact anchor passage, the exact inserted text, and the insert semantics) and tells the agent to
// read the active file's path first; the assertions use generous timeouts for the round-trip.
//
// @e2e feature:artifacts

import { test, expect } from '@playwright/test'
import { launchApp } from './support/launch-app'
import { stubFolderPicker } from './support/stub-folder-picker'
import { withTempFolder } from './support/temp-folder'

const FILE = 'chapter.md'
const ORIGINAL = 'The cat sat on the mat.'
const INSERTED = 'The sun was warm.'

// Pin the insert fully: the anchor is the whole original passage and the inserted text is exact, so the
// agent's single propose_edit call is deterministic enough to assert on. The prompt spells out the
// insert-after semantics so the model can't fall back to a replace.
const PROMPT =
  'Use your editing tools to insert text into the document, then stop. First call list_open_files to ' +
  'find the path of the active file. Then call propose_edit on that path with operation "insert", anchor ' +
  `the exact passage "${ORIGINAL}", and text " ${INSERTED}" — operation insert adds your text immediately ` +
  'after the anchor passage. Do not reply with prose and do not ask for confirmation.'

// A real Claude tool round-trip (read, then act) needs well over the default.
test.setTimeout(180_000)

test('inserts a sentence after a named passage and applies it on Accept', async () => {
  await withTempFolder([{ name: FILE, content: ORIGINAL }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

      const rail = window.getByTestId('conversation-rail')
      await expect(rail).toBeVisible({ timeout: 30_000 })

      // Open the seeded manuscript so the editor holds the content the agent's insert anchors on.
      await window.getByText(FILE, { exact: true }).click()
      await expect(window.locator('.ProseMirror')).toContainText('cat', { timeout: 30_000 })

      // Ask the agent to insert; this is a tool turn, so the step header ('Worked') is the run-settled
      // signal.
      const composer = rail.locator('textarea[data-rail-composer]')
      await composer.click()
      await composer.fill(PROMPT)
      await rail.getByRole('button', { name: 'Send', exact: true }).click()
      await expect(rail.getByText('Worked', { exact: true })).toBeVisible({ timeout: 120_000 })

      // The insert proposal appears as a single card under the Review tab, showing the inserted text (an
      // all-green insert diff). Scope to the cards — the header echoes the prompt, which also contains the
      // sentence, so a bare page text match would be ambiguous.
      await rail.getByRole('button', { name: /Review/ }).click()
      const cards = rail.locator('[data-testid^="artifact-card:"]')
      await expect(cards).toHaveCount(1, { timeout: 30_000 })
      await expect(cards.filter({ hasText: 'The sun was warm' })).toBeVisible()

      // Accepting the insert adds the new sentence to the manuscript while preserving the original passage.
      await rail.getByRole('button', { name: 'Accept', exact: true }).click()
      await expect(window.locator('.ProseMirror:visible')).toContainText('The sun was warm', {
        timeout: 30_000
      })
      await expect(window.locator('.ProseMirror:visible')).toContainText('mat.')
    } finally {
      await app.close()
    }
  })
})
