// The rail's Chat/Review tab state plus the live count of editor artifacts that badges the Review tab.
// Bundled into one hook so the chat controller reads tab + count in a single call and stays within its
// statement budget. The count tracks the active editor's annotations/proposals via useEditorArtifacts.

import { useState } from 'react'
import { useEditorArtifacts } from '../artifacts/useEditorArtifacts'
import type { RailTab } from './ConversationRail.view'

interface ReviewTab {
  readonly tab: RailTab
  readonly setTab: (tab: RailTab) => void
  readonly reviewCount: number
}

function useReviewTab(): ReviewTab {
  const [tab, setTab] = useState<RailTab>('chat')
  const { artifacts } = useEditorArtifacts()
  return { tab, setTab, reviewCount: artifacts.length }
}

export { useReviewTab }
export type { ReviewTab }
