// Mounts the global Ctrl/Cmd+K writing-focus toggle inside the editor and composer focus providers so it
// can drive both imperatively: it reads the active editor (to hand focus back) and the composer handle
// (to focus it / check whether it holds focus). `openRail` is lifted from the shell so the shortcut can
// open the rail when it is collapsed. Renders nothing — it owns only that wiring, the way EditorToolsBridge
// owns editor-tool registration, keeping the App shell free of the context dependencies.

import { useCallback } from 'react'
import { useActiveEditor } from '../editor/ActiveEditorContext'
import { useComposerFocus } from './ComposerFocusContext'
import { useChatShortcut } from './useChatShortcut'

function ChatShortcutBridge({ openRail }: { readonly openRail: () => void }): null {
  const { editor } = useActiveEditor()
  const composer = useComposerFocus()
  const focusEditor = useCallback(() => {
    editor?.commands.focus()
  }, [editor])

  useChatShortcut({
    openRail,
    composerHasFocus: composer.isFocused,
    focusComposer: composer.focus,
    focusEditor
  })
  return null
}

export { ChatShortcutBridge }
