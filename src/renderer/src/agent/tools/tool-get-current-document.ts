// Handler for `get_current_document`: serialize the whole document to Markdown. `getMarkdown()` is
// added to the editor by the @tiptap/markdown extension.

import type { Editor } from '@tiptap/core'
import type { AgentToolResult } from './types'

export function getCurrentDocument(editor: Editor): AgentToolResult {
  return { ok: true, output: { type: 'text', text: editor.getMarkdown() } }
}
