// The slash menu, wired on the official `@tiptap/suggestion` utility. Suggestion owns trigger detection,
// the query/range, the caret rect, and key forwarding; this extension translates its imperative lifecycle
// into the per-editor reactive bridge (kept in `addStorage`, read by the hook through `getSlashBridge`).
// `items` and `command` delegate to the pure catalog/filter and the apply action.

import { Extension } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { Suggestion } from '@tiptap/suggestion'
import type { SuggestionProps } from '@tiptap/suggestion'
import { slashCommands } from '../slash/slash-command-catalog'
import type { SlashCommandItem } from '../slash/slash-command-catalog'
import { filterSlashCommands } from '../slash/filter-slash-commands'
import { applySlashCommand } from '../slash/apply-slash-command'
import { createSlashBridge } from '../slash/slash-menu-bridge'
import type { SlashBridge } from '../slash/slash-menu-bridge'
import type { CaretRect } from '../slash/slash-menu-position-logic'

declare module '@tiptap/core' {
  interface Storage {
    slashCommand: { readonly bridge: SlashBridge }
  }
}

type SlashProps = SuggestionProps<SlashCommandItem, SlashCommandItem>

type SlashRenderHandlers = {
  readonly onStart: (props: SlashProps) => void
  readonly onUpdate: (props: SlashProps) => void
  readonly onKeyDown: (props: { readonly event: KeyboardEvent }) => boolean
  readonly onExit: () => void
}

const slashCommandPluginKey = new PluginKey('slashCommand')

const caretFromProps = (props: SlashProps): CaretRect | null => {
  const rect = props.clientRect?.()
  return rect ? { top: rect.top, bottom: rect.bottom, left: rect.left } : null
}

const openBridge = (bridge: SlashBridge, props: SlashProps): void => {
  bridge.open({ items: props.items, command: props.command, caret: caretFromProps(props) })
}

const keyActions: Record<string, (bridge: SlashBridge) => void> = {
  ArrowUp: (bridge) => bridge.move(-1),
  ArrowDown: (bridge) => bridge.move(1),
  Enter: (bridge) => bridge.select(),
  Escape: (bridge) => bridge.close()
}

const handleSlashKey = (bridge: SlashBridge, event: KeyboardEvent): boolean => {
  const action = keyActions[event.key]
  if (!action) return false
  action(bridge)
  return true
}

const slashRenderHandlers = (bridge: SlashBridge): SlashRenderHandlers => ({
  onStart: (props) => openBridge(bridge, props),
  onUpdate: (props) => openBridge(bridge, props),
  onKeyDown: ({ event }) => handleSlashKey(bridge, event),
  onExit: () => bridge.close()
})

const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addStorage() {
    return { bridge: createSlashBridge() }
  },

  addProseMirrorPlugins() {
    const { bridge } = this.editor.storage.slashCommand
    return [
      Suggestion<SlashCommandItem, SlashCommandItem>({
        editor: this.editor,
        pluginKey: slashCommandPluginKey,
        char: '/',
        allowSpaces: false,
        items: ({ query }) => [...filterSlashCommands(slashCommands, query)],
        command: ({ editor, range, props }) => applySlashCommand({ editor, id: props.id, range }),
        render: () => slashRenderHandlers(bridge)
      })
    ]
  }
})

const getSlashBridge = (editor: Editor): SlashBridge => editor.storage.slashCommand.bridge

export { SlashCommandExtension, slashCommandPluginKey, getSlashBridge }
