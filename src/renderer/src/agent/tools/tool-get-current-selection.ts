// Handler for `get_current_selection`: serialize the selected slice to Markdown and register it as a
// tracked range, so the agent gets back a rangeId it can pass to propose_edit / create_annotation. Also
// reports the file the selection is in, so the agent knows the path to pass to those acting tools.

import type { Editor } from '@tiptap/core'
import { setRange } from '../../editor/extensions/ranges'
import type { AgentToolResult } from './types'

interface GetCurrentSelectionInput {
  readonly editor: Editor
  readonly path: string
}

function getCurrentSelection({ editor, path }: GetCurrentSelectionInput): AgentToolResult {
  const { from, to } = editor.state.selection
  const slice = editor.state.doc.cut(from, to)
  const text = editor.storage.markdown.manager.serialize(slice.toJSON())
  const range = setRange({
    editor,
    range: { from, to, originalText: editor.state.doc.textBetween(from, to, '\n') }
  })

  return { ok: true, output: { type: 'json', value: { path, rangeId: range.id, text } } }
}

export { getCurrentSelection }
export type { GetCurrentSelectionInput }
