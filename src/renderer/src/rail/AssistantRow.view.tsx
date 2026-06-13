// One settled-or-live assistant row from the conversation projection: the spark icon, an optional
// collapsible step timeline (reusing ActivityView), and the reply text. It renders identically whether
// the steps came from a live run or a reloaded thread, since both arrive as the same AssistantRow. The
// timeline shows only when there is something to show — any steps, or a run still working/errored — so a
// plain text reply stays clean. Reply text renders as it streams (no hide-until-settled). Pure props.

import { Sparkles } from 'lucide-react'
import { ActivityView, type ActivityLabels } from './Activity.view'
import { AssistantMarkdown } from './AssistantMarkdown.view'
import type { AssistantRow } from './conversation-rows'
import type { RunStatus } from './step'

interface AssistantRowViewProps {
  readonly row: AssistantRow
  readonly status: RunStatus
  readonly labels: ActivityLabels
  readonly expanded: boolean
  readonly onToggleExpand: () => void
}

export function AssistantRowView({
  row,
  status,
  labels,
  expanded,
  onToggleExpand
}: AssistantRowViewProps): React.JSX.Element {
  const showTimeline = row.steps.length > 0 || status === 'working' || status === 'error'

  return (
    <div className="flex gap-2">
      <span className="mt-px flex-none text-action-primary">
        <Sparkles size={16} />
      </span>
      <div className="min-w-0 flex-1">
        {showTimeline && (
          <ActivityView
            status={status}
            log={row.steps}
            labels={labels}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
          />
        )}
        {row.text && (
          <div
            data-testid="assistant-reply"
            className="mt-3 text-sm leading-relaxed text-text-primary"
          >
            <AssistantMarkdown text={row.text} />
          </div>
        )}
      </div>
    </div>
  )
}

export type { AssistantRowViewProps }
