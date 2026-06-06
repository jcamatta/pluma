// Business type: the output of a started agent run. `runId` identifies the run (used to abort it);
// `events` is the live Stream of AG-UI events (@ag-ui/core BaseEvent) the run produces. Returned by the
// runAgent use case; the IPC endpoint forwards each event to the renderer and keeps the runId for aborts.

import type { BaseEvent } from '@ag-ui/core'
import type * as Stream from 'effect/Stream'

export interface RunAgentOutput {
  readonly runId: string
  readonly events: Stream.Stream<BaseEvent>
}
