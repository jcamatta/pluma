// Global Ctrl/Cmd+K toggles writing focus between the chat composer and the editor. From the editor (or
// anywhere else) it opens the chat rail when closed and focuses the composer on the next frame (after
// `openRail` has mounted it); pressed again while the composer already holds focus it returns to the
// editor. Every focus operation goes through a registered handle passed in (composer + editor), so the
// shortcut never reaches into the DOM to find a component — see ComposerFocusContext / ActiveEditorContext.

import { useEffect } from 'react'

interface ChatShortcutActions {
  // Ensure the rail is open (a no-op when it already is).
  readonly openRail: () => void
  // Whether the composer currently holds focus — decides the toggle direction.
  readonly composerHasFocus: () => boolean
  // Focus the composer textarea (a no-op when the rail is closed and it is not yet mounted).
  readonly focusComposer: () => void
  // Return focus to the active editor (a no-op when no file is open).
  readonly focusEditor: () => void
}

function isChatShortcut(event: KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
}

function useChatShortcut({
  openRail,
  composerHasFocus,
  focusComposer,
  focusEditor
}: ChatShortcutActions): void {
  useEffect(() => {
    const handle = (event: KeyboardEvent): void => {
      if (!isChatShortcut(event)) return
      event.preventDefault()

      if (composerHasFocus()) {
        focusEditor()
        return
      }

      openRail()
      requestAnimationFrame(focusComposer)
    }

    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [openRail, composerHasFocus, focusComposer, focusEditor])
}

export { useChatShortcut, isChatShortcut }
export type { ChatShortcutActions }
