// Bundles the List popover's review commands for one editor: per-row accept / reject / mark-read and the
// per-group bulk "accept all" / "mark all read". Each writes straight to plugin state via the existing
// proposal/annotation commands. The bulk actions read ids from the current list snapshot; a conflicted edit
// and an already-read note are both pending=false, so filtering on `pending` excludes them — no conflicted
// edit is ever plain-accepted, matching the row that offers no accept. Jumping is owned by the controller
// (it also closes the popover and reveals the node), so it is passed in rather than built here.

import { useMemo } from 'react'
import type { Editor } from '@tiptap/core'
import { acceptProposal, rejectProposal } from './extensions/proposals'
import { markAnnotationRead } from './extensions/annotations'
import type { SuggestionsListActions } from './SuggestionsList.view'
import type { Suggestion, SuggestionType } from './suggestion-list'

interface SuggestionListActionsInput {
  readonly editor: Editor
  readonly items: readonly Suggestion[]
  readonly onJump: (item: Suggestion) => void
}

function useSuggestionListActions({
  editor,
  items,
  onJump
}: SuggestionListActionsInput): SuggestionsListActions {
  return useMemo<SuggestionsListActions>(
    () => ({
      onJump,
      onAccept: (item) => acceptProposal({ editor, id: item.id }),
      onReject: (item) => rejectProposal({ editor, id: item.id }),
      onMarkRead: (item) => markAnnotationRead({ editor, id: item.id }),
      onAcceptGroup: (type: SuggestionType) =>
        items
          .filter((item) => item.type === type && item.pending)
          .forEach((item) => acceptProposal({ editor, id: item.id })),
      onMarkAllRead: () =>
        items
          .filter((item) => item.type === 'note' && item.pending)
          .forEach((item) => markAnnotationRead({ editor, id: item.id }))
    }),
    [editor, items, onJump]
  )
}

export { useSuggestionListActions }
