// Handler for `list_open_files`: report every open editor's file so the agent can address one by path.
// A pure calculation over the open paths and the active path — no editor access — so it is trivially
// testable. `name` is the display basename (the same `.md`-stripped label the editor top bar shows);
// `active` marks the file the user is currently in. The agent passes a returned `path` to the acting
// tools; the set can change between turns, so this is re-read, not cached.

import { editorFileName } from '../../editor/editor-file-name-logic'
import type { AgentToolResult } from './types'

interface ListOpenFilesInput {
  readonly openPaths: readonly string[]
  readonly activePath: string | null
}

function listOpenFiles({ openPaths, activePath }: ListOpenFilesInput): AgentToolResult {
  const files = openPaths.map((path) => ({
    path,
    name: editorFileName(path, path),
    active: path === activePath
  }))
  return { ok: true, output: { type: 'json', value: { files } } }
}

export { listOpenFiles }
export type { ListOpenFilesInput }
