import type { Editor } from '@tiptap/core'
import { assertWire } from '../../../shared/ipc/from-wire'
import type { ToolEntry, ToolHandler } from '../agent/AgentToolsContext'
import type { AgentToolResult } from '../agent/tools/types'
import { useFrontendTool } from '../agent/useFrontendTool'
import {
  createAnnotationTool,
  getCurrentDocumentTool,
  getCurrentSelectionTool,
  getRangesTool,
  proposeEditTool
} from '../agent/tools/specs'
import { createAnnotationTool as runCreateAnnotation } from '../agent/tools/tool-create-annotation'
import { getCurrentDocument } from '../agent/tools/tool-get-current-document'
import { getCurrentSelection } from '../agent/tools/tool-get-current-selection'
import { getRanges } from '../agent/tools/tool-get-ranges'
import { proposeEdit } from '../agent/tools/tool-propose-edit'
import type { AnnotationSeverity } from './extensions/annotations'
import type { EditorResolverPort } from './editor-resolver.port'

interface EditorToolDeps {
  readonly resolve: EditorResolverPort
  readonly activePath: string | null
}

interface EditorToolEntries {
  readonly selection: ToolEntry
  readonly document: ToolEntry
  readonly ranges: ToolEntry
  readonly annotation: ToolEntry
  readonly proposal: ToolEntry
}

type EditorRun = (editor: Editor, args: unknown) => AgentToolResult

function editorToolEntries(deps: EditorToolDeps): EditorToolEntries {
  const activeEditor = (): Editor | null =>
    deps.activePath === null ? null : deps.resolve(deps.activePath)

  const withLiveEditor =
    (run: EditorRun): ToolHandler =>
    (args) => {
      const editor = activeEditor()
      return editor ? run(editor, args) : { ok: false, error: 'No document is open in the editor.' }
    }

  return {
    selection: {
      spec: getCurrentSelectionTool,
      handler: withLiveEditor((live) => getCurrentSelection(live))
    },
    document: {
      spec: getCurrentDocumentTool,
      handler: withLiveEditor((live) => getCurrentDocument(live))
    },
    ranges: {
      spec: getRangesTool,
      handler: withLiveEditor((live, args) => {
        assertWire<{ readonly text: string }>(args, getRangesTool.name)
        return getRanges(live, args)
      })
    },
    annotation: {
      spec: createAnnotationTool,
      handler: withLiveEditor((live, args) => {
        assertWire<{
          readonly rangeId: string
          readonly label: string
          readonly description: string
          readonly severity?: AnnotationSeverity
        }>(args, createAnnotationTool.name)
        return runCreateAnnotation(live, args)
      })
    },
    proposal: {
      spec: proposeEditTool,
      handler: withLiveEditor((live, args) => {
        assertWire<{ readonly rangeId: string; readonly replacementText: string }>(
          args,
          proposeEditTool.name
        )
        return proposeEdit(live, args)
      })
    }
  }
}

function useEditorTools(deps: EditorToolDeps): void {
  const entries = editorToolEntries(deps)
  useFrontendTool(entries.selection)
  useFrontendTool(entries.document)
  useFrontendTool(entries.ranges)
  useFrontendTool(entries.annotation)
  useFrontendTool(entries.proposal)
}

export { useEditorTools }
