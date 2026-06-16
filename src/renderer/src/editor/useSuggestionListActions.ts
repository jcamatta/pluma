// Bundles the List popover's per-row review commands for one editor: accept / reject (edits) and mark-read
// (notes). Each writes straight to plugin state via the existing proposal/annotation commands. A conflicted
// edit and an already-read note are both pending=false, so the row that offers no action also drives no
// command. Jumping is owned by the controller (it also closes the popover and reveals the node), so it is
// passed in rather than built here.

import { useMemo } from 'react'
import type { Editor } from '@tiptap/core'
import { acceptProposal, rejectProposal } from './extensions/proposals'
import { markAnnotationRead } from './extensions/annotations'
import type { SuggestionsListActions } from './SuggestionsList.view'
import type { Suggestion } from './suggestion-list'

interface SuggestionListActionsInput {
  readonly editor: Editor
  readonly onJump: (item: Suggestion) => void
}

function useSuggestionListActions({
  editor,
  onJump
}: SuggestionListActionsInput): SuggestionsListActions {
  return useMemo<SuggestionsListActions>(
    () => ({
      onJump,
      onAccept: (item) => acceptProposal({ editor, id: item.id }),
      onReject: (item) => rejectProposal({ editor, id: item.id }),
      onMarkRead: (item) => markAnnotationRead({ editor, id: item.id })
    }),
    [editor, onJump]
  )
}

export { useSuggestionListActions }
