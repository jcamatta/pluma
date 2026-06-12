// Wires the slash menu hook to its view. Holds no layout of its own: it reads the popup props from
// useSlashMenu and renders the view, wrapped in AnimatePresence so the panel animates out when the menu
// closes. Renders nothing while the menu is inactive.

import { AnimatePresence } from 'motion/react'
import type { Editor } from '@tiptap/core'
import { useSlashMenu } from './useSlashMenu'
import { SlashMenuView } from './SlashMenu.view'

type SlashMenuControllerProps = {
  readonly editor: Editor
}

function SlashMenuController({ editor }: SlashMenuControllerProps): React.JSX.Element {
  const menu = useSlashMenu(editor)
  return (
    <AnimatePresence>{menu ? <SlashMenuView key="slash-menu" {...menu} /> : null}</AnimatePresence>
  )
}

export { SlashMenuController }
export type { SlashMenuControllerProps }
