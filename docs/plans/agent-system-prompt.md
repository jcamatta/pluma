# Agent system prompt & per-session context

Give the Claude agent adapter two things it lacks today:

1. a **system prompt** — the writing-assistant _identity_, set once per run; and
2. a **per-session context** — the "what is Pluma / what is the user working on" facts, loaded as
   the opening message of every fresh run (the CLAUDE.md-equivalent), carried over the AG-UI
   **`context[]`** channel — _not_ `state`.

Today the adapter sets no `systemPrompt`, so the SDK falls back to its _minimal default_ —
tool-calling only, no persona, no product context — and our `RunAgentInput` drops AG-UI's
`context` field entirely, so even if the renderer supplied context nothing would carry it.

Reference: https://code.claude.com/docs/en/agent-sdk/modifying-system-prompts
SDK installed: `@anthropic-ai/claude-agent-sdk` 0.3.172.

## Parallelization & collisions (read before starting)

This plan runs **in its own worktree** (`feature/agent-system-prompt`) and opens **its own PR**. It
is **backend-only** (`src/main`, plus one renderer mapper). Three plans are in flight at once —
this one, `thread-history.md`, and `04-chat-panel.md` (its B5/F5 remainder).

- **Start this plan FIRST.** It is the smallest and it shares files with `thread-history.md`;
  landing it first turns those overlaps into clean appends instead of merge conflicts.
- **`04-chat-panel.md` runs fully in parallel** — it lives in `src/renderer/src/rail/` + the editor,
  and touches **none** of this plan's files. No coordination needed with it.
- **`thread-history.md` (step 0) touches the same four files this plan does.** Those are the
  collision points — each is an _additive one-liner_ to a shared object/`Pick`/interface, so once
  this plan merges, thread-history just appends beside it:

  | Shared file                                                                                                                                                                      | This plan adds           | thread-history step 0 adds                  |
  | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------- |
  | [`build-options.ts`](../../src/main/adapters/agent/claude/logic/build-options.ts) — the returned options object **and** `BuildOptionsInput`                                      | `systemPrompt`           | `cwd`                                       |
  | [`claude-run-options.ts`](../../src/main/adapters/agent/claude/data/claude-run-options.ts) — the `Pick<Options, …>` line                                                         | `'systemPrompt'`         | `'cwd'`                                     |
  | [`run-agent-input.ts`](../../src/main/application/agent/data/run-agent-input.ts) **and** [`ipc-contract/agent.ts`](../../src/shared/ipc/ipc-contract/agent.ts)'s `RunAgentInput` | `context` field          | `cwd?` field                                |
  | [`to-run-input.ts`](../../src/renderer/src/agent/to-run-input.ts) — the returned object + its test                                                                               | thread `context` through | lift `forwardedProps.cwd` → top-level `cwd` |

- **Working-tree hazard:** [`to-sdk-prompt.ts`](../../src/main/adapters/agent/claude/logic/to-sdk-prompt.ts)
  (which step 3 edits) has the uncommitted multi-turn fix in the tree right now. Branch this worktree
  from a base where that fix is **already committed**, or carry it — do not branch off a dirty tree.

## The lifecycle distinction (why three different slots)

The slots differ by _when_ they're set and _whether they change over a conversation_. Putting each
fact in the slot whose lifecycle matches is the whole point:

| Slot                                            | Lifecycle                                                           | Holds                                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **system prompt** (SDK `systemPrompt` option)   | identical on every run, never mutates                               | the agent's **identity / persona / tone**                                                      |
| **`context[]`** (AG-UI `RunAgentInput.context`) | sent at run start, loaded as the first message; not mutated mid-run | the **CLAUDE.md-equivalent**: what Pluma is, conventions, and (later) what the user is editing |
| **`state`** (AG-UI `RunAgentState`)             | _mutates across the conversation_ (state deltas)                    | the **knobs**: `model`, `effort`. Already our use. **Not** a home for stable context           |
| **output style** (persistent file)              | user-selectable, persists across sessions                           | a later, separate feature — see "Out of scope"                                                 |

The user was right on the key point: `state` changes along the conversation, so the
loaded-once-at-the-start context (like CLAUDE.md) does **not** belong in `state`. AG-UI already has
the correct typed channel for it — `context`.

## Design decisions (settled)

- **Custom `systemPrompt` string, NOT the `claude_code` preset.** Per the docs' decision table, the
  preset is for "a coding agent in a repository with a human watching streaming output and steering
  the work." Pluma is the opposite on every axis: different surface (a chat panel for writers, not a
  terminal), different identity (a writing assistant, not Claude Code), non-coding task. So we own
  the full prompt as a custom string. Tool guidance stays light — the only tools offered are the
  renderer's frontend tools (`tools: []` for built-ins).

- **Use AG-UI's `context[]`, do not hand-roll a "prepend a system message" mechanism, and do not
  load the repo `.claude/CLAUDE.md`.** AG-UI's `RunAgentInput` carries
  `context: { description: string; value: string }[]` — a first-class channel for exactly this. The
  renderer fills it; it crosses IPC inside `RunAgentInput`; the adapter folds each entry into the
  opening prompt message. We use the framework's seam, not an invented one. The repo
  `.claude/CLAUDE.md` is the _developer_ contract (architecture, ESLint bans, commit budget) and is
  the wrong content for an end-user's writing assistant, so we never point the SDK at it
  (`settingSources` stays unset). The context _value_ is authored content about Pluma-the-product.

- **System prompt and context are both calculations.** The prompt string, and the function that
  folds `context[]` into the opening message, are pure builders in `logic/` — unit-testable with no
  SDK, no IPC. The adapter (action) just hands the result to `query`.

- **Context is loaded on a fresh run only, not on resume.** When `threadId` is present the session
  already received its context on turn one; re-injecting would duplicate it. The fold is gated on
  `threadId === undefined`.

## What "done" looks like

- Every run sent to `query` carries a custom `systemPrompt` stating the agent is Pluma's writing
  assistant (identity, surface, tone, scope).
- `RunAgentInput` carries AG-UI `context`, threaded from IPC through to the adapter, and a fresh
  run's prompt opens with that context folded into a `system`-role message ahead of the
  conversation history. Resume runs do not re-inject it.
- Both behaviors are pure calculations with direct unit tests (success + shape).
- `ClaudeRunOptions` includes `systemPrompt`; `build-options` populates it.
- `docs/FILE.md` updated for every new/edited `src/` file.
- Gate green: `npm run lint`, `npm run test`, `npm run type-coverage`, `npm run build`; plus
  `npm run test:e2e` (this touches agent-facing behavior). The chat-panel spec still drives a real
  run end-to-end — the change is transparent to the wire — so existing `@e2e` coverage holds; no new
  manifest id unless we expose new user-facing behavior.

## Out of scope (explicitly deferred)

- **Output styles.** A user-selectable persona variant (the SDK's output-style mechanism) is a
  separate feature with its own UI and persistence. Note it here so it isn't conflated with the
  system prompt: the system prompt is the _fixed_ identity; an output style would let the _user_
  pick a variant on top. Plan it separately when wanted. (YAGNI for now.)
- **Localization of the agent's replies** (reply in the user's EN/ES locale). Would add a `locale`
  to the run input/context. Decide in step 1; implement only if the human asks.
- **Dynamic context** (injecting the current manuscript's title/metadata into `context.value`).
  The `context[]` channel makes this a renderer-side change later with no adapter change. Out of
  scope now; the seam is what we're building.

## Open questions (resolve before/while implementing)

1. **Prompt + context copy.** Draft the identity text and the Pluma context value. Needs the
   human's voice for the product ("VS Code for writers"). Short, concrete, no coding-agent
   boilerplate. _Confirm copy with the human before finalizing._
2. **Who authors the context value, and where it lives.** Lean: a string constant in a dedicated
   `logic/` module (the renderer passes it into `context`), no file I/O. Revisit only if writers/
   translators must edit it without a rebuild.

## Steps

Each step is one small, independently committable unit; each ends with checks green and lands its
tests and `FILE.md` entry in the same commit.

### Step 1 — System prompt calculation + wire it into options ✅

Deliver the identity. No context yet.

- Add `logic/agent-system-prompt.ts` — a calculation exposing the custom system prompt string
  (Pluma writing-assistant identity, surface, tone, scope). Pure constant/string builder.
- Extend [`ClaudeRunOptions`](../../src/main/adapters/agent/claude/data/claude-run-options.ts) to
  include `'systemPrompt'` in the `Pick`.
- In [`build-options.ts`](../../src/main/adapters/agent/claude/logic/build-options.ts), set
  `systemPrompt` from the calculation (custom-string form).
- Tests: `__tests__/agent-system-prompt.test.ts` (asserts identity claims, non-empty, mentions
  Pluma/writing); extend `build-options.test.ts` to assert the option is set.
- `docs/FILE.md`: entries for new module(s).
- **Note when landed:** which file holds the prompt, what the identity says.

### Step 2 — Carry AG-UI `context` through the input + data type

Plumbing only — no prompt change yet, so it stays small.

- Add `context: readonly { description: string; value: string }[]` to
  [`RunAgentInput`](../../src/main/application/agent/data/run-agent-input.ts) (default to `[]` where
  consumed so existing callers/tests need no change). Consider a small `data/` type
  `AgentContextEntry` for the entry shape (one export per file).
- Thread it through the IPC endpoint that builds `RunAgentInput` from the AG-UI payload (it
  currently drops `context`), and through any `RunRequest`/use-case boundary so it reaches the
  adapter's `startRun`.
- Tests: cover the IPC/use-case mapping carrying `context` (and defaulting to `[]` when absent).
- `docs/FILE.md`: new/edited entries.
- **Note when landed:** the exact path `context` travels.

### Step 3 — Fold `context` into the opening prompt message (fresh runs only)

Deliver the loaded-at-start context.

- Add `logic/context-to-message.ts` — a calculation taking `context[]` and returning the
  `system`-role opening `SDKUserMessage` (each entry rendered as `description` + `value`), or
  nothing when `context` is empty.
- In the prompt-building path
  ([`to-sdk-prompt.ts`](../../src/main/adapters/agent/claude/logic/to-sdk-prompt.ts) /
  `stream-input.ts`), prepend that message **only when `threadId === undefined`**. Keep `toSdkPrompt`
  a pure mapping; inject one level up if that reads cleaner. Confirm the exact insertion point
  against `stream-input.ts` when implementing.
- Tests: `__tests__/context-to-message.test.ts` (shape/content, empty → none); extend the
  prompt-building test to assert the context message is first on a fresh run and absent on resume.
- `docs/FILE.md`: new/edited entries.
- **Note when landed.**

### Step 4 — Close out

- Re-run the full gate (`lint`, `test`, `type-coverage`, `build`) and `npm run test:e2e`; report
  green.
- Remove this plan file in its own `docs:` commit ("remove plan agent-system-prompt, complete").
- Open the PR via the `finish-plan` skill.

## Notes / handoff (fill in as steps land)

- **Step 1 landed.** The prompt lives in
  `src/main/adapters/agent/claude/logic/agent-system-prompt.ts` as the `AGENT_SYSTEM_PROMPT`
  constant (custom-string form, not the `claude_code` preset). The identity says: writing assistant
  inside Pluma ("editor for prose the way an IDE is an editor for code"), surface is the chat panel
  beside the editor, manuscript access only through the run's tools, warm/direct/concrete tone that
  respects the writer's voice, scope bounded to writing (explicitly not a coding assistant).
  `ClaudeRunOptions` now picks `systemPrompt` and `buildOptions` sets it on every run. Copy was
  drafted by the agent — flag for the human's voice pass in the PR (open question 1).
- **Localization of replies (open question in step 1's scope): not implemented.** No `locale` was
  added; deferred per "Out of scope" unless the human asks.
