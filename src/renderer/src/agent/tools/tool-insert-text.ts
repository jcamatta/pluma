// Handlers for `insert_at` and `insert_after`: stage a zero-width content insertion for the user to
// accept or reject inline. Both parse the agent's markdown `text` to real nodes (so multi-paragraph /
// structured content applies correctly on accept) and create a proposal whose span is a single point
// (`from === to`) — a pure insert that Step 1's accept path turns into real nodes.
//
// `insert_at` resolves the point from `position`: 'end' appends after the last block; 'start' prepends
// before existing content. The empty-doc start case is special — an empty TipTap doc is
// `doc(paragraph())`, so inserting *before* its empty paragraph would leave a stray trailing empty
// block. There we replace that empty block's whole range instead, so the result is exactly the drafted
// nodes.
//
// `insert_after` resolves the anchor to a span, then lifts to the END of the anchor's containing block
// (`$pos.after($pos.depth)`) rather than the raw char position, so the new block lands after the block
// instead of splitting it. A missing or repeated anchor (not_found / ambiguous) fails recoverably.

import type { Editor } from '@tiptap/core'
import { createProposal } from '../../editor/extensions/proposals'
import { resolveAnchor } from './resolve-anchor'
import type { AgentToolResult } from './types'

interface InsertAtArgs {
  readonly position: 'start' | 'end'
  readonly text: string
}

interface InsertAfterArgs {
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

function insertAt(editor: Editor, args: InsertAtArgs): AgentToolResult {
  return stageInsertion(editor, { point: insertAtPoint(editor, args.position), text: args.text })
}

function insertAfter(editor: Editor, args: InsertAfterArgs): AgentToolResult {
  const resolved = resolveAnchor(editor, args.anchor)
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const $to = editor.state.doc.resolve(resolved.to)
  const pos = $to.after($to.depth)
  return stageInsertion(editor, { point: { from: pos, to: pos }, text: args.text })
}

export { insertAt, insertAfter }
