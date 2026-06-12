// The settled conversation: every user bubble and assistant reply in order, each animated in on mount.
// Pure props — the items come pre-folded from transcript-logic. The assistant reply mirrors AssistantTurn's
// settled look (spark + relaxed text) without the live activity, which only the in-flight turn shows.

import { Sparkles } from 'lucide-react'
import type { TranscriptItem } from './transcript-logic'
import { AssistantMarkdown } from './AssistantMarkdown.view'
import { UserMessage } from './UserMessage.view'

function AssistantReply({ text }: { readonly text: string }): React.JSX.Element {
  return (
    <div className="mb-3 flex gap-2">
      <span className="mt-px flex-none text-action-primary">
        <Sparkles size={16} />
      </span>
      <div className="min-w-0 flex-1 text-sm leading-relaxed text-text-primary">
        <AssistantMarkdown text={text} />
      </div>
    </div>
  )
}

export function TranscriptView({
  items
}: {
  readonly items: readonly TranscriptItem[]
}): React.JSX.Element {
  return (
    <div>
      {items.map((item) => (
        <div key={item.id} className="rise-in">
          {item.role === 'user' ? (
            <UserMessage text={item.text} />
          ) : (
            <AssistantReply text={item.text} />
          )}
        </div>
      ))}
    </div>
  )
}
