// One conversation turn: the user's message bubble over the assistant's reply. Composition only — the
// bubble is UserMessage, the assistant side (activity + reply) is AssistantTurn. Pure props.

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

export function ConversationTurnView({
  prompt,
  activity,
  labels,
  expanded,
  onToggleExpand
}: ConversationTurnViewProps): React.JSX.Element {
  return (
    <div className="rise-in" style={{ marginBottom: 22 }}>
      <UserMessage text={prompt} />
      <AssistantTurnView
        activity={activity}
        labels={labels}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
      />
    </div>
  )
}

export type { ConversationTurnViewProps }
