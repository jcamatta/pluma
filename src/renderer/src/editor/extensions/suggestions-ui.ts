// Per-editor UI state for the inline suggestion surface, held in ProseMirror plugin state so the
// decoration builders in proposals.ts / annotations.ts recompute when it changes. For now it owns a
// single global `visible` flag (default on) toggled via setMeta; the cross-type active id arrives in
// a later step.

import { Extension, type Editor } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'

type SuggestionsUiState = {
  readonly visible: boolean
}

type SetSuggestionsVisibleInput = {
  readonly editor: Editor
  readonly visible: boolean
}

type SuggestionsUiCommand = { readonly type: 'setVisible'; readonly visible: boolean }

const suggestionsUiPluginKey = new PluginKey<SuggestionsUiState>('suggestions-ui')

const initialState: SuggestionsUiState = { visible: true }

function readSuggestionsUiState(editorState: EditorState): SuggestionsUiState {
  return suggestionsUiPluginKey.getState(editorState) ?? initialState
}

function getSuggestionsVisible(editor: Editor): boolean {
  return readSuggestionsUiState(editor.state).visible
}

function setSuggestionsVisible({ editor, visible }: SetSuggestionsVisibleInput): void {
  editor.view.dispatch(
    editor.state.tr.setMeta(suggestionsUiPluginKey, {
      type: 'setVisible',
      visible
    } satisfies SuggestionsUiCommand)
  )
}

function isSuggestionsUiCommand(value: unknown): value is SuggestionsUiCommand {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'setVisible' &&
    'visible' in value &&
    typeof value.visible === 'boolean'
  )
}

function readSuggestionsUiCommand(transaction: Transaction): SuggestionsUiCommand | null {
  const meta: unknown = transaction.getMeta(suggestionsUiPluginKey)
  return isSuggestionsUiCommand(meta) ? meta : null
}

function reduceSuggestionsUi(
  state: SuggestionsUiState,
  command: SuggestionsUiCommand
): SuggestionsUiState {
  return { ...state, visible: command.visible }
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
  setSuggestionsVisible
}
export type { SuggestionsUiState, SetSuggestionsVisibleInput }
