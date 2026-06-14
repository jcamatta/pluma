// Handler for `get_current_selection`: report the file the user is in and the exact text they have
// selected. A pure read — it does not touch editor state. The text is the bare selected text (not
// uniquified), so the agent can pass it straight to propose_edit or create_annotation, which resolve it
// against the document. Empty when there is no selection.

import type { Editor } from '@tiptap/core'
import type { AgentToolResult } from './types'

interface GetCurrentSelectionInput {
  readonly editor: Editor
  readonly path: string
}

function getCurrentSelection({ editor, path }: GetCurrentSelectionInput): AgentToolResult {
  const { from, to } = editor.state.selection
  const text = editor.state.doc.textBetween(from, to, '\n')

  return { ok: true, output: { type: 'json', value: { path, text } } }
}

export { getCurrentSelection }
export type { GetCurrentSelectionInput }
