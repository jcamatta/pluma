// Handler for `propose_edit`: stage a replacement over, or an insertion at, a passage given by its exact
// text, for the user to accept or reject inline. Resolves the anchor to a single span with the shared
// resolver; a missing or repeated passage (not_found / ambiguous) or an overlap with an existing proposal
// fails recoverably, so the agent re-resolves and retries. An insert with no anchor writes at the document
// start (position 1, the first valid insertion point inside the opening text-block; 0 is before the doc
// node and throws); a replace with no anchor fails anchor_required. The edit is not applied here; only
// proposed. `text` is the agent's new text — it becomes the model's `replacementText` either way.

import type { Editor } from '@tiptap/core'
import { createProposal } from '../../editor/extensions/proposals'
import { resolveAnchor } from './resolve-anchor'
import type { AgentToolResult } from './types'

interface ProposeEditArgs {
  readonly operation?: 'replace' | 'insert'
  readonly anchor?: string
  readonly text: string
}

const DOCUMENT_START = 1

function stage(
  editor: Editor,
  proposal: {
    readonly from: number
    readonly to: number
    readonly originalText: string
    readonly replacementText: string
  }
): AgentToolResult {
  const result = createProposal({ editor, proposal })
  if (!result.ok) return { ok: false, error: result.error }
  return {
    ok: true,
    output: { type: 'json', value: { proposalId: result.proposal.id, status: 'proposed' } }
  }
}

export function proposeEdit(editor: Editor, args: ProposeEditArgs): AgentToolResult {
  const insert = args.operation === 'insert'

  if (args.anchor === undefined) {
    if (!insert) return { ok: false, error: 'anchor_required' }
    return stage(editor, {
      from: DOCUMENT_START,
      to: DOCUMENT_START,
      originalText: '',
      replacementText: args.text
    })
  }

  const resolved = resolveAnchor(editor, args.anchor)
  if (!resolved.ok) return { ok: false, error: resolved.error }

  return insert
    ? stage(editor, {
        from: resolved.to,
        to: resolved.to,
        originalText: '',
        replacementText: args.text
      })
    : stage(editor, {
        from: resolved.from,
        to: resolved.to,
        originalText: args.anchor,
        replacementText: args.text
      })
}
