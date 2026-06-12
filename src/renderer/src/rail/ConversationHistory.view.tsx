// Pure transcript of a loaded thread: the past user/assistant messages rendered above the live turn,
// with loading and error states. User messages reuse the chat bubble; assistant messages render as the
// spark-prefixed reply block, matching a live turn. Non-text roles (tool/system) are omitted. Holds no
// hooks and no IPC — messages, the loading/failed flags, and resolved labels arrive through props.

import { Sparkles } from 'lucide-react'
import type { Message } from '@ag-ui/core'
import { UserMessage } from './UserMessage.view'
import { messageText } from './message-text'

interface ConversationHistoryLabels {
  readonly loading: string
  readonly error: string
}

interface ConversationHistoryViewProps {
  readonly loading: boolean
  readonly failed: boolean
  readonly messages: readonly Message[]
  readonly labels: ConversationHistoryLabels
}

function HistoryMessage({ message }: { readonly message: Message }): React.JSX.Element {
  const text = messageText(message)
  if (message.role === 'user') return <UserMessage text={text} />
  return (
    <div className="flex gap-2">
      <span className="mt-px flex-none text-action-primary">
        <Sparkles size={16} />
      </span>
      <div className="min-w-0 flex-1 text-sm leading-relaxed text-text-primary">{text}</div>
    </div>
  )
}

export function ConversationHistoryView({
  loading,
  failed,
  messages,
  labels
}: ConversationHistoryViewProps): React.JSX.Element {
  if (loading) {
    return <div className="px-1 py-4 text-center text-sm text-text-muted">{labels.loading}</div>
  }
  if (failed) {
    return <div className="px-1 py-4 text-center text-sm text-feedback-error">{labels.error}</div>
  }

  const shown = messages.filter(
    (message) => message.role === 'user' || message.role === 'assistant'
  )
  if (shown.length === 0) return <></>

  return (
    <div
      data-testid="thread-transcript"
      className="mb-4 flex flex-col gap-3 border-b border-(--line) pb-4"
    >
      {shown.map((message) => (
        <HistoryMessage key={message.id} message={message} />
      ))}
    </div>
  )
}

export type { ConversationHistoryLabels, ConversationHistoryViewProps }
