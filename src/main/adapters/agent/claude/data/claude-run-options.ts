// Data: the subset of the Claude Agent SDK Options this adapter actually sets for a run. It is a Pick of
// the SDK's Options, so it stays type-compatible with `query` while naming exactly which knobs we own:
// streaming partial messages, the built-in tool allow-list, the frontend MCP tools' permission allow-list,
// session resume, the per-run model/effort, and the custom system prompt.
// buildOptions produces this; the runner hands it straight to `query`.

import type { Options } from '@anthropic-ai/claude-agent-sdk'

export type ClaudeRunOptions = Pick<
  Options,
  | 'includePartialMessages'
  | 'tools'
  | 'allowedTools'
  | 'resume'
  | 'cwd'
  | 'model'
  | 'effort'
  | 'mcpServers'
  | 'hooks'
  | 'systemPrompt'
>
