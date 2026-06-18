# Plan: Agent workspace memory — `.pluma/memory` the agent writes and reads back

## What & why

Give the agent a small, file-based memory it owns — like the memory Claude Code keeps for itself — so it
can persist durable facts about the project and the user across runs and read them back later. Memory
lives per-workspace under `.pluma/memory/` (relative to the run's `cwd`, the open workspace folder).

This is distinct from human-authored project instructions (the separate, future
`docs/plans/project-ai-context-file.md` work): **instructions are written by the human and tell the agent
how to behave; memory is written by the agent and records what it has learned.** They surface through the
same opening-context channel but never share a file — memory is `.pluma/memory/*.md`, instructions are
their own thing. Memory is advisory recall, not policy.

The agent gets tools to **write**, **append**, **read**, and **list** memory files, plus the memory is
**loaded back into the opening context** of a fresh run so it is available without the agent having to ask.

## Design decisions (and why)

**Storage — `.pluma/memory/` under `cwd`, markdown files.** The run already carries `cwd` (the open
workspace folder; see `run-agent-input.ts` and how `list_folder`/the file tools resolve absolute paths
against it). Memory is a hidden, per-workspace `.pluma/memory/` directory holding `*.md` files. A new
`MemoryStore` port (read/list/write/append, scoped to a `cwd`) owns the directory, with an `fs`-backed
adapter — memory paths are workspace-relative names the store resolves under `cwd/.pluma/memory`, NOT
absolute paths the model supplies, so the agent can never write memory outside the sandbox. This is the
key difference from the file tools (which take absolute paths): memory tools take a bare _name_
(`facts.md`), and the store joins it under the fixed memory root after rejecting any name containing a
path separator or `..`.

**Tools — four, single-purpose (CQS), reliability-first.** Per the working agreement's preference for
split single-purpose tools with required fields over mode-switching optional params:

- `memory_read { name }` — read one memory file's full text (query).
- `memory_list {}` — list memory file names (query).
- `memory_write { name, content }` — replace a memory file's whole content, creating it (and the memory
  dir) if absent (command).
- `memory_append { name, text }` — append a block to a memory file, creating it if absent (command).

`memory_write` and `memory_append` are the mutating commands; `memory_read`/`memory_list` are queries.

**Writes are NOT gated.** The file tools (`create_file`/`rename_file`/`delete_file`) are gated because
they mutate the user's _manuscript tree_ destructively and irrecoverably. Memory writes only touch the
agent's own private `.pluma/memory/` scratch space — never a manuscript file, never anything the user is
editing — and the whole point of memory is unattended persistence across runs. Gating every memory write
behind an Approve/Reject card would make the feature unusable (a card per remembered fact) and contradicts
how Claude Code's own memory works. So memory commands run in-process like the read tools — no bridge, no
approval card, no renderer work, no allow-list-timing dance. (Open question Q1 records the alternative: a
single coarse "the agent can use memory" toggle, deferred.)

**Surfacing memory back into context — backend reads it at run start, folds it into the opening
context.** Today a fresh run's opening message is the renderer-sourced AG-UI `context[]` channel, folded
in by `streamInput`/`contextToMessage` (`src/main/adapters/agent/claude/runtime/stream-input.ts`,
`.../logic/context-to-message.ts`). Memory is _agent-authored and on disk_, so the renderer can't supply
it — the **backend** reads the memory directory at the start of a fresh run and prepends it as an
additional opening context block (alongside, not replacing, the renderer context). On a _resume_
(`threadId` present) the session already saw the opening context, so memory is not re-injected — same rule
`openingContext` already applies. The system prompt teaches that memory exists, that it is loaded at the
top of a fresh conversation, and how/when to write to it.

**No business logic in tools.** Tools are inbound adapters; they validate args and call the use cases
through the `MemoryStore` port, exactly as the file tools call the file use cases. The serialized
`AgentToolResult` boundary holds.

## Anchors (reuse these, don't reinvent)

- Backend tool shape + non-gated pattern: `src/main/adapters/agent/tools/backend/backend-tool.ts`,
  `read-file-tool.ts`, `list-folder-tool.ts` (a query tool that closes over `cwd`); the use-case→result
  fold `src/main/adapters/agent/tools/run-use-case-tool.ts`.
- Catalog + registration: `src/main/adapters/agent/tools/backend/index.ts` (`backendTools(deps)` — deps
  already carry `cwd`), `claude/runtime/build-backend-tool-server.ts` (sets `readOnlyHint` via
  `is-mutating-backend-tool.ts`), `claude/logic/build-options.ts` (`mcp__backend__*` allow-list is derived
  from the catalog automatically — new tools are allow-listed by being in the catalog, no extra step).
- `is-mutating-backend-tool.ts` — its `MUTATING_BACKEND_TOOL_NAMES` list decides `readOnlyHint`; add the
  two memory commands so they are NOT marked read-only.
- Use-case/port/adapter layout to mirror: `src/main/application/file/{usecase,port,error,logic}/`,
  adapter `src/main/adapters/file/fs-file-writer.ts` (typed-error mapping, `@effect/platform` FileSystem +
  Path, `Layer.effect`).
- Context surfacing: `src/main/adapters/agent/claude/runtime/stream-input.ts` (`openingContext` — fresh
  run only), `claude/logic/context-to-message.ts` (`AgentContextEntry[]` → opening `<context>` message),
  `src/main/application/agent/data/agent-context-entry.ts`, `run-agent-input.ts` (`cwd`).
- System prompt: `src/main/adapters/agent/claude/logic/agent-system-prompt.ts` (+ its test) — the
  paragraph after the file-tree tools is where memory teaching goes.

## Scope

- IN: `.pluma/memory/` per-workspace store; `memory_read`/`memory_list`/`memory_write`/`memory_append`
  backend tools (un-gated); backend-side loading of memory into a fresh run's opening context; system-prompt
  teaching; one real-app e2e.
- OUT (defer): a renderer memory viewer/editor UI; a user toggle to enable/disable memory (Q1); memory
  delete/rename tools (the agent overwrites via `memory_write`; deletion isn't needed for v1); per-thread
  (vs per-workspace) memory; subdirectories under `.pluma/memory`; size caps / truncation of large memory
  into context (Q2).

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[backend]` Memory port, errors, and name-validation logic.
   - `src/main/application/memory/error/`: tagged errors `InvalidMemoryName`, `MemoryNotFound`,
     `MemoryReadFailed`, `MemoryWriteFailed` (one file each, mirroring `application/file/error/*`).
   - `src/main/application/memory/logic/validate-memory-name.ts` (+ `__tests__`): a name is a trimmed,
     non-empty string ending `.md`, with NO path separator (`/`, `\`) and no `..` segment; returns the
     trimmed name or fails `InvalidMemoryName`. This is the sandbox guard — the model never supplies a
     directory.
   - `src/main/application/memory/port/memory-store.port.ts`: `MemoryStore` Context tag with
     `read(cwd, name) → Effect<string, MemoryNotFound | MemoryReadFailed>`,
     `list(cwd) → Effect<readonly string[], MemoryReadFailed>`,
     `write(cwd, name, content) → Effect<void, MemoryWriteFailed>`,
     `append(cwd, name, text) → Effect<void, MemoryWriteFailed>`.
   - Delivers: the contract the use cases and adapter depend on. Logic test lands here.

2. `[backend]` Memory use cases (queries + commands).
   - `src/main/application/memory/usecase/`: `read-memory.ts`, `list-memory.ts`, `write-memory.ts`,
     `append-memory.ts` — each validates the name (where applicable) via the step-1 logic, then delegates
     to the `MemoryStore` port. Thin, like `read-file.ts`/`write-file.ts`. `list-memory` takes only `cwd`.
   - `__tests__` for each against an in-memory fake `MemoryStore`: name validation rejects a path-bearing
     name without touching the store; happy paths delegate with the trimmed name.
   - Delivers: the four use cases, each green on the port.

3. `[backend]` `fs`-backed `MemoryStore` adapter.
   - `src/main/adapters/memory/fs-memory-store.ts`: `Layer.effect(MemoryStore, …)` over `@effect/platform`
     `FileSystem` + `Path`. Resolves the memory root as `path.join(cwd, '.pluma', 'memory')`; `write`/
     `append` `makeDirectory(root, { recursive: true })` first (so the dir is created on demand), then
     write/append the file; `read` maps a missing file → `MemoryNotFound`, other failures → `MemoryReadFailed`;
     `list` returns `[]` when the dir is absent, the `.md` entry names otherwise. Maps every fs failure to a
     typed error — nothing throws.
   - `__tests__/fs-memory-store.test.ts` against a real temp dir: write creates `.pluma/memory/x.md` and its
     parents; append concatenates; read after write round-trips; read of an absent name → `MemoryNotFound`;
     list reflects what was written and is `[]` for an empty/absent root; a name with a separator can't be
     reached (guarded upstream, but assert the adapter still joins only under root).
   - Delivers: real persistence. The wiring (Layer) is provided to the tools in step 4.

4. `[backend]` The four memory tools + catalog registration + readOnlyHint.
   - `src/main/adapters/agent/tools/backend/`: `memory-read-tool.ts`, `memory-list-tool.ts`,
     `memory-write-tool.ts`, `memory-append-tool.ts`. Each a `BackendTool` closing over the run's `cwd`
     (like `list-folder-tool.ts` — NOT gated, NOT taking a bridge). Specs are flat JSON Schema with
     top-level `required` (per the agent-tool wire-schema rule): `memory_read {name}`, `memory_list {}`,
     `memory_write {name, content}`, `memory_append {name, text}`. Each `run` arg-guards then calls
     `runUseCaseTool` with the matching use case provided `FsMemoryStoreLive` + `NodeContext.layer`.
   - Register all four in `backend/index.ts` `backendTools(...)` (they need `cwd`, already in deps).
   - Add `memory_write` and `memory_append` to `MUTATING_BACKEND_TOOL_NAMES` in
     `is-mutating-backend-tool.ts` so they get `readOnlyHint: false`; the two query tools stay read-only.
   - `__tests__` per tool: invalid args → `invalid_args` result; valid args delegate (use a temp-dir-backed
     store) and the result serializes (read returns text, list returns json, write/append return ok). Update
     `backend/__tests__/index.test.ts` for the new catalog membership.
   - Delivers: the agent can call memory tools in a live run (allow-list is catalog-derived, so this is the
     flip). Split into two commits if over budget: (4a) the two query tools + catalog/index test;
     (4b) the two command tools + `is-mutating-backend-tool` + its readOnlyHint test.

5. `[backend]` Load memory into a fresh run's opening context.
   - A small calculation `src/main/adapters/agent/claude/logic/memory-context-entry.ts` (+ `__tests__`):
     given the memory files' `{ name, content }`, build a single `AgentContextEntry` (description labels it
     "Memory the assistant has saved about this project, loaded automatically"; value renders each file as a
     `name` header then its content) — or `undefined` when there is no memory. Pure, no fs.
   - Wire it where the fresh-run opening context is assembled so it reads `MemoryStore.list` + `read` for the
     run's `cwd` and prepends the resulting entry to `input.context` for fresh runs only (mirror
     `openingContext`'s `threadId === undefined` rule). Reading memory is an Effect over the store; thread it
     through the run start (`claude-runtime-agent.ts`/`stream-input.ts` path) without re-injecting on resume.
   - `__tests__`: a fresh run with memory present prepends exactly one memory context entry built from the
     files; a resume injects none; no memory dir → no entry.
   - Delivers: memory surfaces back automatically. (If the wiring touches `stream-input.ts`, which is
     currently a pure async-generator, prefer reading memory in the run-start Effect in
     `claude-runtime-agent.ts` and passing the already-built entry into `streamInput` as extra context, so
     `stream-input.ts` stays pure — settle in Q3.)

6. `[backend]` System-prompt teaching.
   - `agent-system-prompt.ts` (+ its test): one new prose paragraph after the file-tree-tools paragraph —
     the agent has a private per-project memory; at the start of a fresh conversation its saved memory is
     loaded for it automatically; it can read it with `memory_read`/`memory_list` and save durable facts
     about the project or the user with `memory_write` (replaces) / `memory_append` (adds); memory is for
     durable recall, not a place to copy the manuscript; no approval is needed. Names are bare file names
     like `facts.md`, not paths. No emojis. Update the prompt test's expectations.
   - Delivers: the agent knows memory exists and how to use it.

7. `[e2e]` Manifest id + real-app spec.
   - Add `feature:agent-workspace-memory` to `e2e/coverage-manifest.ts` and a `*.e2e.ts` (pattern:
     `e2e/artifacts.e2e.ts`) that, with a folder open, drives the agent to save a fact to memory, then in a
     fresh run asks it to recall that fact and asserts the reply reflects what was saved (and/or asserts the
     `.pluma/memory/*.md` file exists on disk). Manifest id + spec land in the SAME commit.
   - Delivers: the round-trip (write → reload into context → recall) is proven against the real app.

8. `[docs]` Remove this plan file in its own `docs:` commit once all steps ship (performed by `finish-plan`).

## Constraints

- Hexagonal: tools are inbound adapters invoking use cases through the `MemoryStore` port; no business logic
  in tools or the adapter beyond fs→typed-error mapping. CQS: `memory_read`/`memory_list` are queries,
  `memory_write`/`memory_append` are commands.
- Sandbox: memory tools take a bare _name_, never an absolute path; the name is validated (no separators,
  no `..`, must end `.md`) and the store resolves it only under `cwd/.pluma/memory`. The agent can never
  read or write outside that directory.
- The `AgentToolResult` boundary holds; typed errors serialize as bare `_tag` strings; nothing throws
  across IPC. The allow-list is catalog-derived (`build-options.ts`) — no manual allow-list edit.
- Memory is loaded only on a _fresh_ run (no `threadId`), never re-injected on resume — same rule as the
  existing opening context.
- No new dependency. No `as` casts / `@ts-ignore` / `eslint-disable` / non-null `!` — fix the code or ask.
- The adapters layer may not import `src/shared` (lint-enforced) — memory needs no shared constant (it is
  not gated, so the renderer never has to agree on a memory-tool name), so nothing crosses that boundary.
- No user-facing strings ship in this plan (memory is un-gated, no card, no renderer UI), so no `en.json`/
  `es.json` change is required. If Q1 ("memory enabled" toggle / viewer) is ever pulled in, that step adds
  BOTH locales.
- Minimal diff / YAGNI; don't touch the file-tree tools or the manuscript-editing tools.

## Open questions

- **Q1 — gating / a user switch (open, deferred OUT):** v1 ships memory writes un-gated and always-on,
  matching Claude Code's own memory and keeping the feature usable. If the user wants control, the right
  shape is a single coarse "let the assistant keep memory for this project" toggle (not a per-write card),
  surfaced in settings — its own later plan. Confirm un-gated is acceptable for v1.
- **Q2 — large memory into context (open):** if memory grows large, folding all of it into every fresh
  run's opening context costs tokens. v1 loads it whole (simple, and the agent controls what it writes). A
  size cap / "most recent" truncation / on-demand `memory_read`-only model is a later refinement — confirm
  load-whole is fine for v1.
- **Q3 — where memory is read at run start (settle during step 5):** read memory in the run-start Effect
  in `claude-runtime-agent.ts` and pass the built `AgentContextEntry` into `streamInput` as extra context
  (keeps `stream-input.ts`/`context-to-message.ts` pure), vs. threading the `MemoryStore` Effect into
  `stream-input.ts`. Prefer the former (pure calc + one read at the impure edge); finalize when implementing.
- **Q4 — relationship to `project-ai-context-file.md` (open):** that plan doesn't exist in the tree yet.
  Memory is deliberately a _separate_ file set (`.pluma/memory/*.md`) and a _separate_ context entry from
  human instructions; if the instructions plan also writes under `.pluma/`, keep the two directories/files
  distinct (`.pluma/memory/` vs whatever instructions use) so neither overwrites the other. No code
  dependency between the plans.
