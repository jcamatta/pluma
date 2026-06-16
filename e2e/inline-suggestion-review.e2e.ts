// Real-app e2e for the INLINE suggestion-review surface. Drives the actual built desktop app: opens a
// real folder, opens a seeded manuscript, and asks the real Claude agent to produce both a review NOTE
// (create_annotation) and a rewrite PROPOSAL (propose_edit). It then proves the new in-editor surface —
// NOT the rail "Review" tab (that older surface still ships this PR but is not what we are validating):
//
//  - the suggestions sub-topbar (header row 2) appears once the file has suggestions, showing the count /
//    "N to review" state and its Hide all + List controls. We settle the live run on this bar appearing
//    rather than the "Worked" step header, which renders only for tool turns and is fragile here;
//  - inline decorations render in the visible editor (the green rewrite preview and the amber annotation
//    highlight);
//  - accepting a rewrite via its in-prose accept/reject pill changes the document text and drops the
//    pending count, and the per-tab (N) badge tracks that count;
//  - clicking the annotation opens its floating card, and "Got it" marks it read.
//
// Nothing about the agent is mocked; only the native folder dialog is stubbed (the one sanctioned
// human-gesture stub). The run also records the public agent:tool-call IPC events in the page so we can
// assert what the model actually emitted on the wire — create_annotation and propose_edit with non-empty
// fields. The live round-trips use generous timeouts, and every ProseMirror selector is scoped to the
// VISIBLE editor (two editors can mount once more than one file is open — the strict-mode trap).
//
// @e2e feature:inline-suggestion-review

import { test, expect } from '@playwright/test'
import { launchApp } from './support/launch-app'
import { stubFolderPicker } from './support/stub-folder-picker'
import { withTempFolder } from './support/temp-folder'

// A single recorded agent:tool-call, narrowed to the wire fields the spec asserts on. The page reads
// these back out of window after a run; everything here must be JSON-serializable across the bridge.
type RecordedCall = {
  readonly toolName: string
  readonly args: unknown
}

// Minimal view of the window members the in-page recorder touches: api.on to subscribe to the tool-call
// channel, and a stash for what it records. Declared (not assigned from the real preload type) so the
// page code is fully typed without an `as` cast on window.api.
declare global {
  interface Window {
    readonly api: {
      readonly on: (channel: string, callback: (call: RecordedCall) => void) => () => void
    }
    __toolCalls?: RecordedCall[]
  }
}

// Type guard so we can read the unvalidated wire `args` without casting it.
const hasStringField = (value: unknown, field: string): boolean => {
  if (typeof value !== 'object' || value === null) return false
  const record: Record<string, unknown> = { ...value }
  return typeof record[field] === 'string' && record[field] !== ''
}

const MANUSCRIPT_FILE = 'chapter1.md'

// Two short, distinctly-worded sentences. The agent annotates the first and proposes a rewrite of the
// second; we name each verbatim in the prompt and assert against them in the editor.
const ANNOTATE_SENTENCE = 'The harbor was quiet before dawn.'
const REWRITE_SENTENCE = 'By noon the market overflowed with traders.'
const MANUSCRIPT_CONTENT = `${ANNOTATE_SENTENCE}\n\n${REWRITE_SENTENCE}`

// One deterministic prompt that pins BOTH tools by name, names each exact sentence verbatim, and forbids
// prose-only replies and confirmation questions — mirroring agent-text-authoring's prompt style so the
// model reliably emits create_annotation and propose_edit in a single turn.
const REVIEW_PROMPT =
  'Do two things to this document, using your tools — do not reply with prose and do not ask for ' +
  'confirmation. First call list_open_files to find the path of the active file. Then (1) use your ' +
  `create_annotation tool to attach a short review note to this exact sentence: "${ANNOTATE_SENTENCE}" ` +
  '— pass that sentence verbatim as the passage, a short label, and a one-line description. And (2) use ' +
  `your propose_edit tool to propose replacing this exact sentence: "${REWRITE_SENTENCE}" with a ` +
  'tighter rewrite of it. Make both tool calls.'

// Install the in-page recorder before sending a prompt so no agent:tool-call is missed. It runs in the
// page, subscribing to the same public channel the renderer's tool bridge uses.
const recordToolCalls = async (evaluate: (fn: () => void) => Promise<void>): Promise<void> => {
  await evaluate(() => {
    window.__toolCalls = []
    window.api.on('agent:tool-call', (call) => {
      const calls = window.__toolCalls
      if (calls) calls.push({ toolName: call.toolName, args: call.args })
    })
  })
}

const readToolCalls = (
  evaluate: (fn: () => readonly RecordedCall[]) => Promise<readonly RecordedCall[]>
): Promise<readonly RecordedCall[]> => evaluate(() => window.__toolCalls ?? [])

// One real Claude turn that reads the document and emits two tool calls needs well over the default.
test.setTimeout(180_000)

test('renders agent suggestions inline and reviews them in the editor', async () => {
  await withTempFolder([{ name: MANUSCRIPT_FILE, content: MANUSCRIPT_CONTENT }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

      const rail = window.getByTestId('conversation-rail')
      await expect(rail).toBeVisible({ timeout: 30_000 })

      await recordToolCalls((fn) => window.evaluate(fn))

      // Open the seeded manuscript so the agent's tools can read and annotate/rewrite it.
      await window.getByText(MANUSCRIPT_FILE, { exact: true }).click()
      const editor = window.locator('.ProseMirror:visible')
      await expect(editor).toContainText('harbor', { timeout: 30_000 })

      // Ask the agent for one annotation and one rewrite in a single turn.
      const composer = rail.locator('textarea[data-rail-composer]')
      await composer.click()
      await composer.fill(REVIEW_PROMPT)
      await rail.getByRole('button', { name: 'Send', exact: true }).click()

      // Settle on the suggestions sub-topbar appearing — it renders only once the file has suggestions,
      // so its presence proves both inline suggestions landed (more reliable than the "Worked" header,
      // which renders only for tool turns). Its "Suggestions" label and Hide all / List controls confirm
      // the new surface is the one under test.
      const suggestionsBar = window.locator('.suggestions-bar')
      await expect(suggestionsBar).toBeVisible({ timeout: 120_000 })
      await expect(suggestionsBar).toContainText('Suggestions')
      await expect(suggestionsBar).toContainText('to review')
      await expect(suggestionsBar.getByRole('button', { name: 'Hide all' })).toBeVisible()
      await expect(suggestionsBar.getByRole('button', { name: 'List' })).toBeVisible()

      // The per-tab pending badge reflects the count: two pending suggestions (the note + the rewrite).
      await expect(window.getByLabel('2 pending suggestions')).toBeVisible({ timeout: 30_000 })

      // Inline decorations render in the VISIBLE editor: the green rewrite preview (the proposal draft
      // widget) and the amber annotation highlight (default 'warning' severity).
      await expect(editor.locator('.proposal-draft')).toBeVisible({ timeout: 30_000 })
      await expect(editor.locator('.annotation-warning').first()).toBeVisible()

      // Wire-arg proof: the model emitted create_annotation (path + passage text + label + description)
      // and propose_edit (path + passage + replacement text), each with non-empty fields.
      const calls = await readToolCalls((fn) => window.evaluate(fn))
      const seen = calls.map((call) => call.toolName).join(', ')

      const annotation = calls.find((call) => call.toolName === 'create_annotation')
      expect(annotation, `tool calls seen: ${seen}`).toBeDefined()
      expect(hasStringField(annotation?.args, 'path')).toBe(true)
      expect(hasStringField(annotation?.args, 'text')).toBe(true)
      expect(hasStringField(annotation?.args, 'label')).toBe(true)
      expect(hasStringField(annotation?.args, 'description')).toBe(true)

      const proposal = calls.find((call) => call.toolName === 'propose_edit')
      expect(proposal, `tool calls seen: ${seen}`).toBeDefined()
      expect(hasStringField(proposal?.args, 'path')).toBe(true)
      expect(hasStringField(proposal?.args, 'passage')).toBe(true)
      expect(hasStringField(proposal?.args, 'text')).toBe(true)

      // Accept the rewrite via its in-prose pill: clicking the green preview reveals the active pill, then
      // Accept applies it. The original sentence ("market overflowed") is replaced by the new text, so it
      // disappears from the document.
      await editor.locator('.proposal-draft').click()
      const acceptPill = window.locator('.suggestion-pill').getByRole('button', { name: 'Accept' })
      await expect(acceptPill).toBeVisible({ timeout: 30_000 })
      await acceptPill.click()

      await expect(editor).not.toContainText('market overflowed', { timeout: 30_000 })
      // Accepting the rewrite removes it from review: only the note remains pending.
      await expect(window.getByLabel('1 pending suggestions')).toBeVisible({ timeout: 30_000 })

      // Clicking the annotation highlight opens its floating card; "Got it" marks the note read, which
      // clears the last pending suggestion and removes the per-tab badge entirely.
      await editor.locator('.annotation-warning').first().click()
      const card = window.getByTestId('annotation-card')
      await expect(card).toBeVisible({ timeout: 30_000 })
      await card.getByRole('button', { name: 'Got it' }).click()

      await expect(window.getByLabel(/pending suggestions/)).toHaveCount(0, { timeout: 30_000 })
    } finally {
      await app.close()
    }
  })
})
