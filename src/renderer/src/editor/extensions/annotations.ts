// Tracks agent review notes anchored to document ranges. Annotation ids (a_1, a_2, …) are minted in
// plugin state. Only the active annotation is decorated in the manuscript; selecting another or
// clearing it moves the decoration. Endpoints are mapped outward-exclusive so edits at the edges
// do not swallow the annotation.

import { Extension, type Editor } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { readSuggestionsUiState } from './suggestions-ui'

const annotationSeverities = ['info', 'warning', 'error'] as const

type AnnotationSeverity = (typeof annotationSeverities)[number]

type AnnotationStatus = 'pending' | 'read'

type Annotation = {
  readonly id: string
  readonly from: number
  readonly to: number
  readonly label: string
  readonly description: string
  readonly severity: AnnotationSeverity
  readonly quote: string
  readonly status: AnnotationStatus
}

const annotationSeverityClass: Record<AnnotationSeverity, string> = {
  info: 'annotation-info',
  warning: 'annotation-warning',
  error: 'annotation-error'
}

const annotationReadClass = 'annotation-read'

type CreateAnnotationInput = {
  readonly editor: Editor
  readonly annotation: Omit<Annotation, 'id' | 'status'>
}

type DelAnnotationInput = {
  readonly editor: Editor
  readonly id: string
}

type MarkAnnotationReadInput = {
  readonly editor: Editor
  readonly id: string
}

type SetActiveAnnotationInput = {
  readonly editor: Editor
  readonly id: string | null
}

type AnnotationsState = {
  readonly annotations: readonly Annotation[]
  readonly activeId: string | null
  readonly nextId: number
}

type AddAnnotationCommand = {
  readonly type: 'add'
  readonly annotation: Omit<Annotation, 'id' | 'status'>
}
type RemoveAnnotationCommand = { readonly type: 'remove'; readonly id: string }
type ActivateAnnotationCommand = { readonly type: 'activate'; readonly id: string | null }
type ReadAnnotationCommand = { readonly type: 'read'; readonly id: string }
type AnnotationCommand =
  | AddAnnotationCommand
  | RemoveAnnotationCommand
  | ActivateAnnotationCommand
  | ReadAnnotationCommand

const annotationsPluginKey = new PluginKey<AnnotationsState>('annotations')

const emptyState: AnnotationsState = { annotations: [], activeId: null, nextId: 1 }

function getState(editor: Editor): AnnotationsState {
  return annotationsPluginKey.getState(editor.state) ?? emptyState
}

function getAnnotations(editor: Editor): readonly Annotation[] {
  return getState(editor).annotations
}

function getActiveAnnotationId(editor: Editor): string | null {
  return getState(editor).activeId
}

function setActiveAnnotation({ editor, id }: SetActiveAnnotationInput): void {
  editor.view.dispatch(
    editor.state.tr.setMeta(annotationsPluginKey, {
      id,
      type: 'activate'
    } satisfies AnnotationCommand)
  )
}

function createAnnotation({ editor, annotation }: CreateAnnotationInput): Annotation {
  const idBefore = getState(editor).nextId

  editor.view.dispatch(
    editor.state.tr.setMeta(annotationsPluginKey, {
      annotation,
      type: 'add'
    } satisfies AnnotationCommand)
  )

  const created = getState(editor).annotations.find((candidate) => candidate.id === `a_${idBefore}`)
  return created ?? { ...annotation, id: `a_${idBefore}` }
}

function delAnnotation({ editor, id }: DelAnnotationInput): void {
  editor.view.dispatch(
    editor.state.tr.setMeta(annotationsPluginKey, {
      id,
      type: 'remove'
    } satisfies AnnotationCommand)
  )
}

function markAnnotationRead({ editor, id }: MarkAnnotationReadInput): void {
  editor.view.dispatch(
    editor.state.tr.setMeta(annotationsPluginKey, {
      id,
      type: 'read'
    } satisfies AnnotationCommand)
  )
}

function mapAnnotation(annotation: Annotation, transaction: Transaction): Annotation {
  return {
    ...annotation,
    from: transaction.mapping.map(annotation.from, 1),
    to: transaction.mapping.map(annotation.to, -1)
  }
}

function isAnnotationCommand(value: unknown): value is AnnotationCommand {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false
  const { type } = value
  return type === 'add' || type === 'remove' || type === 'activate' || type === 'read'
}

function readAnnotationCommand(transaction: Transaction): AnnotationCommand | null {
  const meta: unknown = transaction.getMeta(annotationsPluginKey)
  return isAnnotationCommand(meta) ? meta : null
}

function reduceAnnotation(state: AnnotationsState, command: AnnotationCommand): AnnotationsState {
  if (command.type === 'add') {
    return {
      ...state,
      nextId: state.nextId + 1,
      annotations: [
        ...state.annotations,
        { ...command.annotation, id: `a_${state.nextId}`, status: 'pending' }
      ]
    }
  }

  if (command.type === 'activate') {
    return { ...state, activeId: command.id }
  }

  if (command.type === 'read') {
    return {
      ...state,
      annotations: state.annotations.map((annotation) =>
        annotation.id === command.id ? { ...annotation, status: 'read' } : annotation
      )
    }
  }

  return {
    ...state,
    annotations: state.annotations.filter((annotation) => annotation.id !== command.id),
    activeId: state.activeId === command.id ? null : state.activeId
  }
}

// One inline highlight per annotation across its range, carrying its severity class plus the read
// recipe once it has been marked read.
function annotationDecoration(annotation: Annotation): Decoration {
  const severity = annotationSeverityClass[annotation.severity]
  const className = annotation.status === 'read' ? `${severity} ${annotationReadClass}` : severity
  return Decoration.inline(annotation.from, annotation.to, { class: className })
}

// When suggestions are visible, every annotation is highlighted at once; hiding them clears the set.
function visibleDecorations(editorState: EditorState): DecorationSet {
  if (!readSuggestionsUiState(editorState).visible) return DecorationSet.empty

  const state = annotationsPluginKey.getState(editorState) ?? emptyState
  return DecorationSet.create(editorState.doc, state.annotations.map(annotationDecoration))
}

const AnnotationsExtension = Extension.create({
  name: 'annotations',

  addProseMirrorPlugins() {
    return [
      new Plugin<AnnotationsState>({
        key: annotationsPluginKey,

        state: {
          init() {
            return emptyState
          },

          apply(transaction, state) {
            const mapped: AnnotationsState = {
              ...state,
              annotations: state.annotations.map((annotation) =>
                mapAnnotation(annotation, transaction)
              )
            }
            const command = readAnnotationCommand(transaction)
            return command ? reduceAnnotation(mapped, command) : mapped
          }
        },

        props: {
          decorations(editorState) {
            return visibleDecorations(editorState)
          }
        }
      })
    ]
  }
})

export {
  AnnotationsExtension,
  annotationsPluginKey,
  annotationSeverities,
  annotationSeverityClass,
  annotationReadClass,
  getAnnotations,
  getActiveAnnotationId,
  setActiveAnnotation,
  createAnnotation,
  delAnnotation,
  markAnnotationRead
}
export type {
  AnnotationSeverity,
  AnnotationStatus,
  Annotation,
  CreateAnnotationInput,
  DelAnnotationInput,
  MarkAnnotationReadInput,
  SetActiveAnnotationInput
}
