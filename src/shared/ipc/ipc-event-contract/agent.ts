// Event contract for AG-UI agent events. Once a run starts, main pushes each @ag-ui/core BaseEvent on
// agent:event; the renderer subscribes via window.api.on and feeds them to the AG-UI client.

import type { BaseEvent } from '@ag-ui/core'
import type { IpcEventContractDefinition } from './types'

const AGENT_EVENT_CHANNEL = 'agent:event'

type AgentEventContract = IpcEventContractDefinition<typeof AGENT_EVENT_CHANNEL, BaseEvent>

export { AGENT_EVENT_CHANNEL, type AgentEventContract }
