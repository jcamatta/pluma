// Builds the real Agent bound to window.api. Lives under adapters/ so it may touch window.api (the
// lint allows IPC here). The tools supplier lets the provider feed the live registry snapshot, so a
// bare agent.runAgent() carries the currently registered frontend tools.

import type { Tool } from '@ag-ui/core'
import { Agent } from './Agent'

export function createApiAgent(tools: () => readonly Tool[]): Agent {
  return new Agent(window.api, tools)
}
