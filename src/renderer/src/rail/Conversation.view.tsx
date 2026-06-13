// The whole conversation: every turn's user bubble and grouped assistant row in order, each animated in
// on mount. Pure props — rows come pre-projected (conversation-rows) and status-overlaid
// (conversation-render). Each assistant row's timeline is independently collapsible; the controller owns
// the per-row override map, the view resolves the effective expanded state against the row's default. A
// ref is attached to the most recently sent user bubble so the controller can scroll it into view; a
// trailing spacer leaves room beneath the last turn so a fresh reply lands with breathing room.

import type { ActivityLabels } from './Activity.view'
import { AssistantRowView } from './AssistantRow.view'
import { UserMessage } from './UserMessage.view'
import { defaultExpanded, type RenderRow } from './conversation-render'

interface ConversationViewProps {
  readonly rows: readonly RenderRow[]
  readonly labels: ActivityLabels
  // Per-row expand overrides keyed by row id; absent ids fall back to defaultExpanded(status).
  readonly overrides: ReadonlyMap<string, boolean>
  readonly onSetExpanded: (id: string, expanded: boolean) => void
  // The user bubble to scroll into view (the latest sent message), or null before anything is sent.
  readonly scrollRefId: string | null
  readonly scrollRef: React.RefObject<HTMLDivElement | null>
}

export function ConversationView({
  rows,
  labels,
  overrides,
  onSetExpanded,
  scrollRefId,
  scrollRef
}: ConversationViewProps): React.JSX.Element {
  return (
    <div>
      {rows.map(({ row, status }) =>
        row.kind === 'user' ? (
          <div
            key={row.id}
            ref={row.id === scrollRefId ? scrollRef : undefined}
            className="rise-in scroll-mb-24"
          >
            <UserMessage text={row.text} />
          </div>
        ) : (
          <div key={row.id} className="rise-in mb-6">
            <AssistantRowView
              row={row}
              status={status}
              labels={labels}
              expanded={overrides.get(row.id) ?? defaultExpanded(status)}
              onToggleExpand={() =>
                onSetExpanded(row.id, !(overrides.get(row.id) ?? defaultExpanded(status)))
              }
            />
          </div>
        )
      )}
      <div className="min-h-24" aria-hidden />
    </div>
  )
}

export type { ConversationViewProps }
