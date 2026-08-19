// The prompt fed to the Claude SDK query as a streaming-input async iterable: the AG-UI conversation
// mapped to SDK messages and yielded in order. Streaming input (rather than a plain string) is what
// enables interrupt support on the returned Query. On a fresh run (no threadId to resume) the
// per-session context is folded into a single opening message yielded ahead of the conversation, led by
// the open workspace root so the model has the absolute path before its first turn; on a resume the
// session already received its context on turn one, so it is not re-injected.

import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import type { AgentContextEntry } from '../../../../application/agent/data/agent-context-entry'
import type { RunAgentInput } from '../../../../application/agent/data/run-agent-input'
import { contextToMessage } from '../logic/context-to-message'
import { toSdkPrompt } from '../logic/to-sdk-prompt'
import { workspaceContextEntry } from '../logic/workspace-context-entry'

const openingContext = (input: RunAgentInput): readonly AgentContextEntry[] => {
  if (input.threadId !== undefined) return []
  const workspace = workspaceContextEntry(input.cwd)
  const rest = input.context ?? []
  return workspace === undefined ? rest : [workspace, ...rest]
}

export async function* streamInput(input: RunAgentInput): AsyncGenerator<SDKUserMessage> {
  const contextMessage = contextToMessage(openingContext(input))
  if (contextMessage !== undefined) yield contextMessage
  for (const message of toSdkPrompt(input.messages)) {
    yield message
  }
}
