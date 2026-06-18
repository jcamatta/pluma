# Plan: create_folder — gated agent tool (the explorer affordance already ships)

## What & why

The writer can already create a folder from the explorer — the header and per-folder-row "New folder"
buttons (`FolderPlus`) wire through `onCreate('directory', …)` → `useCreateEntry` (its `type:
'directory'` branch) → `writer.createFolder` → the backend `createFolder` use case. The remaining gap is
on the **agent** side: the agent has gated `create_file` / `rename_file` / `delete_file` tools but **no
folder-create tool**. This plan exposes the existing `createFolder` use case as a fourth gated backend
command, `create_folder`, reusing the shipped approval round-trip (gated helper → tool bridge → rail
Approve/Reject card). No business logic lives in the tool; it invokes `createFolder` through the
`FolderWriter` port behind a human approval, exactly like `create_file` does for `createFile`.

This is a command (mutating → gated), per CQS — mirroring the gated-file-tools pattern in
`docs/plans/agent-file-tools.md`.

## Scope

- IN: `create_folder` as a gated backend command; its registration in the catalog/server, the mutating
  predicate, and the `build-options` allow-list; the shared gated-name constant; the renderer approval
  card's new `create-folder` shape + label; the system-prompt teaching; extending the existing
  `agent-filesystem-approval` e2e to cover the folder case.
- OUT (already shipped — do **not** touch): the explorer UI "New folder" affordance, `useCreateEntry`,
  the renderer/backend `createFolder` use case + `FolderWriter` port + `FsFolderWriterLive` adapter, the
  `folder:create` IPC channel. These exist and work; this plan only reads them.
- OUT (defer, not this plan): gated `rename_folder` / `delete_folder` agent tools; batching multiple ops
  under one approval; creating missing parent directories (the use case/adapter create only the final
  folder — keep that behavior).

## Anchors (reuse — don't reinvent)

- Shared gated names: `src/shared/agent/gated-tools.ts` — `CREATE_FILE_TOOL`/`RENAME_FILE_TOOL`/
  `DELETE_FILE_TOOL`, `GATED_TOOL_NAMES`, `isGatedToolName`, `GatedToolName`. Add `CREATE_FOLDER_TOOL`
  here and into `GATED_TOOL_NAMES`.
- Gated helper: `src/main/adapters/agent/tools/gated-use-case-tool.ts` — `gatedUseCaseTool({ bridge,
runId, toolName, args, effect, toOutput, fallback })`. Use as-is.
- Backend tool to mirror: `src/main/adapters/agent/tools/backend/create-file-tool.ts` (spec + `hasPath`
  guard + `gatedUseCaseTool` call). The new tool is the same shape with `createFolder` +
  `FsFolderWriterLive`.
- Use case + adapter: `src/main/application/folder/usecase/create-folder.ts` (`createFolder(path) →
Effect<string, FolderCreationError, FolderWriterPort>`); live layer `FsFolderWriterLive` in
  `src/main/adapters/folder/fs-folder-writer.ts`. `FolderCreationError` union (the `fallback` is moot for
  a successful fold; the typed `_tag`s are `FolderAlreadyExists` | `ParentDirectoryNotFound` |
  `FolderCreationFailed` | `InvalidFolderPath`).
- Catalog/registration: `src/main/adapters/agent/tools/backend/index.ts` (`backendTools`),
  `src/main/adapters/agent/tools/backend/is-mutating-backend-tool.ts`
  (`MUTATING_BACKEND_TOOL_NAMES` — adapter-local mirror, **cannot** import `src/shared`),
  `src/main/adapters/agent/claude/runtime/build-backend-tool-server.ts` (sets `readOnlyHint` via the
  predicate — gated tools must be non-read-only),
  `src/main/adapters/agent/claude/runtime/claude-runtime-agent.ts` (threads bridge + runId).
- Allow-list: `src/main/adapters/agent/claude/logic/build-options.ts` — namespaced names
  `mcp__backend__*` come from the backend tool specs, so adding the tool to `backendTools` auto-includes
  it; the `build-options` test asserts the allow-list, so update that assertion.
- System prompt: `src/main/adapters/agent/claude/logic/agent-system-prompt.ts` (the file-tree paragraph)
  - its test `__tests__/agent-system-prompt.test.ts`.
- Renderer card: `src/renderer/src/agent/approval-logic.ts` (`describeApproval` → `ApprovalPaths`),
  `src/renderer/src/rail/ApprovalCard.controller.tsx` (`actionLabel`),
  `src/renderer/src/rail/ApprovalCard.view.tsx` (`PathBlock` — a folder-create renders like a
  file-create: a single path). i18n: `src/renderer/src/i18n/locales/{en,es}.json` under
  `rail.approval`.
- e2e: `e2e/agent-filesystem-approval.e2e.ts` (existing spec + manifest id
  `feature:agent-filesystem-approval` already in `e2e/coverage-manifest.ts` — **reuse the id**, add a
  test case; do not add a new manifest id).

## Done

- The agent can call a gated `create_folder` tool: it suspends the run, the rail shows an Approve/Reject
  card naming the folder path; Approve creates the folder on disk (via `createFolder` +
  `FsFolderWriterLive`) and it appears in the explorer; Reject declines with the folder untouched.
- `create_folder` is taught in the system prompt as a destructive, approval-gated action with an absolute
  path taken from `list_folder`.
- The approval card renders the `create-folder` shape with a folder-specific action label, in `en` + `es`.
- `npm run lint`, `npm run test` (incl. e2e coverage audit), `npm run type-coverage`, `npm run build`
  green; `npm run test:e2e` green for the extended `agent-filesystem-approval` spec.

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[shared]` Add the gated-name constant.
   - `src/shared/agent/gated-tools.ts`: add `const CREATE_FOLDER_TOOL = 'create_folder'`, include it in
     `GATED_TOOL_NAMES`, export it. `GatedToolName` / `isGatedToolName` widen automatically.
   - If a test enumerates `GATED_TOOL_NAMES` (check `__tests__`), update it. Otherwise no test file is
     needed here (a one-line literal + export, under the 30-line rule).

2. `[backend]` The `create_folder` gated tool + registration + mutating predicate.
   - `src/main/adapters/agent/tools/backend/create-folder-tool.ts`: a `BackendTool` mirroring
     `create-file-tool.ts` — spec `create_folder { path }` (absolute, no `readOnlyHint`), `hasPath`
     guard, `gatedUseCaseTool({ … toolName: 'create_folder', effect: createFolder(args.path).pipe(
Effect.provide(FsFolderWriterLive), Effect.provide(NodeContext.layer)), toOutput: (validPath) => ({
type: 'text', text: validPath }), fallback: 'create_folder_failed' })`.
   - Register in `tools/backend/index.ts` (`backendTools` array, with the gated deps) and add
     `'create_folder'` to `MUTATING_BACKEND_TOOL_NAMES` in `is-mutating-backend-tool.ts` (so
     `readOnlyHint` is false and it gates).
   - Tests (mirror `__tests__/create-file-tool.test.ts`, against a real temp dir + fake bridge): approve
     → folder created on disk, ok; reject → `declined`, no folder; create over an existing folder →
     `FolderAlreadyExists`; missing `path` → `invalid_args`. Update `backend/__tests__/index.test.ts` and
     `runtime/__tests__/build-backend-tool-server.test.ts` if they assert the tool set / read-only hints.

3. `[backend]` Allow-list + system prompt.
   - `build-options.ts` needs no code change (the name flows from the backend tool spec), but update
     `claude/logic/__tests__/build-options.test.ts` to expect `mcp__backend__create_folder` in the
     allow-list.
   - `agent-system-prompt.ts`: extend the file-tree paragraph (currently teaches create/rename/delete
     **file**) to also teach `create_folder` — "makes a new empty folder at an absolute path" — keeping
     the existing "absolute paths from a `list_folder` result … takes effect only after the user
     approves … on reject it is declined, do not retry" framing. No emojis. Update
     `__tests__/agent-system-prompt.test.ts` if it asserts on tool-name mentions.

4. `[frontend]` Approval card: `create-folder` shape + label + locales.
   - `src/renderer/src/agent/approval-logic.ts`: add a `CreateFolderPaths` variant (`kind:
'create-folder'`, `path`) to `ApprovalPaths`, and a branch in `describeApproval` keyed on
     `CREATE_FOLDER_TOOL` with the `hasStringProp(args, 'path')` guard. Import `CREATE_FOLDER_TOOL` from
     the shared module.
   - `src/renderer/src/rail/ApprovalCard.controller.tsx` `actionLabel`: return
     `t('rail.approval.createFolder')` for `kind === 'create-folder'`.
   - `src/renderer/src/rail/ApprovalCard.view.tsx` `PathBlock`: render `create-folder` as a single path
     (extend the existing `create`/`delete` single-path branch).
   - i18n: add `rail.approval.createFolder` to **both** `en.json` ("Create folder") and `es.json` ("Crear
     carpeta").
   - Tests: extend `src/renderer/src/agent/__tests__/approval-logic.test.ts` (folder shape parsed; bad
     args → `unknown`) and `src/renderer/src/rail/__tests__/ApprovalCard.controller.test.tsx` (folder
     label resolved; path shown). Keep view/controller split; tokens-only; Base UI; Motion; `t()`.

5. `[e2e]` Extend the filesystem-approval spec to cover folder create.
   - `e2e/agent-filesystem-approval.e2e.ts`: add a test that asks the agent to call `create_folder` at an
     exact absolute path, asserts the approval card appears and names the folder, clicks Approve, and
     asserts the folder row appears in the explorer and exists on disk (mirror the existing create_file
     test; reuse `withTempFolder`, `stubFolderPicker`, `onDisk`, the 240s timeout).
   - Reuse the existing `feature:agent-filesystem-approval` manifest id — the `@e2e` tag already covers
     this feature; **do not** add a new manifest id (that would turn the audit red until a separate spec
     exists).

6. `[docs]` Remove this plan file in its own `docs:` commit once all steps ship (`finish-plan` does this).

## Constraints

- Hexagonal: the tool is an inbound adapter invoking `createFolder` through `FolderWriter`; no business
  logic in the tool. The bridge/approval is runtime infra. CQS: `create_folder` is a command (gated).
- The `AgentToolResult` boundary holds; typed errors serialize as bare `_tag` strings; nothing throws
  across IPC.
- `adapters/` may not import `src/shared` (lint-enforced) — that's exactly why
  `is-mutating-backend-tool.ts` keeps its own `MUTATING_BACKEND_TOOL_NAMES` mirror; add the literal
  there, do not import the shared constant into the adapter.
- No new dependency. No `as` casts / `@ts-ignore` / `eslint-disable` / non-null `!` — fix the code or ask.
- Frontend: tokens-only, Base UI, Motion, `t()` for every string, both locales, view/controller split.
- Minimal diff. Do **not** modify the explorer UI or the create-folder use case/adapter/IPC — they
  already ship the writer-facing affordance and the use case this tool reuses.
- Keep `createFolder`'s existing semantics: creates only the final folder (never missing parents),
  `FolderAlreadyExists` on an occupied target.

## Open questions

1. **Action label wording** — the file approvals use "Create file" / "Rename file" / "Delete file". The
   plan assumes "Create folder" / "Crear carpeta" to match. Confirm the writer-facing wording (the
   explorer uses "New folder"; "Create folder" is proposed for the agent card for parity with "Create
   file"). open
2. **Tool description / system-prompt phrasing** — proposed: "makes a new empty folder at an absolute
   path." Confirm whether the agent should also be told the folder's parent must already exist (the
   adapter does not create missing parents and surfaces `ParentDirectoryNotFound`). Leaning yes, since
   it affects how the agent picks the path. open
3. **Out-of-scope confirmation** — this plan deliberately excludes gated `rename_folder` /
   `delete_folder` agent tools even though those use cases exist; only `create_folder` was requested.
   Confirm that's the intended scope. open
