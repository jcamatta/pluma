// Handler for `get_content`: serialize an open file's whole document to Markdown and report which file it
// is, so the agent can carry the path on to the acting tools. `getMarkdown()` is added to the editor by
// the @tiptap/markdown extension.

import type { Editor } from '@tiptap/core'
import type { AgentToolResult } from './types'

interface GetContentInput {
  readonly editor: Editor
  readonly path: string
}

function getContent({ editor, path }: GetContentInput): AgentToolResult {
  return { ok: true, output: { type: 'json', value: { path, markdown: editor.getMarkdown() } } }
}

export { getContent }
export type { GetContentInput }
