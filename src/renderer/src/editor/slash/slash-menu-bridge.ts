// The adapter between Suggestion's imperative render lifecycle and React. A per-editor instance (created in
// the extension's storage, never module-level) holding the current menu state plus the active command, and
// exposing the `useSyncExternalStore` shape. Snapshots are replaced wholesale on each change so the
// reference is stable while nothing moves; the highlight index lives here so the popup view stays pure.

import type { SlashCommandItem } from './slash-command-catalog'
import type { CaretRect } from './slash-menu-position-logic'

type SlashCommand = (item: SlashCommandItem) => void

type SlashOpenInput = {
  readonly items: readonly SlashCommandItem[]
  readonly command: SlashCommand
  readonly caret: CaretRect | null
}

type SlashMenuSnapshot = {
  readonly active: boolean
  readonly items: readonly SlashCommandItem[]
  readonly index: number
  readonly caret: CaretRect | null
}

type SlashBridge = {
  readonly subscribe: (listener: () => void) => () => void
  readonly getSnapshot: () => SlashMenuSnapshot
  readonly open: (input: SlashOpenInput) => void
  readonly move: (delta: number) => void
  readonly select: (index?: number) => void
  readonly close: () => void
}

const closedSnapshot: SlashMenuSnapshot = { active: false, items: [], index: 0, caret: null }

const noopCommand: SlashCommand = () => {}

const wrapIndex = (index: number, length: number): number =>
  length === 0 ? 0 : ((index % length) + length) % length

function createSlashBridge(): SlashBridge {
  const state = {
    snapshot: closedSnapshot,
    command: noopCommand,
    listeners: new Set<() => void>()
  }

  const emit = (next: SlashMenuSnapshot): void => {
    state.snapshot = next
    state.listeners.forEach((listener) => listener())
  }

  return {
    subscribe: (listener) => {
      state.listeners.add(listener)
      return () => {
        state.listeners.delete(listener)
      }
    },
    getSnapshot: () => state.snapshot,
    open: (input) => {
      state.command = input.command
      emit({ active: true, items: input.items, index: 0, caret: input.caret })
    },
    move: (delta) => {
      const current = state.snapshot
      if (!current.active) return
      emit({ ...current, index: wrapIndex(current.index + delta, current.items.length) })
    },
    select: (index) => {
      const current = state.snapshot
      if (!current.active) return
      const item = current.items[index ?? current.index]
      if (!item) return
      const run = state.command
      state.command = noopCommand
      emit(closedSnapshot)
      run(item)
    },
    close: () => {
      if (!state.snapshot.active) return
      state.command = noopCommand
      emit(closedSnapshot)
    }
  }
}

export { createSlashBridge }
export type { SlashBridge, SlashMenuSnapshot, SlashOpenInput }
