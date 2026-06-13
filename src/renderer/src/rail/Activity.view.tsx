// The run's activity: a collapsible header (spinner + current step while working, "Worked"/"Run failed"
// + step count + chevron) over the timeline of LogRows. The header collapses at any time, including
// mid-run, so the steps can be hidden while the agent is still working. Pure props — the Stop control
// lives with the composer, since interrupting is a run-control, not a per-message action. The timeline
// rail offset is sub-scale, so it goes through `style`.

import { Button } from '@base-ui/react'
import { Check, ChevronDown, X } from 'lucide-react'
import type { LogEntry, RunStatus } from './step'
import { LogRow } from './LogRow.view'

interface ActivityLabels {
  readonly thinking: string
  readonly worked: string
  readonly runFailed: string
  // Pluralizes the step count: step(n) → "1 step" / "3 steps".
  readonly step: (count: number) => string
}

interface ActivityViewProps {
  readonly status: RunStatus
  readonly log: readonly LogEntry[]
  readonly labels: ActivityLabels
  readonly expanded: boolean
  readonly onToggleExpand: () => void
}

function StatusIcon({
  working,
  failed
}: {
  readonly working: boolean
  readonly failed: boolean
}): React.JSX.Element {
  if (working) {
    return <span className="spinner-ring block flex-none" style={{ width: 12, height: 12 }} />
  }
  if (failed) {
    return (
      <span className="flex flex-none text-feedback-error">
        <X size={14} />
      </span>
    )
  }
  return (
    <span className="flex flex-none text-feedback-success">
      <Check size={14} />
    </span>
  )
}

function Header({
  working,
  failed,
  label,
  stepLabel,
  expanded,
  onToggleExpand
}: {
  readonly working: boolean
  readonly failed: boolean
  readonly label: string
  readonly stepLabel: string
  readonly expanded: boolean
  readonly onToggleExpand: () => void
}): React.JSX.Element {
  return (
    <Button type="button" onClick={onToggleExpand} className="flex w-full items-center gap-2 py-px">
      <StatusIcon working={working} failed={failed} />
      <span className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-text-secondary">
        {label}
      </span>
      <span className="flex-none whitespace-nowrap text-xs text-text-muted">{stepLabel}</span>
      <span
        className="flex flex-none text-text-muted transition-transform duration-200"
        style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
      >
        <ChevronDown size={13} />
      </span>
    </Button>
  )
}

function Timeline({ log }: { readonly log: readonly LogEntry[] }): React.JSX.Element | null {
  if (log.length === 0) return null
  return (
    <div className="relative mt-1" style={{ paddingLeft: 22 }}>
      <span className="absolute bg-(--line)" style={{ left: 8, top: 6, bottom: 8, width: 1.5 }} />
      {log.map((entry) => (
        <LogRow key={entry.id} entry={entry} />
      ))}
    </div>
  )
}

// The header label follows the run status: while working it shows the current (last) step, falling back
// to "Thinking…" before any step lands — never "Worked", which is reserved for a settled success. A
// failed run reads "Run failed"; a clean one reads "Worked".
function headerLabel(
  run: { readonly status: RunStatus; readonly log: readonly LogEntry[] },
  labels: ActivityLabels
): string {
  if (run.status === 'working') return run.log.at(-1)?.text ?? labels.thinking
  if (run.status === 'error') return labels.runFailed
  return labels.worked
}

export function ActivityView({
  status,
  log,
  labels,
  expanded,
  onToggleExpand
}: ActivityViewProps): React.JSX.Element {
  return (
    <>
      <Header
        working={status === 'working'}
        failed={status === 'error'}
        label={headerLabel({ status, log }, labels)}
        stepLabel={labels.step(log.length)}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
      />
      {expanded && <Timeline log={log} />}
    </>
  )
}

export type { ActivityLabels, ActivityViewProps }
