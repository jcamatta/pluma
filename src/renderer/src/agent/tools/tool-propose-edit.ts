// Handler for `propose_edit`: stage a replacement over a passage given by its exact text, for the user
// to accept or reject inline. Resolves the text to a single span with the shared resolver; a missing or
// repeated passage (not_found / ambiguous) or an overlap with an existing proposal fails recoverably, so
// the agent re-resolves and retries. The edit is not applied here; only proposed.

import type { Editor } from '@tiptap/core'
import { createProposal } from '../../editor/extensions/proposals'
import { resolveAnchor } from './resolve-anchor'
import type { AgentToolResult } from './types'

interface ProposeEditArgs {
  readonly text: string
  readonly replacementText: string
}

export function proposeEdit(editor: Editor, args: ProposeEditArgs): AgentToolResult {
  const resolved = resolveAnchor(editor, args.text)
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const result = createProposal({
    editor,
    proposal: {
      from: resolved.from,
      to: resolved.to,
      originalText: args.text,
      replacementText: args.replacementText
    }
  })

  if (!result.ok) return { ok: false, error: result.error }

  return {
    ok: true,
    output: { type: 'json', value: { proposalId: result.proposal.id, status: 'proposed' } }
  }
}
