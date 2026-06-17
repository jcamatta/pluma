// Handlers for `insert_at` and `insert`: stage a zero-width content insertion for the user to accept or
// reject inline. Both parse the agent's markdown `text` to real nodes (so multi-paragraph / structured
// content applies correctly on accept) and create a proposal whose span is a single point
// (`from === to`) — a pure insert that Step 1's accept path turns into real nodes.
//
// `insert_at` resolves the point from `position`: 'end' appends after the last block; 'start' prepends
// before existing content. The empty-doc start case is special — an empty TipTap doc is
// `doc(paragraph())`, so inserting *before* its empty paragraph would leave a stray trailing empty
// block. There we replace that empty block's whole range instead, so the result is exactly the drafted
// nodes.
//
// `insert` resolves the anchor to a span, then lifts to a BLOCK BOUNDARY of the anchor's containing
// block rather than the raw char position, so the new block lands beside the block instead of splitting
// it: mode 'after' uses the block's END (`$to.after($to.depth)`), mode 'before' its START
// (`$from.before($from.depth)`). A missing or repeated anchor (not_found / ambiguous) fails recoverably.

import type { Editor } from '@tiptap/core'
import { createProposal } from '../../editor/extensions/proposals'
import { resolveAnchor } from './resolve-anchor'
import type { AgentToolResult } from './types'

interface InsertAtInput {
  readonly editor: Editor
  readonly position: 'start' | 'end'
  readonly text: string
}

interface InsertInput {
  readonly editor: Editor
  readonly mode: 'before' | 'after'
  readonly anchor: string
  readonly text: string
}

interface InsertPoint {
  readonly from: number
  readonly to: number
}

// True when the document holds only one empty block (the default `doc(paragraph())`). A start insert
// then replaces that block's range so no stray empty paragraph survives.
function isEmptyDoc(editor: Editor): boolean {
  const { doc } = editor.state
  return doc.childCount === 1 && doc.firstChild !== null && doc.firstChild.content.size === 0
}

function insertAtPoint(editor: Editor, position: 'start' | 'end'): InsertPoint {
  if (position === 'end') {
    const end = editor.state.doc.content.size
    return { from: end, to: end }
  }
  if (isEmptyDoc(editor)) return { from: 0, to: editor.state.doc.content.size }
  return { from: 0, to: 0 }
}

interface StagedInsertion {
  readonly point: InsertPoint
  readonly text: string
}

function stageInsertion(editor: Editor, { point, text }: StagedInsertion): AgentToolResult {
  const markdown = editor.markdown
  if (!markdown) return { ok: false, error: 'markdown_unavailable' }

  const content = markdown.parse(text)
  const originalText = editor.state.doc.textBetween(point.from, point.to, '\n')

  const result = createProposal({
    editor,
    proposal: { from: point.from, to: point.to, originalText, replacementText: text, content }
  })
  if (!result.ok) return { ok: false, error: result.error }

  return {
    ok: true,
    output: { type: 'json', value: { proposalId: result.proposal.id, status: 'proposed' } }
  }
}

function insertAt({ editor, position, text }: InsertAtInput): AgentToolResult {
  return stageInsertion(editor, { point: insertAtPoint(editor, position), text })
}

interface AnchorBoundary {
  readonly mode: 'before' | 'after'
  readonly span: InsertPoint
}

// Lift the resolved anchor span to a block boundary so the new block lands beside the anchor's block
// rather than splitting it: 'after' uses the block's end, 'before' its start.
function anchorBoundary(editor: Editor, { mode, span }: AnchorBoundary): number {
  if (mode === 'after') {
    const $to = editor.state.doc.resolve(span.to)
    return $to.after($to.depth)
  }
  const $from = editor.state.doc.resolve(span.from)
  return $from.before($from.depth)
}

function insert({ editor, mode, anchor, text }: InsertInput): AgentToolResult {
  const resolved = resolveAnchor(editor, anchor)
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const pos = anchorBoundary(editor, {
    mode,
    span: { from: resolved.from, to: resolved.to }
  })
  return stageInsertion(editor, { point: { from: pos, to: pos }, text })
}

export { insertAt, insert }
export type { InsertAtInput, InsertInput }
