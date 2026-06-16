// Wires one editor's live suggestion count and visibility (both from plugin state) to the pure
// SuggestionsBar view, and owns the grouped List popover. Renders nothing until the file has at least one
// suggestion of any kind — the bar stays up even once everything is reviewed so the user can still Show/Hide,
// and disappears only when the file has no suggestions at all. The Hide all / Show all toggle flips the
// suggestions-ui `visible` flag in plugin state; the List button opens a popover (React UI state) anchored to
// it. Jumping to a row forces suggestions visible, marks the row the active suggestion (both plugin state),
// and reveals it by scrolling its DOM node into the center of the manuscript viewport.

import { useCallback, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Editor } from '@tiptap/core'
import { useEditorSuggestions } from './useEditorSuggestions'
import { useSuggestionsVisible } from './useSuggestionsVisible'
import { useSuggestionListActions } from './useSuggestionListActions'
import { setActiveSuggestion, setSuggestionsVisible } from './extensions/suggestions-ui'
import { reveal } from './suggestion-scroll'
import { SuggestionsBar } from './SuggestionsBar.view'
import { SuggestionsList } from './SuggestionsList.view'
import type { Suggestion } from './suggestion-list'

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
  const [listOpen, setListOpen] = useState(false)
  const listButtonRef = useRef<HTMLButtonElement>(null)

  const onToggleVisible = useCallback(
    () => setSuggestionsVisible({ editor, visible: !visible }),
    [editor, visible]
  )

  const onOpenList = useCallback(() => setListOpen((open) => !open), [])

  const onJump = useCallback(
    (item: Suggestion) => {
      setListOpen(false)
      setSuggestionsVisible({ editor, visible: true })
      setActiveSuggestion({ editor, id: item.id })
      reveal(editor, item.from)
    },
    [editor]
  )

  const actions = useSuggestionListActions({ editor, items, onJump })

  if (items.length === 0) return null

  return (
    <>
      <SuggestionsBar
        count={pendingCount}
        visible={visible}
        reduceMotion={reduceMotion}
        listButtonRef={listButtonRef}
        listOpen={listOpen}
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
      <SuggestionsList
        open={listOpen}
        onOpenChange={setListOpen}
        anchor={listButtonRef}
        items={items}
        reduceMotion={reduceMotion}
        labels={{
          rewrites: t('editor.suggestionsList.rewrites'),
          inserts: t('editor.suggestionsList.inserts'),
          notes: t('editor.suggestionsList.notes'),
          read: t('editor.suggestionsList.read'),
          conflicted: t('editor.suggestionsList.conflicted'),
          accept: t('editor.suggestionPill.accept'),
          reject: t('editor.suggestionPill.reject'),
          markRead: t('editor.suggestionsList.markRead'),
          acceptAll: t('editor.suggestionsList.acceptAll'),
          markAllRead: t('editor.suggestionsList.markAllRead')
        }}
        actions={actions}
      />
    </>
  )
}

export { SuggestionsBarController }
export type { SuggestionsBarControllerProps }
