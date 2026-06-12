// Wires the selected thread's transcript: loads its history with useThreadHistory(cwd, threadId),
// resolves the loading/error labels, and renders the pure ConversationHistoryView. Rendered only when a
// thread is selected (the parent guards on selectedId), so threadId is always a real id here.

import { useTranslation } from 'react-i18next'
import { useThreadHistory } from '../threads/useThreadHistory'
import { ConversationHistoryView } from './ConversationHistory.view'

interface ConversationHistoryControllerProps {
  readonly cwd: string
  readonly threadId: string
}

export function ConversationHistoryController({
  cwd,
  threadId
}: ConversationHistoryControllerProps): React.JSX.Element {
  const { t } = useTranslation()
  const history = useThreadHistory(cwd, threadId)
  const failed = history.data !== undefined && !history.data.ok
  const messages = history.data?.ok ? history.data.value : []

  return (
    <ConversationHistoryView
      loading={history.isPending}
      failed={failed}
      messages={messages}
      labels={{ loading: t('threads.historyLoading'), error: t('threads.historyError') }}
    />
  )
}

export type { ConversationHistoryControllerProps }
