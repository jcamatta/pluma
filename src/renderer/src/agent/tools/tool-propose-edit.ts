// Handler for `propose_edit`: stage a replacement over, or an insertion at, a passage given by its exact
// text, for the user to accept or reject inline. The args are a discriminated union on `operation`: a
// replace carries the `passage` it swaps out; an insert carries the optional `after` passage it writes
// behind (omit it to write at the document start — position 1, the first valid insertion point inside the
// opening text-block; 0 is before the doc node and throws). Each passage is resolved to a single span with
// the shared resolver; a missing or repeated passage (not_found / ambiguous) or an overlap with an
// existing proposal fails recoverably, so the agent re-resolves and retries. The edit is not applied here;
// only proposed. `text` is the agent's new text — it becomes the model's `replacementText` either way.

import type { Editor } from '@tiptap/core'
import { createProposal } from '../../editor/extensions/proposals'
import { resolveAnchor } from './resolve-anchor'
import type { AgentToolResult } from './types'

type ProposeEditArgs =
  | { readonly operation: 'replace'; readonly passage: string; readonly text: string }
  | { readonly operation: 'insert'; readonly after?: string; readonly text: string }

const DOCUMENT_START = 1

// The resolver's raw not_found is too terse for the agent: the common cause is anchoring on text from a
// proposal it has not yet had accepted, which is not in the document. Spell that out at this seam only —
// resolve-anchor stays shared with create_annotation and keeps its raw not_found/ambiguous contract.
const NOT_FOUND =
  'not_found: no text matching the passage is in the document. Note that text from a proposal that has not been accepted yet is not part of the document and cannot be used as a passage.'

interface StageInput {
  readonly editor: Editor
  readonly operation: 'replace' | 'insert'
  readonly proposal: {
    readonly from: number
    readonly to: number
    readonly originalText: string
    readonly replacementText: string
  }
}

function stage({ editor, operation, proposal }: StageInput): AgentToolResult {
  const result = createProposal({ editor, proposal })
  if (!result.ok) return { ok: false, error: result.error }
  return {
    ok: true,
    output: {
      type: 'json',
      value: { proposalId: result.proposal.id, status: 'proposed', operation }
    }
  }
}

function resolveError(error: string): string {
  return error === 'not_found' ? NOT_FOUND : error
}

function insertAt({
  editor,
  point,
  text
}: {
  readonly editor: Editor
  readonly point: number
  readonly text: string
}): AgentToolResult {
  return stage({
    editor,
    operation: 'insert',
    proposal: { from: point, to: point, originalText: '', replacementText: text }
  })
}

export function proposeEdit(editor: Editor, args: ProposeEditArgs): AgentToolResult {
  if (args.operation === 'insert') {
    if (args.after === undefined)
      return insertAt({ editor, point: DOCUMENT_START, text: args.text })
    const resolved = resolveAnchor(editor, args.after)
    return resolved.ok
      ? insertAt({ editor, point: resolved.to, text: args.text })
      : { ok: false, error: resolveError(resolved.error) }
  }

  const resolved = resolveAnchor(editor, args.passage)
  return resolved.ok
    ? stage({
        editor,
        operation: 'replace',
        proposal: {
          from: resolved.from,
          to: resolved.to,
          originalText: args.passage,
          replacementText: args.text
        }
      })
    : { ok: false, error: resolveError(resolved.error) }
}
