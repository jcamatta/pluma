// Business type: one entry of the per-session context the renderer sends with a fresh run — the
// AG-UI `context[]` channel. `description` labels what the value is; `value` is the content itself
// (the CLAUDE.md-equivalent: what Pluma is and what the user is working on). The adapter folds these
// into the opening message of a fresh run. Plain data; no behavior.

interface AgentContextEntry {
  readonly description: string
  readonly value: string
}

export type { AgentContextEntry }
