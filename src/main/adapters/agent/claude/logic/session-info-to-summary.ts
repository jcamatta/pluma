// Calculation: map one SDK session row to a ThreadSummary. The id and last-modified time pass through;
// the title prefers the user's stored name (set via renameSession) and falls back to the title derived
// from the session's first prompt, so a renamed thread shows its chosen name. The one place SDK
// `*Session*` shapes are turned into the domain ThreadSummary. Pure, so it is trivially testable.

import type { SDKSessionInfo } from '@anthropic-ai/claude-agent-sdk'
import type { ThreadSummary } from '../../../../application/agent/data/thread-summary'
import { deriveThreadTitle } from '../../../../application/agent/logic/derive-thread-title'

export const sessionInfoToSummary = (info: SDKSessionInfo): ThreadSummary => {
  const stored = info.customTitle?.trim() ?? ''
  const title = stored.length > 0 ? stored : deriveThreadTitle(info.firstPrompt ?? '')
  return { id: info.sessionId, title, updatedAt: info.lastModified }
}
