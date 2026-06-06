// The prompt fed to the Claude SDK query as a streaming-input async iterable: the AG-UI conversation
// mapped to SDK messages and yielded in order. Streaming input (rather than a plain string) is what
// enables interrupt support on the returned Query.

import type { Message } from '@ag-ui/core'
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import { toSdkPrompt } from '../logic/to-sdk-prompt'

export async function* streamInput(messages: readonly Message[]): AsyncGenerator<SDKUserMessage> {
  for (const message of toSdkPrompt(messages)) {
    yield message
  }
}
