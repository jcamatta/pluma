// The single capability the editor frontend tools need to address a file: resolve an open file's path
// to its mounted editor, or null when no editor is open at that path. The ActiveEditorContext registry
// is the production adapter (editors.get(path) ?? null); tests pass a Map-backed fake. Deliberately
// narrower than the registry — a tool may resolve a path, nothing more.

import type { Editor } from '@tiptap/core'

type EditorResolverPort = (path: string) => Editor | null

export type { EditorResolverPort }
