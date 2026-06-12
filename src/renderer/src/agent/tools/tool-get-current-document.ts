// Handler for `get_current_document`: serialize the whole document to Markdown and report which file it
// is, so the agent knows the path to pass on to the acting tools. `getMarkdown()` is added to the editor
// by the @tiptap/markdown extension.

import type { Editor } from '@tiptap/core'
import type { AgentToolResult } from './types'

interface GetCurrentDocumentInput {
  readonly editor: Editor
  readonly path: string
}

function getCurrentDocument({ editor, path }: GetCurrentDocumentInput): AgentToolResult {
  return { ok: true, output: { type: 'json', value: { path, markdown: editor.getMarkdown() } } }
}

export { getCurrentDocument }
export type { GetCurrentDocumentInput }
