// One row in a turn's activity stream, ported from the design's LogRow. Its glyph encodes the
// tool-call state: a spinning ring while calling, a check on success, a cross on failure, a pulsing
// dot while thinking, a small dot for info. The optional monospace meta line carries the tool result
// (or, on failure, the error). Pure props, rendered in our tokens. The glyph sits in the gutter on the
// timeline rail the parent draws, ringed by the surface so it masks the line behind it; the exact
// pixel geometry (gutter offset, ring size) goes through `style` since it is finer than our scale.

import { Check, X } from 'lucide-react'
import type { LogEntry, LogStatus } from './activity-log'

function Glyph({ status }: { readonly status: LogStatus }): React.JSX.Element | null {
  if (status === 'calling') {
    return <span className="spinner-ring block" style={{ width: 12, height: 12 }} />
  }
  if (status === 'success') return <Check size={13} />
  if (status === 'failed') return <X size={12} />
  if (status === 'thinking') {
    return (
      <span
        className="agent-status-dot block rounded-full bg-feedback-warning"
        style={{ width: 8, height: 8 }}
      />
    )
  }
  return <span className="block rounded-full bg-current" style={{ width: 6, height: 6 }} />
}

function glyphColor(status: LogStatus): string {
  if (status === 'calling') return 'text-action-primary'
  if (status === 'success') return 'text-feedback-success'
  if (status === 'failed') return 'text-feedback-error'
  if (status === 'thinking') return 'text-feedback-warning'
  return 'text-text-muted'
}

export function LogRow({ entry }: { readonly entry: LogEntry }): React.JSX.Element {
  const dim = entry.status === 'failed'
  return (
    <div className="rise-in relative" style={{ marginBottom: 14 }}>
      <span
        className={`absolute flex items-center justify-center rounded-full bg-surface-3 ${glyphColor(entry.status)}`}
        style={{
          left: -22,
          top: 1,
          width: 17,
          height: 17,
          boxShadow: '0 0 0 3px var(--surface-3)'
        }}
      >
        <Glyph status={entry.status} />
      </span>
      <div className={`text-sm leading-snug ${dim ? 'text-text-muted' : 'text-text-primary'}`}>
        {entry.text}
      </div>
      {entry.meta && (
        <div
          className={`mt-px font-mono ${dim ? 'text-feedback-error' : 'text-text-muted'}`}
          style={{ fontSize: 11 }}
        >
          {entry.meta}
        </div>
      )}
    </div>
  )
}
