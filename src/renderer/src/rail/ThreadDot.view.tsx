// The status glyph for a turn, ported from the design's ThreadDot. A pulsing accent dot while the run
// works, a success check when it lands, a destructive cross when it errors. Pure props, our tokens.

import { Check, X } from 'lucide-react'
import type { RunStatus } from './activity-log'

export function ThreadDot({ status }: { readonly status: RunStatus }): React.JSX.Element {
  if (status === 'working') {
    return (
      <span
        className="agent-status-dot flex-none rounded-full bg-action-primary"
        style={{ width: 9, height: 9 }}
      />
    )
  }
  if (status === 'error') {
    return (
      <span className="flex flex-none text-feedback-error">
        <X size={13} />
      </span>
    )
  }
  return (
    <span className="flex flex-none text-feedback-success">
      <Check size={13} />
    </span>
  )
}
