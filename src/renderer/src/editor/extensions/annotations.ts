// Tracks agent review notes anchored to document ranges. Annotation ids (a_1, a_2, …) are minted in
// plugin state. Only the active annotation is decorated in the manuscript; selecting another or
// clearing it moves the decoration. Endpoints are mapped outward-exclusive so edits at the edges
// do not swallow the annotation.

import { Extension, type Editor } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import {
  getActiveSuggestionId,
  readSuggestionsUiState,
  setActiveSuggestion
} from './suggestions-ui'

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

// Marks the single cross-type active annotation; the ring it styles is wired in a later step, this
// step only emits the class.
const annotationActiveClass = 'annotation-active'

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
  readonly nextId: number
}

type AddAnnotationCommand = {
  readonly type: 'add'
  readonly annotation: Omit<Annotation, 'id' | 'status'>
}
type RemoveAnnotationCommand = { readonly type: 'remove'; readonly id: string }
type ReadAnnotationCommand = { readonly type: 'read'; readonly id: string }
type AnnotationCommand = AddAnnotationCommand | RemoveAnnotationCommand | ReadAnnotationCommand

const annotationsPluginKey = new PluginKey<AnnotationsState>('annotations')

const emptyState: AnnotationsState = { annotations: [], nextId: 1 }

function getState(editor: Editor): AnnotationsState {
  return annotationsPluginKey.getState(editor.state) ?? emptyState
}

function getAnnotations(editor: Editor): readonly Annotation[] {
  return getState(editor).annotations
}

// The active suggestion id is shared across proposals and annotations (held in suggestions-ui), so an
// annotation is "active" only when that single id names one of this editor's annotations; otherwise a
// proposal (or nothing) is active and this reader yields null.
function getActiveAnnotationId(editor: Editor): string | null {
  const activeId = getActiveSuggestionId(editor)
  return activeId !== null &&
    getAnnotations(editor).some((annotation) => annotation.id === activeId)
    ? activeId
    : null
}

function setActiveAnnotation({ editor, id }: SetActiveAnnotationInput): void {
  setActiveSuggestion({ editor, id })
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
  return created ?? { ...annotation, id: `a_${idBefore}`, status: 'pending' }
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
  return type === 'add' || type === 'remove' || type === 'read'
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
    annotations: state.annotations.filter((annotation) => annotation.id !== command.id)
  }
}

// One inline highlight per annotation across its range, carrying its severity class, the read recipe
// once it has been marked read, and the active marker when it is the cross-type active suggestion.
function annotationDecoration(annotation: Annotation, active: boolean): Decoration {
  const classes = [annotationSeverityClass[annotation.severity]]
  if (annotation.status === 'read') classes.push(annotationReadClass)
  if (active) classes.push(annotationActiveClass)
  return Decoration.inline(annotation.from, annotation.to, { class: classes.join(' ') })
}

// When suggestions are visible, every annotation is highlighted at once; hiding them clears the set.
function visibleDecorations(editorState: EditorState): DecorationSet {
  const ui = readSuggestionsUiState(editorState)
  if (!ui.visible) return DecorationSet.empty

  const state = annotationsPluginKey.getState(editorState) ?? emptyState
  return DecorationSet.create(
    editorState.doc,
    state.annotations.map((annotation) =>
      annotationDecoration(annotation, annotation.id === ui.activeId)
    )
  )
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
  annotationActiveClass,
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
