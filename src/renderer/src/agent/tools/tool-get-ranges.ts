// Handler for `get_ranges`: resolve exact document text to a tracked range id. Delegates the
// text->span resolution to the shared resolveAnchor, then registers a range over the resolved span so
// the agent gets back a stable id. Zero matches -> not_found; many -> ambiguous (with previews).

import type { Editor } from '@tiptap/core'
import { setRange } from '../../editor/extensions/ranges'
import { resolveAnchor } from './resolve-anchor'
import type { AgentToolResult } from './types'

export function getRanges(editor: Editor, args: { readonly text: string }): AgentToolResult {
  const resolved = resolveAnchor(editor, args.text)
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const range = setRange({
    editor,
    range: { from: resolved.from, to: resolved.to, originalText: args.text }
  })

  return { ok: true, output: { type: 'json', value: { rangeId: range.id, text: args.text } } }
}
