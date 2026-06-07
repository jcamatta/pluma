// Tracks agent review notes anchored to document ranges. Annotation ids (a_1, a_2, …) are minted in
// plugin state. Only the active annotation is decorated in the manuscript; selecting another or
// clearing it moves the decoration. Endpoints are mapped outward-exclusive so edits at the edges
// do not swallow the annotation.

import { Extension, type Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const annotationSeverities = ['info', 'warning', 'error'] as const

type AnnotationSeverity = (typeof annotationSeverities)[number]

type Annotation = {
  readonly id: string
  readonly from: number
  readonly to: number
  readonly label: string
  readonly description: string
  readonly severity: AnnotationSeverity
  readonly quote: string
}

const annotationSeverityClass: Record<AnnotationSeverity, string> = {
  info: 'annotation-info',
  warning: 'annotation-warning',
  error: 'annotation-error'
}

type CreateAnnotationInput = {
  readonly editor: Editor
  readonly annotation: Omit<Annotation, 'id'>
}

type DelAnnotationInput = {
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

type AddAnnotationCommand = { readonly type: 'add'; readonly annotation: Omit<Annotation, 'id'> }
type RemoveAnnotationCommand = { readonly type: 'remove'; readonly id: string }
type ActivateAnnotationCommand = { readonly type: 'activate'; readonly id: string | null }
type AnnotationCommand = AddAnnotationCommand | RemoveAnnotationCommand | ActivateAnnotationCommand

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
  return type === 'add' || type === 'remove' || type === 'activate'
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
      annotations: [...state.annotations, { ...command.annotation, id: `a_${state.nextId}` }]
    }
  }

  if (command.type === 'activate') {
    return { ...state, activeId: command.id }
  }

  return {
    ...state,
    annotations: state.annotations.filter((annotation) => annotation.id !== command.id),
    activeId: state.activeId === command.id ? null : state.activeId
  }
}

function activeDecorations(state: AnnotationsState, doc: ProseMirrorNode): DecorationSet {
  if (!state.activeId) return DecorationSet.empty

  const active = state.annotations.find((annotation) => annotation.id === state.activeId)
  if (!active) return DecorationSet.empty

  return DecorationSet.create(doc, [
    Decoration.inline(active.from, active.to, { class: annotationSeverityClass[active.severity] })
  ])
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
            return activeDecorations(
              annotationsPluginKey.getState(editorState) ?? emptyState,
              editorState.doc
            )
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
  getAnnotations,
  getActiveAnnotationId,
  setActiveAnnotation,
  createAnnotation,
  delAnnotation
}
export type {
  AnnotationSeverity,
  Annotation,
  CreateAnnotationInput,
  DelAnnotationInput,
  SetActiveAnnotationInput
}
