// The run failure carried across AG-UI's onRunFailed hop. That callback hands over a plain Error (and
// onEvent never fires for RUN_ERROR), so the typed failure code would be lost between the event and the
// rail unless the Error itself carries it. @ag-ui/client's run pipe ends in
// catchError(e => this.onError(...)) and passes the same object into onRunFailed({ error }) without
// rewrapping, so an instanceof check survives the trip. Renderer-local: not a wire shape.

import type { AgentRunFailure } from '../../../shared/ipc/ipc-event-contract/agent-run-failure'

class AgentRunError extends Error {
  readonly failure: AgentRunFailure

  constructor(message: string, failure: AgentRunFailure) {
    super(message)
    this.name = 'AgentRunError'
    this.failure = failure
  }
}

export { AgentRunError }
