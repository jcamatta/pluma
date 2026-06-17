// Handler for `propose_edit`: stage a replacement over a passage given by its exact text, for the user
// to accept or reject inline. Resolves the text to a single span with the shared resolver; a missing or
// repeated passage (not_found / ambiguous) or an overlap with an existing proposal fails recoverably, so
// the agent re-resolves and retries. The edit is not applied here; only proposed.

import type { Editor } from '@tiptap/core'
import { createProposal } from '../../editor/extensions/proposals'
import { resolveAnchor } from './resolve-anchor'
import type { AgentToolResult } from './types'

interface ProposeEditInput {
  readonly editor: Editor
  readonly passage: string
  readonly text: string
}

function proposeEdit({ editor, passage, text }: ProposeEditInput): AgentToolResult {
  const markdown = editor.markdown
  if (!markdown) return { ok: false, error: 'markdown_unavailable' }

  const resolved = resolveAnchor(editor, passage)
  if (!resolved.ok) return { ok: false, error: resolved.error }

  // Parse the new text as markdown to real nodes so multi-paragraph / structured content applies
  // correctly on accept; the raw source is kept as replacementText for the interim rail card.
  const content = markdown.parse(text)

  const result = createProposal({
    editor,
    proposal: {
      from: resolved.from,
      to: resolved.to,
      originalText: passage,
      replacementText: text,
      content
    }
  })

  if (!result.ok) return { ok: false, error: result.error }

  return {
    ok: true,
    output: { type: 'json', value: { proposalId: result.proposal.id, status: 'proposed' } }
  }
}

export { proposeEdit }
export type { ProposeEditInput }
