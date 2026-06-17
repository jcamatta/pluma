// Real-app e2e for the agent acting on a file it has never opened. Drives the actual built desktop app:
// a workspace holds two manuscripts, the user opens chapter.md so it is the ACTIVE editor, and notes.md
// is present in the workspace but NOT open (no tab). The real agent (nothing mocked) is told to annotate
// notes.md by its absolute path — a path it reads with read_file / the acting tool's own pre-read, never
// having opened the file. Pluma must open notes.md in a BACKGROUND tab to stage the annotation: a tab for
// it appears in the strip and STAYS open (the writer needs to see the artifact's file), the annotation
// lands on it, and crucially chapter.md REMAINS the active tab — the background open does not steal focus.
//
// Only the native folder dialog is stubbed (the one sanctioned human-gesture stub); the folder/file IPC,
// the editor lifecycle, and the agent tool calls all run for real.
//
// Run signal: a visible reply does not mean the run finished and the "Worked" step header renders only for
// tool turns, so neither is a reliable end-of-run signal. We confirm the run started by the composer
// swapping its Send button for a Stop button (verified against RailComposer.view.tsx, where `working`
// toggles them), then assert directly on the observable outcomes (the background tab and the annotation
// card) with generous timeouts that naturally wait for the agent's tool calls. We run no thread-list
// operations, so the settle race that can resurrect a deleted thread does not apply here.
//
// Active-tab assertion: the tab strip renders Base UI Tabs.Tab (role="tab", aria-selected), with the active
// tab marked by aria-selected="true" — verified against EditorTabStrip.view.tsx (the data-[active] styling
// is Base UI's own marker, surfaced to the accessibility tree as aria-selected) and matching editor-tabs.e2e.ts.
//
// @e2e feature:agent-background-file

import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { launchApp } from './support/launch-app'
import { stubFolderPicker } from './support/stub-folder-picker'
import { withTempFolder } from './support/temp-folder'

const ACTIVE_FILE = 'chapter.md'
const ACTIVE_CONTENT = 'The owl flew over the hill.'
const CLOSED_FILE = 'notes.md'
const CLOSED_CONTENT = 'Loose research notes to follow up on later.'
const ANNOTATION_LABEL = 'NOTE'

// One real Claude tool round-trip (read the closed file, then annotate it) needs well over the default.
test.setTimeout(180_000)

test('agent annotates a closed file by path: it opens in a background tab while the active tab keeps focus', async () => {
  await withTempFolder(
    [
      { name: ACTIVE_FILE, content: ACTIVE_CONTENT },
      { name: CLOSED_FILE, content: CLOSED_CONTENT }
    ],
    async (folder) => {
      const { app, window } = await launchApp()
      try {
        await stubFolderPicker(app, folder)
        await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

        const rail = window.getByTestId('conversation-rail')
        await expect(rail).toBeVisible({ timeout: 30_000 })

        // The first markdown file auto-opens, so chapter.md is the active editor. notes.md is present in
        // the workspace but NOT open — there is no tab for it yet.
        await expect(window.getByRole('tab', { name: 'chapter' })).toHaveAttribute(
          'aria-selected',
          'true'
        )
        await expect(window.getByRole('tab', { name: 'notes' })).toHaveCount(0)
        await expect(window.locator('.ProseMirror:visible')).toContainText('owl', {
          timeout: 30_000
        })

        // Tell the agent the absolute path of the CLOSED file directly, so the run is deterministic and the
        // file is one it reaches purely by path (read_file / the acting tool's own pre-read) — it never
        // opens notes.md itself. Acting on its path must open it in the background.
        const closedPath = join(folder, CLOSED_FILE)
        const prompt =
          'Use your editing tools to annotate a file you have not opened, then stop. ' +
          `The file is at the absolute path ${closedPath}. Read it with read_file, then call ` +
          `create_annotation on the word "research" in that file with label "${ANNOTATION_LABEL}" and ` +
          'description "A loose thread to follow.", passing that same absolute path to create_annotation. ' +
          'Do not reply with prose and do not ask for confirmation.'

        const composer = rail.locator('textarea[data-rail-composer]')
        await composer.click()
        await composer.fill(prompt)
        await rail.getByRole('button', { name: 'Send', exact: true }).click()

        // The composer swaps Send for Stop while the run is in flight, confirming the run started. We do
        // not gate the assertions on full run-settle (a visible reply does not mean the run finished and
        // the "Worked" header renders only for tool turns) — and we run no thread-list operations, so the
        // settle race that resurrects a deleted thread does not apply here. Instead we wait directly on the
        // observable outcomes with generous timeouts, which naturally wait for the agent's tool calls.
        await expect(rail.getByRole('button', { name: 'Stop', exact: true })).toBeVisible({
          timeout: 30_000
        })

        // Acting on the closed file's path opens it in a BACKGROUND tab: a tab for notes.md appears in the
        // strip (it was not open before). This is the agent's create_annotation forcing the background open.
        await expect(window.getByRole('tab', { name: 'notes' })).toBeVisible({ timeout: 150_000 })

        // Focus did NOT move: chapter.md is still the active tab, notes.md opened only in the background,
        // and the visible editor is still chapter.md.
        await expect(window.getByRole('tab', { name: 'chapter' })).toHaveAttribute(
          'aria-selected',
          'true'
        )
        await expect(window.getByRole('tab', { name: 'notes' })).toHaveAttribute(
          'aria-selected',
          'false'
        )
        await expect(window.locator('.ProseMirror:visible')).toContainText('owl')

        // notes.md carries the annotation: its Review card is labeled with that file while the visible
        // editor is still chapter.md. The tab for notes.md STAYS open through this (it is not auto-closed).
        await rail.getByRole('button', { name: /Review/ }).click()
        const card = rail
          .locator('[data-testid^="artifact-card:"]')
          .filter({ hasText: ANNOTATION_LABEL })
        await expect(card).toBeVisible({ timeout: 60_000 })
        await expect(card).toContainText('notes')
        await expect(window.getByRole('tab', { name: 'notes' })).toBeVisible()

        // Clicking the card switches to notes.md and reveals the annotation decoration there.
        await card.click()
        await expect(window.getByRole('tab', { name: 'notes' })).toHaveAttribute(
          'aria-selected',
          'true'
        )
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
