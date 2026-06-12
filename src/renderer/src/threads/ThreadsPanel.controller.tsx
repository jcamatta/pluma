// Wires the threads (chats) panel: reads the workspace's threads with useThreads(cwd), resolves i18n
// labels, maps each summary to a row (supplying the localized untitled fallback and a relative-time
// subtitle), and renders the pure ThreadsPanelView. Selection, new-thread, and back are lifted to the
// caller (the rail) through props so the agent seeding and view switching stay in one place.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useThreads } from './useThreads'
import { ThreadsPanelView } from './ThreadsPanel.view'
import type { ThreadRow } from './ThreadsPanel.view'
import { formatRelativeTime } from './format-relative-time'

interface ThreadsPanelControllerProps {
  readonly cwd: string
  readonly activeId: string | null
  readonly onSelect: (id: string) => void
  readonly onNewThread: () => void
  readonly onBack: () => void
}

export function ThreadsPanelController({
  cwd,
  activeId,
  onSelect,
  onNewThread,
  onBack
}: ThreadsPanelControllerProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const [now] = useState(() => Date.now())
  const query = useThreads(cwd)
  const summaries = query.data?.ok ? query.data.value : []
  const rows: readonly ThreadRow[] = summaries.map((summary) => ({
    id: summary.id,
    title: summary.title.length > 0 ? summary.title : t('threads.untitled'),
    subtitle: formatRelativeTime({ from: summary.updatedAt, now, locale: i18n.language }),
    active: summary.id === activeId
  }))

  return (
    <ThreadsPanelView
      labels={{
        title: t('threads.title'),
        newThread: t('threads.newThread'),
        back: t('threads.back'),
        empty: t('threads.empty')
      }}
      rows={rows}
      onSelect={onSelect}
      onNewThread={onNewThread}
      onBack={onBack}
    />
  )
}

export type { ThreadsPanelControllerProps }
