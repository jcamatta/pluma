// Real-app e2e for the artifacts panel. Drives the actual built desktop app: opens a real folder, opens a
// seeded manuscript, and asks the real agent to produce BOTH kinds of artifact with its tools — an
// annotation on one word and a rewrite proposal on another. They land in the editor's plugin state; the
// rail's Review tab lists them as cards. The spec switches to Review, sees both cards, accepts the
// proposal, and asserts the manuscript text actually changed — the whole produce → review → apply loop a
// writer sees. It then activates the annotation, leaves the file for a second one, and comes back through
// the card: the card stays in the panel labeled with its file, and because leaving deactivated it a single
// click reopens that file and re-activates its highlight (the regressions where artifacts died after
// switching files, a card for a non-active file did nothing, and a stale-active card needed two clicks).
// A second test proves path-addressing: with chapter.md active, the agent is told to annotate notes.md by
// name. It discovers the file with list_open_files and passes that path to the acting tools, so the
// artifact lands on a file the user is not viewing — no UI navigation — and the card is labeled with it.
// Nothing about the agent is mocked; only the native folder dialog is stubbed (the one sanctioned
// human-gesture stub). The artifacts come from real Claude tool calls (this also exercises the
// frontend-tool permission allow-list in build-options), so the prompt pins each edit and tells the agent
// to read the file's path first, and the assertions use generous timeouts for the round-trips.
//
// @e2e feature:artifacts
// @e2e feature:artifacts-cross-file

import { test, expect } from '@playwright/test'
import { launchApp } from './support/launch-app'
import { stubFolderPicker } from './support/stub-folder-picker'
import { withTempFolder } from './support/temp-folder'

const FILE = 'chapter.md'
const SECOND_FILE = 'notes.md'
const SECOND_CONTENT = 'Loose research notes.'
const ORIGINAL = 'The cat sat on the mat.'
const ANNOTATION_LABEL = 'TENSION'
// Two fully specified edits on different words so the agent's tool calls are deterministic enough to
// assert on, and the annotation/proposal ranges do not overlap.
const PROMPT =
  'Use your editing tools to do BOTH of these in the document, then stop:\n' +
  `1. Call create_annotation on the word "cat" with label "${ANNOTATION_LABEL}" and description ` +
  '"Consider a sharper image.".\n' +
  '2. Call propose_edit to replace the word "mat" with "rug".\n' +
  'First call list_open_files to find the path of the active file, then read it with read_file and ' +
  'pass that path, plus the exact word, to create_annotation and propose_edit. ' +
  'Do not reply with prose and do not ask for confirmation.'

// The cross-file run: the user is active in chapter.md, but the agent is told to annotate notes.md by
// name. It must discover the path with list_open_files and pass it to the acting tools — the artifact
// lands on a file the user is not viewing, with no UI navigation.
const CROSS_FILE_LABEL = 'NOTE'
const CROSS_FILE_PROMPT =
  'Annotate a different file without leaving the one you are viewing, then stop. ' +
  'Call list_open_files and find the file named "notes.md". In that file — pass its path to every ' +
  `tool — call create_annotation on the word "research" with label ` +
  `"${CROSS_FILE_LABEL}" and description "A loose thread to follow.". Do not touch any other file. ` +
  'Do not reply with prose and do not ask for confirmation.'

// Two real Claude tool round-trips (read, then act, twice over) need well over the default.
test.setTimeout(180_000)

test('shows the agent annotation and proposal in Review, and applies the proposal on Accept', async () => {
  await withTempFolder(
    [
      { name: FILE, content: ORIGINAL },
      { name: SECOND_FILE, content: SECOND_CONTENT }
    ],
    async (folder) => {
      const { app, window } = await launchApp()
      try {
        await stubFolderPicker(app, folder)
        await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

        const rail = window.getByTestId('conversation-rail')
        await expect(rail).toBeVisible({ timeout: 30_000 })

        // Open the seeded manuscript so the editor holds the content the agent's tools read.
        await window.getByText(FILE, { exact: true }).click()
        await expect(window.locator('.ProseMirror')).toContainText('cat', { timeout: 30_000 })

        // Ask the agent to produce both artifacts; wait for the run to settle.
        const composer = rail.locator('textarea[data-rail-composer]')
        await composer.click()
        await composer.fill(PROMPT)
        await rail.getByRole('button', { name: 'Send', exact: true }).click()
        await expect(rail.getByText('Worked', { exact: true })).toBeVisible({ timeout: 120_000 })

        // Both artifacts appear as cards under the Review tab: the annotation (its label) and the proposal
        // (its replacement text). Scope to the cards — the header shows the prompt, which mentions the same
        // words, so a bare text match would be ambiguous.
        await rail.getByRole('button', { name: /Review/ }).click()
        const cards = rail.locator('[data-testid^="artifact-card:"]')
        await expect(cards).toHaveCount(2, { timeout: 30_000 })
        await expect(cards.filter({ hasText: ANNOTATION_LABEL })).toBeVisible()
        await expect(cards.filter({ hasText: 'rug' })).toBeVisible()

        // Accepting the proposal applies the rewrite to the manuscript text.
        await rail.getByRole('button', { name: 'Accept', exact: true }).click()
        await expect(window.locator('.ProseMirror:visible')).toContainText('rug', {
          timeout: 30_000
        })

        // Activate the annotation on its own file: clicking its card lights its highlight decoration in
        // the visible editor. This is the active state we then expect leaving the file to clear.
        const annotationCard = cards.filter({ hasText: ANNOTATION_LABEL })
        await annotationCard.click()
        await expect(
          window.locator('.ProseMirror:visible [class*="annotation-"]').first()
        ).toBeVisible()

        // Leave the manuscript for a second file: its editor stays mounted but hidden, so the visible
        // editor now shows the other file. The card survives in the panel, labeled with the file it
        // belongs to (its basename) — it no longer lives on the active editor.
        await window.getByText(SECOND_FILE, { exact: true }).click()
        await expect(window.locator('.ProseMirror:visible')).toContainText('research', {
          timeout: 30_000
        })
        await expect(annotationCard).toBeVisible()
        await expect(annotationCard).toContainText('chapter')

        // Leaving deactivated the annotation, so a SINGLE click on its card reopens the file (its rewritten
        // text is back) and re-activates its highlight — not a stale-active first click that would only
        // toggle it off and never navigate.
        await annotationCard.click()
        await expect(window.locator('.ProseMirror:visible')).toContainText('rug', {
          timeout: 30_000
        })
        await expect(
          window.locator('.ProseMirror:visible [class*="annotation-"]').first()
        ).toBeVisible()
      } finally {
        await app.close()
      }
    }
  )
})

test('annotates a non-active file by path, addressed by the agent through list_open_files', async () => {
  await withTempFolder(
    [
      { name: FILE, content: ORIGINAL },
      { name: SECOND_FILE, content: SECOND_CONTENT }
    ],
    async (folder) => {
      const { app, window } = await launchApp()
      try {
        await stubFolderPicker(app, folder)
        await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

        const rail = window.getByTestId('conversation-rail')
        await expect(rail).toBeVisible({ timeout: 30_000 })

        // Open both files so both editors are mounted (list_open_files reads the open set), then make
        // chapter.md the active one — notes.md stays open but out of view.
        await window.getByText(SECOND_FILE, { exact: true }).click()
        await expect(window.locator('.ProseMirror:visible')).toContainText('research', {
          timeout: 30_000
        })
        await window.getByText(FILE, { exact: true }).click()
        await expect(window.locator('.ProseMirror:visible')).toContainText('cat', {
          timeout: 30_000
        })

        // Ask the agent to annotate notes.md by name while chapter.md is the active file.
        const composer = rail.locator('textarea[data-rail-composer]')
        await composer.click()
        await composer.fill(CROSS_FILE_PROMPT)
        await rail.getByRole('button', { name: 'Send', exact: true }).click()

        // The annotation lands on notes.md: a card appears labeled with that file while the visible editor
        // is still chapter.md — the agent reached another open file purely by the path it discovered.
        await rail.getByRole('button', { name: /Review/ }).click()
        const card = rail
          .locator('[data-testid^="artifact-card:"]')
          .filter({ hasText: CROSS_FILE_LABEL })
        await expect(card).toBeVisible({ timeout: 120_000 })
        await expect(card).toContainText('notes')
        await expect(window.locator('.ProseMirror:visible')).toContainText('cat')

        // Clicking the card opens notes.md and reveals the annotation there.
        await card.click()
        await expect(window.locator('.ProseMirror:visible')).toContainText('research', {
          timeout: 30_000
        })
        await expect(
          window.locator('.ProseMirror:visible [class*="annotation-"]').first()
        ).toBeVisible()
      } finally {
        await app.close()
      }
    }
  )
})
