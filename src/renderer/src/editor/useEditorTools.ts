import type { Editor } from '@tiptap/core'
import { assertWire } from '../../../shared/ipc/from-wire'
import type { ToolEntry } from '../agent/AgentToolsContext'
import type { AgentToolResult } from '../agent/tools/types'
import { useFrontendTool } from '../agent/useFrontendTool'
import {
  createAnnotationTool,
  getContentTool,
  getCurrentSelectionTool,
  insertAfterTool,
  insertAtTool,
  listOpenFilesTool,
  proposeEditTool
} from '../agent/tools/specs'
import { createAnnotationTool as runCreateAnnotation } from '../agent/tools/tool-create-annotation'
import { getContent } from '../agent/tools/tool-get-content'
import { getCurrentSelection } from '../agent/tools/tool-get-current-selection'
import { insertAfter, insertAt } from '../agent/tools/tool-insert-text'
import { listOpenFiles } from '../agent/tools/tool-list-open-files'
import { proposeEdit } from '../agent/tools/tool-propose-edit'
import type { AnnotationSeverity } from './extensions/annotations'
import type { EditorResolverPort } from './editor-resolver.port'

interface EditorToolDeps {
  readonly resolve: EditorResolverPort
  readonly activePath: string | null
  readonly openPaths: readonly string[]
}

interface EditorToolEntries {
  readonly list: ToolEntry
  readonly selection: ToolEntry
  readonly content: ToolEntry
  readonly annotation: ToolEntry
  readonly proposal: ToolEntry
  readonly insertAt: ToolEntry
  readonly insertAfter: ToolEntry
}

interface ActiveTarget {
  readonly editor: Editor
  readonly path: string
}

const NO_DOCUMENT: AgentToolResult = { ok: false, error: 'No document is open in the editor.' }

const noOpenEditor = (path: string): AgentToolResult => ({
  ok: false,
  error: `no_open_editor:${path}`
})

// The read tools — discover the open files, read a named file, or read the active selection. get_content
// takes the path the agent learned from list_open_files and reports it back; the selection reads the
// active editor (the only one with a live cursor) and reports its path. Both hand the agent the path it
// must then pass to the acting tools.
function readEntries(
  deps: EditorToolDeps
): Pick<EditorToolEntries, 'list' | 'selection' | 'content'> {
  const activeTarget = (): ActiveTarget | null => {
    const path = deps.activePath
    if (path === null) return null
    const editor = deps.resolve(path)
    return editor === null ? null : { editor, path }
  }

  const readContent = (args: unknown): AgentToolResult => {
    assertWire<{ readonly path: string }>(args, getContentTool.name)
    const editor = deps.resolve(args.path)
    return editor ? getContent({ editor, path: args.path }) : noOpenEditor(args.path)
  }

  return {
    list: {
      spec: listOpenFilesTool,
      handler: () => listOpenFiles({ openPaths: deps.openPaths, activePath: deps.activePath })
    },
    selection: {
      spec: getCurrentSelectionTool,
      handler: () => {
        const target = activeTarget()
        return target ? getCurrentSelection(target) : NO_DOCUMENT
      }
    },
    content: { spec: getContentTool, handler: readContent }
  }
}

type AtPath = (path: string, run: (editor: Editor) => AgentToolResult) => AgentToolResult

// The acting tools — annotate a passage or propose an edit, each by the passage's exact text. Each
// requires the file `path`, resolved to its open editor; a path that is not open is a recoverable error.
function actingEntries(deps: EditorToolDeps): Pick<EditorToolEntries, 'annotation' | 'proposal'> {
  const atPath: AtPath = (path, run) => {
    const editor = deps.resolve(path)
    return editor ? run(editor) : noOpenEditor(path)
  }

  return {
    annotation: {
      spec: createAnnotationTool,
      handler: (args) => {
        assertWire<{
          readonly path: string
          readonly text: string
          readonly label: string
          readonly description: string
          readonly severity?: AnnotationSeverity
        }>(args, createAnnotationTool.name)
        return atPath(args.path, (live) => runCreateAnnotation(live, args))
      }
    },
    proposal: {
      spec: proposeEditTool,
      handler: (args) => {
        assertWire<{
          readonly path: string
          readonly passage: string
          readonly text: string
        }>(args, proposeEditTool.name)
        return atPath(args.path, (live) =>
          proposeEdit(live, { passage: args.passage, text: args.text })
        )
      }
    }
  }
}

// The insert tools — add markdown at a fixed point (start/end) or after a named block. Split by tool
// choice with every field required, so the model never depends on an optional field changing meaning.
function insertEntries(deps: EditorToolDeps): Pick<EditorToolEntries, 'insertAt' | 'insertAfter'> {
  const atPath: AtPath = (path, run) => {
    const editor = deps.resolve(path)
    return editor ? run(editor) : noOpenEditor(path)
  }

  return {
    insertAt: {
      spec: insertAtTool,
      handler: (args) => {
        assertWire<{
          readonly path: string
          readonly text: string
          readonly position: 'start' | 'end'
        }>(args, insertAtTool.name)
        return atPath(args.path, (live) =>
          insertAt(live, { position: args.position, text: args.text })
        )
      }
    },
    insertAfter: {
      spec: insertAfterTool,
      handler: (args) => {
        assertWire<{
          readonly path: string
          readonly text: string
          readonly anchor: string
        }>(args, insertAfterTool.name)
        return atPath(args.path, (live) =>
          insertAfter(live, { anchor: args.anchor, text: args.text })
        )
      }
    }
  }
}

function editorToolEntries(deps: EditorToolDeps): EditorToolEntries {
  return { ...readEntries(deps), ...actingEntries(deps), ...insertEntries(deps) }
}

function useEditorTools(deps: EditorToolDeps): void {
  const entries = editorToolEntries(deps)
  useFrontendTool(entries.list)
  useFrontendTool(entries.selection)
  useFrontendTool(entries.content)
  useFrontendTool(entries.annotation)
  useFrontendTool(entries.proposal)
  useFrontendTool(entries.insertAt)
  useFrontendTool(entries.insertAfter)
}

export { useEditorTools }
