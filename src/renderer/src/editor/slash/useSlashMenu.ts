// Reads the slash bridge reactively and shapes it into the popup's props: subscribes via
// useSyncExternalStore, translates each item's label, derives the caret position, and wires the row
// callbacks back to the bridge. Returns null when the menu is inactive so the controller renders nothing.
// onHover sets the highlight to a specific row by moving the delta from the current index.

import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import type { Editor } from '@tiptap/core'
import { getSlashBridge } from '../extensions/slash-command'
import { slashMenuPlacement } from './slash-menu-position-logic'
import type { SlashMenuViewProps } from './SlashMenu.view'

function useSlashMenu(editor: Editor): SlashMenuViewProps | null {
  const { t } = useTranslation()
  const bridge = getSlashBridge(editor)
  const snapshot = useSyncExternalStore(bridge.subscribe, bridge.getSnapshot)

  if (!snapshot.active || !snapshot.caret) return null

  return {
    items: snapshot.items.map((item) => ({
      id: item.id,
      label: t(item.labelKey),
      hint: item.hint
    })),
    activeIndex: snapshot.index,
    placement: slashMenuPlacement(snapshot.caret, window.innerHeight),
    heading: t('editor.slash.heading'),
    emptyLabel: t('editor.slash.empty'),
    onSelect: (index) => bridge.select(index),
    onHover: (index) => bridge.move(index - snapshot.index)
  }
}

export { useSlashMenu }
