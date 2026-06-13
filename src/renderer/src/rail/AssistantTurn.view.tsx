// The assistant's side of a turn: the spark icon, the run's activity (header + timeline), and the
// editor's streamed reply once the run lands. Pure props.

import { Sparkles } from 'lucide-react'
import type { AgentActivity } from './activity-log'
import { ActivityView, type ActivityLabels } from './Activity.view'
import { AssistantMarkdown } from './AssistantMarkdown.view'

interface AssistantTurnViewProps {
  readonly activity: AgentActivity
  readonly labels: ActivityLabels
  readonly expanded: boolean
  readonly onToggleExpand: () => void
}

export function AssistantTurnView({
  activity,
  labels,
  expanded,
  onToggleExpand
}: AssistantTurnViewProps): React.JSX.Element {
  const reply = activity.status === 'working' ? '' : activity.summary

  return (
    <div className="flex gap-2">
      <span className="mt-px flex-none text-action-primary">
        <Sparkles size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <ActivityView
          status={activity.status}
          log={activity.log}
          labels={labels}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
        />
        {reply && (
          <div
            data-testid="assistant-reply"
            className="mt-3 text-sm leading-relaxed text-text-primary"
          >
            <AssistantMarkdown text={reply} />
          </div>
        )}
      </div>
    </div>
  )
}

export type { AssistantTurnViewProps }
