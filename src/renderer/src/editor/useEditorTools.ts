import type { Editor } from '@tiptap/core'
import { assertWire } from '../../../shared/ipc/from-wire'
import type { ToolEntry } from '../agent/AgentToolsContext'
import type { AgentToolResult } from '../agent/tools/types'
import { useFrontendTool } from '../agent/useFrontendTool'
import {
  createAnnotationTool,
  getCurrentSelectionTool,
  insertAtTool,
  insertTool,
  listOpenFilesTool,
  proposeEditTool
} from '../agent/tools/specs'
import { createAnnotation } from '../agent/tools/tool-create-annotation'
import { getCurrentSelection } from '../agent/tools/tool-get-current-selection'
import { insert, insertAt } from '../agent/tools/tool-insert-text'
import { listOpenFiles } from '../agent/tools/tool-list-open-files'
import { proposeEdit } from '../agent/tools/tool-propose-edit'
import type { AnnotationSeverity } from './extensions/annotations'
import type { EditorEnsurePort, EditorResolverPort } from './editor-resolver.port'

interface EditorToolDeps {
  readonly resolve: EditorResolverPort
  // Opens-on-demand (and awaits load of) the file an acting tool names — the seam that lets a tool act
  // on a closed file.
  readonly ensure: EditorEnsurePort
  readonly activePath: string | null
  // A getter, not a captured array: list_open_files must report the open set fresh at call time, so a
  // file opened mid-turn (a 'loading' background tab) still appears.
  readonly openPaths: () => readonly string[]
}

interface EditorToolEntries {
  readonly list: ToolEntry
  readonly selection: ToolEntry
  readonly annotation: ToolEntry
  readonly proposal: ToolEntry
  readonly insertAt: ToolEntry
  readonly insert: ToolEntry
}

interface ActiveTarget {
  readonly editor: Editor
  readonly path: string
}

const NO_DOCUMENT: AgentToolResult = { ok: false, error: 'No document is open in the editor.' }

// The read tools — discover the open files or read the active selection. The selection reads the active
// editor (the only one with a live cursor) and reports its path, handing the agent the path it must then
// pass to the acting tools.
function readEntries(deps: EditorToolDeps): Pick<EditorToolEntries, 'list' | 'selection'> {
  const activeTarget = (): ActiveTarget | null => {
    const path = deps.activePath
    if (path === null) return null
    const editor = deps.resolve(path)
    return editor === null ? null : { editor, path }
  }

  return {
    list: {
      spec: listOpenFilesTool,
      handler: () => listOpenFiles({ openPaths: deps.openPaths(), activePath: deps.activePath })
    },
    selection: {
      spec: getCurrentSelectionTool,
      handler: () => {
        const target = activeTarget()
        return target ? getCurrentSelection(target) : NO_DOCUMENT
      }
    }
  }
}

type AtPath = (path: string, run: (editor: Editor) => AgentToolResult) => Promise<AgentToolResult>

// Resolve (opening on demand) the file the acting/insert tools name, then run the tool on its editor.
// A ready editor runs the tool; a failed ensure (unreadable path, or the tab closed before it loaded)
// is a recoverable error carrying the ensure message — the same single failure path both tool families
// share, so there is one place a closed/bad file is handled.
function atPathVia(ensure: EditorEnsurePort): AtPath {
  return async (path, run) => {
    const outcome = await ensure(path)
    return outcome.status === 'ready' ? run(outcome.editor) : { ok: false, error: outcome.message }
  }
}

// The acting tools — annotate a passage or propose an edit, each by the passage's exact text. Each
// requires the file `path`; the file is opened on demand if it is not already in the editor.
function actingEntries(deps: EditorToolDeps): Pick<EditorToolEntries, 'annotation' | 'proposal'> {
  const atPath = atPathVia(deps.ensure)

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
        return atPath(args.path, (editor) =>
          createAnnotation({
            editor,
            text: args.text,
            label: args.label,
            description: args.description,
            severity: args.severity
          })
        )
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
        return atPath(args.path, (editor) =>
          proposeEdit({ editor, passage: args.passage, text: args.text })
        )
      }
    }
  }
}

// The insert tools — add markdown at a fixed point (start/end) or before/after a named block. Split by
// tool choice with every field required, so the model never depends on an optional field changing
// meaning.
function insertEntries(deps: EditorToolDeps): Pick<EditorToolEntries, 'insertAt' | 'insert'> {
  const atPath = atPathVia(deps.ensure)

  return {
    insertAt: {
      spec: insertAtTool,
      handler: (args) => {
        assertWire<{
          readonly path: string
          readonly text: string
          readonly position: 'start' | 'end'
        }>(args, insertAtTool.name)
        return atPath(args.path, (editor) =>
          insertAt({ editor, position: args.position, text: args.text })
        )
      }
    },
    insert: {
      spec: insertTool,
      handler: (args) => {
        assertWire<{
          readonly path: string
          readonly text: string
          readonly mode: 'before' | 'after'
          readonly anchor: string
        }>(args, insertTool.name)
        return atPath(args.path, (editor) =>
          insert({ editor, mode: args.mode, anchor: args.anchor, text: args.text })
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
  useFrontendTool(entries.annotation)
  useFrontendTool(entries.proposal)
  useFrontendTool(entries.insertAt)
  useFrontendTool(entries.insert)
}

export { useEditorTools }
