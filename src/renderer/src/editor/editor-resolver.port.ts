// The two capabilities the editor frontend tools need to address a file. `EditorResolverPort` is the
// SYNC map lookup used for the active selection: resolve an open file's path to its mounted editor, or
// null when no editor is open there. `EditorEnsurePort` is the ASYNC open-on-demand used by the acting
// tools: it makes the file at `path` available — already-open files resolve immediately, a closed but
// readable file is opened in the background and awaited until its editor has loaded — and yields either
// the ready editor or a failure message (nothing parses the failure; the agent is only told to retry).
// The ActiveEditorContext store is the production source for both; tests pass fakes.

import type { Editor } from '@tiptap/core'

type EditorResolverPort = (path: string) => Editor | null

type EnsureOutcome =
  | { readonly status: 'ready'; readonly editor: Editor }
  | { readonly status: 'failed'; readonly message: string }

type EditorEnsurePort = (path: string) => Promise<EnsureOutcome>

export type { EditorResolverPort, EditorEnsurePort, EnsureOutcome }
