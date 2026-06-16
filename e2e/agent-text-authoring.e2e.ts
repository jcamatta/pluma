// Real-app e2e for the agent's text-authoring tools. Drives the actual built desktop app: opens a real
// folder, opens a seeded manuscript, and asks the real Claude agent to add prose with its insert tools.
// This is the headline proof of the agent-markdown-drafting branch — that the model drives the new
// insert_at / insert tools to write MORE THAN ONE PARAGRAPH wherever it wants, and that the proposal
// applies as real paragraph nodes (not collapsed into one inline block) on Accept.
//
// Three scenarios:
//  A. Draft into an EMPTY document — a three-paragraph opening via insert_at. After Accept the editor
//     holds multiple paragraph nodes, proving the multi-paragraph draft did not collapse.
//  B. Insert AFTER a named first sentence via insert (mode 'after'). After Accept the new paragraph lands
//     BETWEEN the two original paragraphs, proving block-after-block placement.
//  C. Insert BEFORE a named second sentence via insert (mode 'before'). After Accept the new paragraph
//     lands BETWEEN the two original paragraphs, ahead of the named one, proving block-before placement.
//
// Nothing about the agent is mocked; only the native folder dialog is stubbed (the one sanctioned
// human-gesture stub). Each run also records the public agent:tool-call IPC events in the page (the real
// main → renderer half of the frontend-tool round-trip) so we can assert what the model actually emitted
// on the wire — the relevant tool name, a non-empty path, and markdown text. The settle signal is the
// proposal CARD appearing under Review (the "Worked" header renders only for tool turns and is fragile
// here), and the assertions use generous timeouts for the live round-trips.
//
// @e2e feature:agent-text-authoring

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

// Type guards so we can read the unvalidated wire `args` without casting it.
const hasStringField = (value: unknown, field: string): boolean => {
  if (typeof value !== 'object' || value === null) return false
  const record: Record<string, unknown> = { ...value }
  return typeof record[field] === 'string' && record[field] !== ''
}

const stringField = (value: unknown, field: string): string => {
  if (typeof value !== 'object' || value === null) return ''
  const record: Record<string, unknown> = { ...value }
  const candidate = record[field]
  return typeof candidate === 'string' ? candidate : ''
}

const EMPTY_FILE = 'chapter3.md'
const MIDDLE_FILE = 'chapter4.md'
const BEFORE_FILE = 'chapter5.md'

// The mid-document file: two short, distinctly-worded paragraphs. The agent inserts a new block after
// the first sentence (named verbatim), and we assert the new block lands between these two.
const FIRST_SENTENCE = 'The harbor was quiet before dawn.'
const SECOND_SENTENCE = 'By noon the market overflowed with traders.'
const MIDDLE_CONTENT = `${FIRST_SENTENCE}\n\n${SECOND_SENTENCE}`

// Prose prompts that pin the action: name the tool, forbid prose-only replies and confirmation
// questions, and make the shape deterministic enough to assert (exactly three separate paragraphs / a
// single new paragraph in a named place).
const DRAFT_PROMPT =
  'Write a short three-paragraph opening for this chapter directly into the document using your ' +
  'insert_at tool. Exactly three separate paragraphs, each its own paragraph, no headings or lists. ' +
  'First call list_open_files to find the path of the active file, then pass that path to insert_at ' +
  'with the whole draft as Markdown in a single call. Do not reply with prose and do not ask for ' +
  'confirmation.'

const INSERT_AFTER_PROMPT =
  'Insert one new paragraph into the document immediately AFTER this exact sentence: ' +
  `"${FIRST_SENTENCE}" — use your insert tool with mode "after" and that sentence as the anchor. The ` +
  'new paragraph must read as the morning continuing, before the market fills. First call ' +
  'list_open_files to find the path of the active file, then pass that path, mode "after", and the ' +
  'anchor to insert in a single call. Do not reply with prose and do not ask for confirmation.'

const INSERT_BEFORE_PROMPT =
  'Insert one new paragraph into the document immediately BEFORE this exact sentence: ' +
  `"${SECOND_SENTENCE}" — use your insert tool with mode "before" and that sentence as the anchor. The ` +
  'new paragraph must read as the morning continuing, before the market fills. First call ' +
  'list_open_files to find the path of the active file, then pass that path, mode "before", and the ' +
  'anchor to insert in a single call. Do not reply with prose and do not ask for confirmation.'

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

// Two real Claude tool round-trips (read, then act) need well over the default.
test.setTimeout(180_000)

test('drafts a multi-paragraph opening into an empty document via insert_at', async () => {
  await withTempFolder([{ name: EMPTY_FILE, content: '' }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

      const rail = window.getByTestId('conversation-rail')
      await expect(rail).toBeVisible({ timeout: 30_000 })

      await recordToolCalls((fn) => window.evaluate(fn))

      // Open the empty manuscript so the agent's tools can read and write it.
      await window.getByText(EMPTY_FILE, { exact: true }).click()
      await expect(window.locator('.ProseMirror:visible')).toBeVisible({ timeout: 30_000 })

      // Ask the agent to draft three paragraphs in one insert_at call.
      const composer = rail.locator('textarea[data-rail-composer]')
      await composer.click()
      await composer.fill(DRAFT_PROMPT)
      await rail.getByRole('button', { name: 'Send', exact: true }).click()

      // Settle on the proposal CARD appearing under Review — not the "Worked" header, which renders only
      // for tool turns and is fragile here.
      await rail.getByRole('button', { name: /Review/ }).click()
      const cards = rail.locator('[data-testid^="artifact-card:"]')
      await expect(cards.first()).toBeVisible({ timeout: 120_000 })

      // Accept the draft: it applies as real nodes in the visible editor.
      await rail.getByRole('button', { name: 'Accept', exact: true }).click()

      // The point of the whole branch: the multi-paragraph draft did NOT collapse into one block.
      await expect(window.locator('.ProseMirror:visible p')).toHaveCount(3, { timeout: 30_000 })

      // Wire-arg proof: the model emitted insert_at with a non-empty path and markdown text spanning
      // multiple paragraphs (a blank-line separator).
      const calls = await readToolCalls((fn) => window.evaluate(fn))
      const insertAt = calls.find((call) => call.toolName === 'insert_at')
      expect(insertAt, `tool calls seen: ${calls.map((c) => c.toolName).join(', ')}`).toBeDefined()
      const args = insertAt?.args
      expect(hasStringField(args, 'path')).toBe(true)
      expect(hasStringField(args, 'text')).toBe(true)
      expect(stringField(args, 'text')).toContain('\n\n')
    } finally {
      await app.close()
    }
  })
})

test('inserts a new paragraph after a named sentence, via insert mode after', async () => {
  await withTempFolder([{ name: MIDDLE_FILE, content: MIDDLE_CONTENT }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

      const rail = window.getByTestId('conversation-rail')
      await expect(rail).toBeVisible({ timeout: 30_000 })

      await recordToolCalls((fn) => window.evaluate(fn))

      // Open the two-paragraph manuscript.
      await window.getByText(MIDDLE_FILE, { exact: true }).click()
      await expect(window.locator('.ProseMirror:visible')).toContainText('harbor', {
        timeout: 30_000
      })

      const composer = rail.locator('textarea[data-rail-composer]')
      await composer.click()
      await composer.fill(INSERT_AFTER_PROMPT)
      await rail.getByRole('button', { name: 'Send', exact: true }).click()

      // Settle on the proposal card, then accept it.
      await rail.getByRole('button', { name: /Review/ }).click()
      const cards = rail.locator('[data-testid^="artifact-card:"]')
      await expect(cards.first()).toBeVisible({ timeout: 120_000 })
      await rail.getByRole('button', { name: 'Accept', exact: true }).click()

      // The new paragraph landed BETWEEN the two originals: a third paragraph now exists, and the first
      // original sentence still precedes the second. Read the visible editor's paragraph texts in order
      // and assert the new block sits strictly between them.
      const paragraphs = window.locator('.ProseMirror:visible p')
      await expect(paragraphs).toHaveCount(3, { timeout: 30_000 })
      const texts = await paragraphs.allInnerTexts()
      const firstIndex = texts.findIndex((text) => text.includes(FIRST_SENTENCE))
      const secondIndex = texts.findIndex((text) => text.includes(SECOND_SENTENCE))
      expect(firstIndex).toBeGreaterThanOrEqual(0)
      expect(secondIndex).toBeGreaterThan(firstIndex + 1)

      // Wire-arg proof: the model emitted insert with mode 'after', a non-empty path, anchor, and text.
      const calls = await readToolCalls((fn) => window.evaluate(fn))
      const inserted = calls.find((call) => call.toolName === 'insert')
      expect(inserted, `tool calls seen: ${calls.map((c) => c.toolName).join(', ')}`).toBeDefined()
      const args = inserted?.args
      expect(stringField(args, 'mode')).toBe('after')
      expect(hasStringField(args, 'path')).toBe(true)
      expect(hasStringField(args, 'anchor')).toBe(true)
      expect(hasStringField(args, 'text')).toBe(true)
    } finally {
      await app.close()
    }
  })
})

test('inserts a new paragraph before a named sentence, via insert mode before', async () => {
  await withTempFolder([{ name: BEFORE_FILE, content: MIDDLE_CONTENT }], async (folder) => {
    const { app, window } = await launchApp()
    try {
      await stubFolderPicker(app, folder)
      await window.getByRole('button', { name: 'Open Folder', exact: false }).click()

      const rail = window.getByTestId('conversation-rail')
      await expect(rail).toBeVisible({ timeout: 30_000 })

      await recordToolCalls((fn) => window.evaluate(fn))

      // Open the two-paragraph manuscript.
      await window.getByText(BEFORE_FILE, { exact: true }).click()
      await expect(window.locator('.ProseMirror:visible')).toContainText('harbor', {
        timeout: 30_000
      })

      const composer = rail.locator('textarea[data-rail-composer]')
      await composer.click()
      await composer.fill(INSERT_BEFORE_PROMPT)
      await rail.getByRole('button', { name: 'Send', exact: true }).click()

      // Settle on the proposal card, then accept it.
      await rail.getByRole('button', { name: /Review/ }).click()
      const cards = rail.locator('[data-testid^="artifact-card:"]')
      await expect(cards.first()).toBeVisible({ timeout: 120_000 })
      await rail.getByRole('button', { name: 'Accept', exact: true }).click()

      // The new paragraph landed BETWEEN the two originals, ahead of the named second sentence: a third
      // paragraph now exists, and the second original sentence still follows the first.
      const paragraphs = window.locator('.ProseMirror:visible p')
      await expect(paragraphs).toHaveCount(3, { timeout: 30_000 })
      const texts = await paragraphs.allInnerTexts()
      const firstIndex = texts.findIndex((text) => text.includes(FIRST_SENTENCE))
      const secondIndex = texts.findIndex((text) => text.includes(SECOND_SENTENCE))
      expect(firstIndex).toBeGreaterThanOrEqual(0)
      expect(secondIndex).toBeGreaterThan(firstIndex + 1)

      // Wire-arg proof: the model emitted insert with mode 'before', a non-empty path, anchor, and text.
      const calls = await readToolCalls((fn) => window.evaluate(fn))
      const inserted = calls.find((call) => call.toolName === 'insert')
      expect(inserted, `tool calls seen: ${calls.map((c) => c.toolName).join(', ')}`).toBeDefined()
      const args = inserted?.args
      expect(stringField(args, 'mode')).toBe('before')
      expect(hasStringField(args, 'path')).toBe(true)
      expect(hasStringField(args, 'anchor')).toBe(true)
      expect(hasStringField(args, 'text')).toBe(true)
    } finally {
      await app.close()
    }
  })
})
