// One step in an assistant turn's activity timeline, as plain Data. `status` drives the glyph LogRow
// renders (calling spinner, success check, failure cross, thinking dot, info dot); `text` is the step's
// label, `meta` an optional detail line (the tool result), and `toolName` lets a result re-label its
// call without re-parsing text. Shared by the live activity model and the settled-conversation
// projection so both feed the same timeline view.

type LogStatus = 'calling' | 'success' | 'failed' | 'thinking' | 'info'

interface LogEntry {
  readonly id: string
  readonly status: LogStatus
  readonly text: string
  readonly meta?: string
  readonly toolName?: string
}

export type { LogStatus, LogEntry }
