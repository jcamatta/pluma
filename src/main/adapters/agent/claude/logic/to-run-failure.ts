// Calculation: the anti-corruption mapping from the Claude SDK's assistant-message error codes to the
// application's run-failure vocabulary. This is the only place SDK error strings are known. Written as
// an explicit per-case record so naming another failure the UI should treat differently (billing_error,
// rate_limit) is a one-line addition rather than a rewrite.

import type { SDKAssistantMessageError } from '@anthropic-ai/claude-agent-sdk'
import type { RunFailure } from '../../../../application/agent/data/run-failure'

const BY_SDK_ERROR: Partial<Record<SDKAssistantMessageError, RunFailure>> = {
  authentication_failed: 'authentication'
}

export const toRunFailure = (error: SDKAssistantMessageError): RunFailure =>
  BY_SDK_ERROR[error] ?? 'generic'
