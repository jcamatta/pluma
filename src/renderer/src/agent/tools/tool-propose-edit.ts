// Handler for `propose_edit`: stage a replacement over, or an insertion at, a passage given by its exact
// text, for the user to accept or reject inline. Resolves the anchor to a single span with the shared
// resolver; a missing or repeated passage (not_found / ambiguous) or an overlap with an existing proposal
// fails recoverably, so the agent re-resolves and retries. An insert with no anchor writes at the document
// start (position 1, the first valid insertion point inside the opening text-block; 0 is before the doc
// node and throws); a non-insert with no anchor fails anchor_required. The edit is not applied here; only
// proposed. `text` is the agent's new text — it becomes the model's `replacementText` either way. Errors
// are full sentences so the agent (and the rail log) can see what happened and recover.

import type { Editor } from '@tiptap/core'
import { createProposal } from '../../editor/extensions/proposals'
import { resolveAnchor } from './resolve-anchor'
import type { AgentToolResult } from './types'

interface ProposeEditArgs {
  readonly operation: 'replace' | 'insert'
  readonly anchor?: string
  readonly text: string
}

const DOCUMENT_START = 1

const ANCHOR_REQUIRED =
  'anchor_required: a replace needs the exact passage to replace in `anchor`. To add new text without replacing, set operation to "insert".'

// The resolver's raw not_found is too terse for the agent: the common cause is anchoring on text from a
// proposal it has not yet had accepted, which is not in the document. Spell that out at this seam only —
// resolve-anchor stays shared with create_annotation and keeps its raw not_found/ambiguous contract.
const NOT_FOUND =
  'not_found: no text matching `anchor` is in the document. Note that text from a proposal that has not been accepted yet is not part of the document and cannot be used as an anchor.'

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

export function proposeEdit(editor: Editor, args: ProposeEditArgs): AgentToolResult {
  const insert = args.operation === 'insert'

  if (args.anchor === undefined) {
    if (!insert) return { ok: false, error: ANCHOR_REQUIRED }
    return stage({
      editor,
      operation: args.operation,
      proposal: {
        from: DOCUMENT_START,
        to: DOCUMENT_START,
        originalText: '',
        replacementText: args.text
      }
    })
  }

  const resolved = resolveAnchor(editor, args.anchor)
  if (!resolved.ok) {
    return { ok: false, error: resolved.error === 'not_found' ? NOT_FOUND : resolved.error }
  }

  return insert
    ? stage({
        editor,
        operation: args.operation,
        proposal: {
          from: resolved.to,
          to: resolved.to,
          originalText: '',
          replacementText: args.text
        }
      })
    : stage({
        editor,
        operation: args.operation,
        proposal: {
          from: resolved.from,
          to: resolved.to,
          originalText: args.anchor,
          replacementText: args.text
        }
      })
}
