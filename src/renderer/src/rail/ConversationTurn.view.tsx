// One conversation turn: the user's message bubble over the assistant's reply. Composition only — the
// bubble is UserMessage, the assistant side (activity + reply) is AssistantTurn. Pure props. Forwards a
// ref to the user bubble so the controller can scroll a just-sent message into view; a spacer below the
// turn leaves room beneath it for the assistant's reply to appear (the message lands near the bottom with
// a little breathing room, not flush against the composer).

import { forwardRef } from 'react'
import type { AgentActivity } from './activity-log'
import { AssistantTurnView } from './AssistantTurn.view'
import type { ActivityLabels } from './Activity.view'
import { UserMessage } from './UserMessage.view'

interface ConversationTurnViewProps {
  readonly prompt: string
  readonly activity: AgentActivity
  readonly labels: ActivityLabels
  readonly expanded: boolean
  readonly onToggleExpand: () => void
}

export const ConversationTurnView = forwardRef<HTMLDivElement, ConversationTurnViewProps>(
  function ConversationTurnView(
    { prompt, activity, labels, expanded, onToggleExpand },
    userBubbleRef
  ): React.JSX.Element {
    return (
      <div className="rise-in" style={{ marginBottom: 22 }}>
        <div ref={userBubbleRef} className="scroll-mb-24">
          <UserMessage text={prompt} />
        </div>
        <AssistantTurnView
          activity={activity}
          labels={labels}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
        />
        <div className="min-h-24" aria-hidden />
      </div>
    )
  }
)

export type { ConversationTurnViewProps }
