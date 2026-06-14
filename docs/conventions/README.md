# Conventions — where the rules live

Pluma's "how we code" rules deliberately do **not** live in a standalone doc that an agent has to
remember to read. They live where they are reliably loaded into the agent that needs them, so a
backend task carries backend rules and a frontend task carries frontend rules — and nothing else.

| You want…                                                                                                                                                                                                   | Read…                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Backend conventions — hexagonal layers, CQS, the IPC `Result` boundary, tagged errors, repositories, Effect, Data/Calculations/Actions, code style & size limits, backend testing                           | [`.claude/agents/backend-engineer.md`](../../.claude/agents/backend-engineer.md)                     |
| Frontend + e2e conventions — view/controller/plain split, query/command hooks, renderer ports/adapters, design tokens, Base UI, Motion, i18n, frontend testing, drive-the-real-app e2e + the coverage audit | [`.claude/agents/frontend-engineer.md`](../../.claude/agents/frontend-engineer.md)                   |
| Global non-negotiables, the workflow/router, commit & branch grammar, the enforcement gate                                                                                                                  | [`.claude/CLAUDE.md`](../../.claude/CLAUDE.md)                                                       |
| The mechanically-judged subset (what the reviewer rejects)                                                                                                                                                  | [`.veto/backend.yaml`](../../.veto/backend.yaml), [`.veto/frontend.yaml`](../../.veto/frontend.yaml) |

**Why this layout.** A Claude Code subagent runs in its own context and does not reliably auto-load
`CLAUDE.md`, `docs/`, or `@import` references — its own body (the system prompt) is the only place
rules are guaranteed to reach it. So the worker bodies _are_ the canonical convention prose, and this
file is just the index. Each rule has one canonical home; veto holds the enforced subset and the
worker bodies echo the global non-negotiables (kept in sync by the workflow's audit). Don't restate a
rule in a second place — point to its home instead.
