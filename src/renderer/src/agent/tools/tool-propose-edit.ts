// Handler for `propose_edit`: stage a replacement over a tracked range for the user to accept or
// reject inline. Fails (recoverably) when the range is gone, drifted, or overlaps an existing
// proposal — the agent re-resolves and retries. The edit is not applied here; only proposed.

import type { Editor } from '@tiptap/core'
import { getRange } from '../../editor/extensions/ranges'
import { createProposal } from '../../editor/extensions/proposals'
import type { AgentToolResult } from './types'

interface ProposeEditArgs {
  readonly rangeId: string
  readonly replacementText: string
}

export function proposeEdit(editor: Editor, args: ProposeEditArgs): AgentToolResult {
  const range = getRange({ editor, id: args.rangeId })

  if (!range) {
    return { ok: false, error: `Range ${args.rangeId} not found. Call get_ranges again.` }
  }

  if (range.status === 'error') {
    return { ok: false, error: `${range.error} Current text: ${range.currentText}` }
  }

  const result = createProposal({
    editor,
    proposal: {
      from: range.from,
      to: range.to,
      originalText: range.originalText,
      replacementText: args.replacementText
    }
  })

  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  return {
    ok: true,
    output: { type: 'json', value: { proposalId: result.proposal.id, status: 'proposed' } }
  }
}
