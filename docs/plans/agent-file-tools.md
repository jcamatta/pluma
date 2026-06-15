# Plan: Gated file-tree write tools — create_file / rename_file / delete_file

## What & why

The agent can READ the workspace (`read_file`, `list_folder` — shipped in PR #54) but cannot change the
file tree. Expose the existing `create-file` / `rename-file` / `delete-file` use cases as agent COMMANDS,
each gated by an explicit human Approve/Reject in the rail before it runs. Reads were queries (no gate);
these are commands (gated) — CQS. No business logic lives in the tools; they invoke the existing use cases
through their ports.

## Stacked PRs (this is built as two stacked PRs)

- **PR1 — backend** branch `feat/agent-file-tools` off latest `origin/main`. Steps 1, 2, 4 below: the
  shared constant + gated helper, the three gated backend tools + their catalog/server registration, and
  the system-prompt teaching. Unit-tested with a FAKE bridge (approve runs the use case; reject does not).
  PR1 does NOT add the tools to the `build-options` allow-list — so a live run can never hang on an
  unanswered approval before the card exists.
- **PR2 — frontend + e2e** branch `feat/agent-file-tools-ui` branched ON TOP OF `feat/agent-file-tools`,
  so PR2 contains the whole stack and the end-to-end flow runs. Steps 3, 5 below: the approvals store +
  `useToolBridge` gated branch + rail approval card, the `build-options` allow-list flip (now that the card
  exists), the e2e spec + coverage-manifest id. PR2's worktree is the live-test surface.

## Design: backend gated tools that reuse the EXISTING tool round-trip for the approval question

Mirror the shipped read-tool structure (the file tools are BACKEND tools), but gate each one with a human
round-trip that reuses the existing `agent:tool-call` / `agent:tool-result` bridge — no new IPC channel:

- A gated backend tool's `run()` calls the existing tool bridge with an approval "question" (tool name +
  a human-readable summary of the action + the path(s)); this SUSPENDS the tool call.
- The renderer, on seeing a tool call whose name is in a known GATED set, renders a confirmation card
  (Approve / Reject) instead of dispatching to a frontend-tool handler, and answers with an `AgentToolResult`:
  `{ ok: true }` = approved, `{ ok: false, error: 'declined' }` = rejected.
- On approve, the backend tool runs the real use case in-process (business logic stays in the backend) and
  returns its serialized result; on reject it returns the declined result to the agent. On run abort the
  bridge's `rejectAll` settles any pending approval as declined.
- Net new plumbing: a GATED-tool helper in the backend, threading the existing bridge into the backend tool
  layer, a small shared constant of gated tool names, the renderer card + approvals store, the prompt, e2e.
  No new channel, no `submit-approval` (reuse `submit-tool-result`), no new wire type beyond the gated-name
  constant.

## Anchors (post PR 2.1 — reuse these, don't reinvent)

- Backend tool shape: `src/main/adapters/agent/tools/backend/backend-tool.ts` — `BackendTool = { spec, run:
(args) => Effect<AgentToolResult> }`. Result contract: `AgentToolResult = { ok: true; output } | { ok:
false; error: string }` (error is a bare `_tag` string).
- Use-case→result helper: `src/main/adapters/agent/tools/run-use-case-tool.ts` — `runUseCaseTool({ effect,
toOutput, fallback })` folds a use-case Effect into an `AgentToolResult`. The gated helper wraps this.
- Catalog + server: `tools/backend/index.ts` (`backendTools(cwd)`), `claude/runtime/build-backend-tool-
server.ts` (read tools set `readOnlyHint: true` — GATED tools must NOT), `claude/runtime/to-call-tool-
result.ts`, `claude/runtime/claude-runtime-agent.ts` (`startRun` builds the bridge + both servers — thread
  the bridge into the backend gated tools here), `claude/logic/build-options.ts` (`mcp__backend__*`
  allow-list — add the three names in PR2 only).
- Bridge: `src/main/adapters/agent/tools/tool-bridge.ts` — `createToolBridge(send)` →
  `{ callTool({ runId, toolCallId, toolName, args }): Promise<AgentToolResult>, resolve(toolCallId, result),
rejectAll(reason) }`. The gated tool awaits `callTool` for its approval.
- Result resolution path (already wired): `src/main/ipc/agent/submit-tool-result-handler.ts` →
  `application/agent/usecase/submit-tool-result.ts` → `bridge.resolve`. Renderer side:
  `src/renderer/src/agent/useToolBridge.ts` (subscribes `agent:tool-call`, dispatches to the registry,
  replies on `agent:tool-result`). The gated-tool card hooks in HERE.
- Wire contract: `src/shared/ipc/ipc-event-contract/agent.ts` (`AgentToolCall = { runId, toolCallId,
toolName, args }`), `src/shared/ipc/ipc-contract/agent.ts` (`AgentToolResultMessage`, `AgentToolResult`).
  Add only a shared `GATED_TOOL_NAMES` constant.
- Use cases to expose (all `src/main/application/file/usecase/`), live adapter `FsFileWriterLive`:
  - `create-file.ts` `createFile(path) → Effect<string, InvalidPath|FileAlreadyExists|DirectoryNotFound|
FileWriteFailed, FileWriterPort>`
  - `rename-file.ts` `renameFile(oldPath, newPath) → Effect<string, InvalidPath|FileNotFound|
FileAlreadyExists|FileRenameFailed, FileWriterPort>`
  - `delete-file.ts` `deleteFile(path) → Effect<string, InvalidPath|FileNotFound|FileDeleteFailed,
FileWriterPort>`
- Renderer rail (where the card mounts): `src/renderer/src/rail/ConversationRail.controller.tsx`,
  `Activity.view.tsx`, `LogRow.view.tsx`, `conversation-rows.ts` (tool-step projection).

## Scope

- IN: `create_file`, `rename_file`, `delete_file` as gated backend commands; the approval card + approvals
  store; the gated-tool helper; system-prompt teaching; one real-app e2e.
- OUT (not this PR): `write_file` (whole-file CONTENT write — belongs with the editor proposal/insert path);
  `move_file` (only `rename` exists — defer); folder create/rename/delete (defer); batching several ops under
  one approval (v1 is one approval per tool call).

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[shared]` Gated-tool name constant + the gated helper. **(PR1)**
   - `src/shared/...`: add `GATED_TOOL_NAMES = ['create_file','rename_file','delete_file'] as const`.
   - `src/main/adapters/agent/tools/`: a `gatedUseCaseTool({ bridge, runId, toolName, summary, effect,
toOutput, fallback })` helper — emits the approval via `bridge.callTool`, and on approve delegates to
     `runUseCaseTool`; on `{ ok: false }` returns `{ ok: false, error: 'declined' }`. + test (approve runs
     the effect; reject returns declined; never runs the effect on reject).

2. `[backend]` The three gated tools + registration. **(PR1 — registration in catalog/server only, NOT the
   allow-list)**
   - `tools/backend/{create-file,rename-file,delete-file}-tool.ts`: each a `BackendTool` whose `spec` mirrors
     its use-case input (`create_file {path}`, `rename_file {oldPath,newPath}`, `delete_file {path}`) and
     whose `run` calls `gatedUseCaseTool(...)` with the use case + `FsFileWriterLive`. NO `readOnlyHint`.
   - Register them in the backend catalog/server; thread the run's bridge + runId into them in
     `claude-runtime-agent.ts`. Do NOT add to the `build-options` allow-list yet (PR2).
   - Tests against a real temp dir: approve → file created/renamed/deleted; reject → declined, NO fs effect;
     each typed error surfaces as its `_tag`.

3. `[frontend]` Approval store + rail confirmation card. **(PR2)**
   - A renderer approvals store/context: when `useToolBridge` receives a tool call whose name ∈
     `GATED_TOOL_NAMES`, register a pending approval (don't dispatch to the tool registry) and await the
     user; reply `{ ok: true }` / `{ ok: false, error: 'declined' }` on the existing `agent:tool-result`.
   - A confirmation card (view/controller) in the rail rendering each pending approval (action + path(s))
     with Approve / Reject. Design tokens, Base UI, Motion, `t()`, BOTH `en.json` + `es.json`,
     view/controller split. Tests (approve resolves ok; reject resolves declined; card shows the path).
   - Flip `build-options` allow-list to expose the three `mcp__backend__*` gated tools (the card now exists).

4. `[backend]` System prompt. ⚠️ SHARED FILE with `feat/agent-insert` — rebase-aware. **(PR1)**
   - `agent-system-prompt.ts`: teach `create_file` / `rename_file` / `delete_file`, that paths are absolute
     (from `list_folder`), and that each REQUIRES the user's approval before it takes effect. No emojis.
     Update its test.

5. `[e2e]` Manifest id + real-app spec. **(PR2)**
   - Add `feature:agent-filesystem-approval` to `e2e/coverage-manifest.ts` and a `*.e2e.ts` (pattern:
     `e2e/artifacts.e2e.ts`) that drives the agent to create a file, asserts the approval card appears, clicks
     Approve, and asserts the file appears in the explorer. Manifest id + spec in the SAME commit.

6. `[docs]` Remove the plan file in its own `docs:` commit when all steps ship (end of PR2).

## Constraints

- Hexagonal: tools are inbound adapters invoking use cases through ports; no business logic in tools. The
  bridge/approval is runtime infra. CQS: these are commands (gated).
- The `AgentToolResult` boundary holds; errors serialize as bare `_tag` strings; nothing throws across IPC.
- No new dependency. No `as` casts / `@ts-ignore` / `eslint-disable` / non-null `!` — fix the code or ask.
- Frontend: tokens-only, Base UI, Motion, `t()` for every string, both locales, view/controller split,
  `Scrollable` for overflow.
- Minimal diff. Don't touch `feat/agent-insert`'s files (the renderer tool specs, proposals, editor).
