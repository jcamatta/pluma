// Wires one editor's live suggestion count and visibility (both from plugin state) to the pure
// SuggestionsBar view. Renders nothing until the file has at least one suggestion of any kind — the bar
// stays up even once everything is reviewed so the user can still Show/Hide, and disappears only when the
// file has no suggestions at all. The Hide all / Show all toggle flips the suggestions-ui `visible` flag in
// plugin state; opening the list is inert until the list popover ships in a later step.

import { useCallback } from 'react'
import { useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Editor } from '@tiptap/core'
import { useEditorSuggestions } from './useEditorSuggestions'
import { useSuggestionsVisible } from './useSuggestionsVisible'
import { setSuggestionsVisible } from './extensions/suggestions-ui'
import { SuggestionsBar } from './SuggestionsBar.view'

interface SuggestionsBarControllerProps {
  readonly editor: Editor
}

function SuggestionsBarController({
  editor
}: SuggestionsBarControllerProps): React.JSX.Element | null {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion() ?? false
  const { items, pendingCount } = useEditorSuggestions(editor)
  const visible = useSuggestionsVisible(editor)

  const onToggleVisible = useCallback(
    () => setSuggestionsVisible({ editor, visible: !visible }),
    [editor, visible]
  )

  // The list popover ships in a later step; the button stays inert until then.
  const onOpenList = useCallback(() => undefined, [])

  if (items.length === 0) return null

  return (
    <SuggestionsBar
      count={pendingCount}
      visible={visible}
      reduceMotion={reduceMotion}
      labels={{
        suggestions: t('editor.suggestionsBar.suggestions'),
        toReview: t('editor.suggestionsBar.toReview', { count: pendingCount }),
        allReviewed: t('editor.suggestionsBar.allReviewed'),
        hideAll: t('editor.suggestionsBar.hideAll'),
        showAll: t('editor.suggestionsBar.showAll'),
        list: t('editor.suggestionsBar.list')
      }}
      onToggleVisible={onToggleVisible}
      onOpenList={onOpenList}
    />
  )
}

export { SuggestionsBarController }
export type { SuggestionsBarControllerProps }
