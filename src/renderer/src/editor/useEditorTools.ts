import type { Editor } from '@tiptap/core'
import { assertWire } from '../../../shared/ipc/from-wire'
import type { ToolEntry } from '../agent/AgentToolsContext'
import type { AgentToolResult } from '../agent/tools/types'
import { useFrontendTool } from '../agent/useFrontendTool'
import {
  createAnnotationTool,
  getCurrentDocumentTool,
  getCurrentSelectionTool,
  getRangesTool,
  listOpenFilesTool,
  proposeEditTool
} from '../agent/tools/specs'
import { createAnnotationTool as runCreateAnnotation } from '../agent/tools/tool-create-annotation'
import { getCurrentDocument } from '../agent/tools/tool-get-current-document'
import { getCurrentSelection } from '../agent/tools/tool-get-current-selection'
import { getRanges } from '../agent/tools/tool-get-ranges'
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
  readonly document: ToolEntry
  readonly ranges: ToolEntry
  readonly annotation: ToolEntry
  readonly proposal: ToolEntry
}

interface ActiveTarget {
  readonly editor: Editor
  readonly path: string
}

const NO_DOCUMENT: AgentToolResult = { ok: false, error: 'No document is open in the editor.' }

const noOpenEditor = (path: string): AgentToolResult => ({ ok: false, error: `no_open_editor:${path}` })

// The read tools — discover the open files and read the active document/selection. Reads default to the
// active file (get_current_document also accepts an explicit path) and report the path they read, which
// is how the agent learns the path it must then pass to the acting tools.
function readEntries(deps: EditorToolDeps): Pick<EditorToolEntries, 'list' | 'selection' | 'document'> {
  const activeTarget = (): ActiveTarget | null => {
    const path = deps.activePath
    if (path === null) return null
    const editor = deps.resolve(path)
    return editor === null ? null : { editor, path }
  }

  const readDocument = (args: unknown): AgentToolResult => {
    assertWire<{ readonly path?: string }>(args, getCurrentDocumentTool.name)
    const path = args.path ?? deps.activePath
    if (path === null) return NO_DOCUMENT
    const editor = deps.resolve(path)
    if (editor === null) return args.path === undefined ? NO_DOCUMENT : noOpenEditor(path)
    return getCurrentDocument({ editor, path })
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
    document: { spec: getCurrentDocumentTool, handler: readDocument }
  }
}

// The acting tools — resolve a tracked range, annotate it, or propose an edit. Each requires the file
// `path`, resolved to its open editor; a path that is not open is a recoverable error.
function actingEntries(
  deps: EditorToolDeps
): Pick<EditorToolEntries, 'ranges' | 'annotation' | 'proposal'> {
  const atPath = (path: string, run: (editor: Editor) => AgentToolResult): AgentToolResult => {
    const editor = deps.resolve(path)
    return editor ? run(editor) : noOpenEditor(path)
  }

  return {
    ranges: {
      spec: getRangesTool,
      handler: (args) => {
        assertWire<{ readonly path: string; readonly text: string }>(args, getRangesTool.name)
        return atPath(args.path, (live) => getRanges(live, args))
      }
    },
    annotation: {
      spec: createAnnotationTool,
      handler: (args) => {
        assertWire<{
          readonly path: string
          readonly rangeId: string
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
        assertWire<{ readonly path: string; readonly rangeId: string; readonly replacementText: string }>(
          args,
          proposeEditTool.name
        )
        return atPath(args.path, (live) => proposeEdit(live, args))
      }
    }
  }
}

function editorToolEntries(deps: EditorToolDeps): EditorToolEntries {
  return { ...readEntries(deps), ...actingEntries(deps) }
}

function useEditorTools(deps: EditorToolDeps): void {
  const entries = editorToolEntries(deps)
  useFrontendTool(entries.list)
  useFrontendTool(entries.selection)
  useFrontendTool(entries.document)
  useFrontendTool(entries.ranges)
  useFrontendTool(entries.annotation)
  useFrontendTool(entries.proposal)
}

export { useEditorTools }
