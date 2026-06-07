// Handler for `get_current_selection`: serialize the selected slice to Markdown and register it as a
// tracked range, so the agent gets back a rangeId it can pass to propose_edit / create_annotation.

import type { Editor } from '@tiptap/core'
import { setRange } from '../../editor/extensions/ranges'
import type { AgentToolResult } from './types'

export function getCurrentSelection(editor: Editor): AgentToolResult {
  const { from, to } = editor.state.selection
  const slice = editor.state.doc.cut(from, to)
  const text = editor.storage.markdown.manager.serialize(slice.toJSON())
  const range = setRange({
    editor,
    range: { from, to, originalText: editor.state.doc.textBetween(from, to, '\n') }
  })

  return { ok: true, output: { type: 'json', value: { rangeId: range.id, text } } }
}
