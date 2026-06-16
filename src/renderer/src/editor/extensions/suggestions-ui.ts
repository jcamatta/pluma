// Per-editor UI state for the inline suggestion surface, held in ProseMirror plugin state so the
// decoration builders in proposals.ts / annotations.ts recompute when it changes. It owns a single
// global `visible` flag (default on) and a single cross-type `activeId` (the one active suggestion
// across both proposals and annotations), both toggled via setMeta.

import { Extension, type Editor } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'

type SuggestionsUiState = {
  readonly visible: boolean
  readonly activeId: string | null
}

type SetSuggestionsVisibleInput = {
  readonly editor: Editor
  readonly visible: boolean
}

type SetActiveSuggestionInput = {
  readonly editor: Editor
  readonly id: string | null
}

type SuggestionsUiCommand =
  | { readonly type: 'setVisible'; readonly visible: boolean }
  | { readonly type: 'setActive'; readonly id: string | null }

const suggestionsUiPluginKey = new PluginKey<SuggestionsUiState>('suggestions-ui')

const initialState: SuggestionsUiState = { visible: true, activeId: null }

function readSuggestionsUiState(editorState: EditorState): SuggestionsUiState {
  return suggestionsUiPluginKey.getState(editorState) ?? initialState
}

function getSuggestionsVisible(editor: Editor): boolean {
  return readSuggestionsUiState(editor.state).visible
}

function getActiveSuggestionId(editor: Editor): string | null {
  return readSuggestionsUiState(editor.state).activeId
}

function setSuggestionsVisible({ editor, visible }: SetSuggestionsVisibleInput): void {
  editor.view.dispatch(
    editor.state.tr.setMeta(suggestionsUiPluginKey, {
      type: 'setVisible',
      visible
    } satisfies SuggestionsUiCommand)
  )
}

function setActiveSuggestion({ editor, id }: SetActiveSuggestionInput): void {
  editor.view.dispatch(
    editor.state.tr.setMeta(suggestionsUiPluginKey, {
      type: 'setActive',
      id
    } satisfies SuggestionsUiCommand)
  )
}

function isSetVisibleCommand(value: object): value is { type: 'setVisible'; visible: boolean } {
  return 'visible' in value && typeof value.visible === 'boolean'
}

function isSetActiveCommand(value: object): value is { type: 'setActive'; id: string | null } {
  return 'id' in value && (typeof value.id === 'string' || value.id === null)
}

function isSuggestionsUiCommand(value: unknown): value is SuggestionsUiCommand {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false
  if (value.type === 'setVisible') return isSetVisibleCommand(value)
  return value.type === 'setActive' && isSetActiveCommand(value)
}

function readSuggestionsUiCommand(transaction: Transaction): SuggestionsUiCommand | null {
  const meta: unknown = transaction.getMeta(suggestionsUiPluginKey)
  return isSuggestionsUiCommand(meta) ? meta : null
}

function reduceSuggestionsUi(
  state: SuggestionsUiState,
  command: SuggestionsUiCommand
): SuggestionsUiState {
  return command.type === 'setVisible'
    ? { ...state, visible: command.visible }
    : { ...state, activeId: command.id }
}

const SuggestionsUiExtension = Extension.create({
  name: 'suggestionsUi',

  addProseMirrorPlugins() {
    return [
      new Plugin<SuggestionsUiState>({
        key: suggestionsUiPluginKey,

        state: {
          init() {
            return initialState
          },

          apply(transaction, state) {
            const command = readSuggestionsUiCommand(transaction)
            return command ? reduceSuggestionsUi(state, command) : state
          }
        }
      })
    ]
  }
})

export {
  SuggestionsUiExtension,
  suggestionsUiPluginKey,
  readSuggestionsUiState,
  getSuggestionsVisible,
  getActiveSuggestionId,
  setSuggestionsVisible,
  setActiveSuggestion
}
export type { SuggestionsUiState, SetSuggestionsVisibleInput, SetActiveSuggestionInput }
