# Plan: Undo/redo for agent file operations

## What & why

The agent can already create / rename / delete files under a human approval gate
([create-file-tool.ts](../../src/main/adapters/agent/tools/backend/create-file-tool.ts),
[rename-file-tool.ts](../../src/main/adapters/agent/tools/backend/rename-file-tool.ts),
[delete-file-tool.ts](../../src/main/adapters/agent/tools/backend/delete-file-tool.ts)), and it can
write whole-file content via the `write-file` use case. But once a gated command runs it is
irreversible: an approved-by-mistake delete is gone, a bad rename has to be hand-corrected. This plan
makes **agent file operations a reviewable, reversible command history**: every gated filesystem
command the agent runs is recorded as an _operation_ with enough captured state to reverse it, the
Review tab lists those operations newest-first, and each carries an **Undo** (and after undo, **Redo**)
control that replays the inverse (or the original) command through the same use cases.

The operation log is **per workspace, in-memory for v1** (does not survive app restart), and records
only operations Pluma itself performed (the gated agent commands). It is an _operation_ history, not a
filesystem-state history — see Open questions for why out-of-app edits can invalidate an entry and how
v1 degrades safely (an undo whose precondition no longer holds fails with a typed error and is surfaced,
never silently corrupts the tree).

## Scope

- **IN (v1):** record + undo/redo of the three already-gated commands — `create_file`, `rename_file`,
  `delete_file` — plus content writes performed through `write_file` **once that tool is gated**
  (`write_file` is currently a use case with no agent tool; this plan gates it like the others so its
  writes are recorded too). The Review tab gains an "Operations" history list with per-operation
  Undo / Redo. Inverses run through the existing file use cases.
- **OUT (deferred — Open questions):** durable/persisted log across restarts; folder create/rename/delete
  (only file ops exist today); reconciling out-of-app edits (a watcher-driven invalidation); undo of the
  in-editor proposal/annotation artifacts (those already have accept/reject and a different model — this
  plan does not touch [proposals.ts](../../src/renderer/src/editor/extensions/proposals.ts)); a global
  Ctrl+Z binding for agent ops (the history list's buttons are the v1 surface); batching several ops under
  one undo; multi-step redo stacks beyond the linear per-operation toggle.

## Architecture decision (this plan is partly an ADR — Step 0 is a spike)

The core question is **build vs buy** for the reversible log. Three candidates, to be decided in the
spike before any code:

- **A — custom in-process operation log (the leaning).** Record each gated command as a domain
  `Operation` carrying its inverse parameters; an `OperationLog` repository port holds them; undo/redo
  invoke the _existing_ file use cases (`createFile`/`deleteFile`/`renameFile`/`writeFile`) with the
  inverse args. Fits the hexagonal/CQS shape already in place, reuses the use cases verbatim, no new
  dep. Cost: we own correctness of each inverse and the deleted-content capture.
- **B — git-backed.** Snapshot/commit the workspace and revert. Powerful (handles out-of-app edits,
  durable, content restoration is free) but: assumes the workspace is a git repo, brings a heavy
  mental + dependency model, and couples a writing app's "undo what the AI did" to VCS semantics the
  writer may not want. Likely too much for v1; revisit if durable cross-session history is demanded.
- **C — reuse the editor's undo machinery (ProseMirror history).** Only covers _content within an open
  editor_, not filesystem create/rename/delete and not closed files — wrong granularity for file-tree
  ops. Rejected for the file-op history; the editor keeps its own content undo independently.

The spike (Step 0) records the decision in this file and, if not A, re-slices the steps below.

## Anchors (reuse these, don't reinvent)

- **Gated tool round-trip:** `gatedUseCaseTool` ([gated-use-case-tool.ts](../../src/main/adapters/agent/tools/gated-use-case-tool.ts))
  — on approve it runs the use-case Effect via `runUseCaseTool`. **This is the single chokepoint where a
  command is known-approved and about-to-run** — recording an operation hangs off here (Step 3), so all
  three tools (and the new gated `write_file`) get history for free.
- **The use cases the inverses call:** all in [application/file/usecase/](../../src/main/application/file/usecase/)
  — `createFile(path)`, `deleteFile(path)`, `renameFile(old,new)`, `writeFile(path,content)`. Inverses:
  create⁻¹ = delete, delete⁻¹ = create-then-write-captured-content, rename(a→b)⁻¹ = rename(b→a),
  write(path,new)⁻¹ = write(path,captured-old). The deleted/overwritten content **must be captured before
  the command runs** (the file is gone/changed after) — see Step 2 + Open questions.
- **Reading current content for capture:** `readFile` use case ([read-file.ts](../../src/main/application/file/usecase/read-file.ts))
  - `FsFileReaderLive` ([fs-file-reader.ts](../../src/main/adapters/file/fs-file-reader.ts)).
- **FileWriter port/adapter:** [file-writer.port.ts](../../src/main/application/file/port/file-writer.port.ts),
  [fs-file-writer.ts](../../src/main/adapters/file/fs-file-writer.ts) (note `createEmptyFile` writes `''`,
  then `writeFile` sets content — delete⁻¹ is create-then-write).
- **Run wiring that owns the bridge/runId and builds the backend tools:**
  [claude-runtime-agent.ts](../../src/main/adapters/agent/claude/runtime/claude-runtime-agent.ts) (`startRun`),
  [tools/backend/index.ts](../../src/main/adapters/agent/tools/backend/index.ts) (`backendTools(deps)`),
  [build-options.ts](../../src/main/adapters/agent/claude/logic/build-options.ts) (the `mcp__backend__*`
  allow-list — add `write_file` there when it is gated).
- **Shared wire layer:** [src/shared/ipc/ipc-contract/](../../src/shared/ipc/ipc-contract/) (Result-shaped
  query/command DTOs), [src/shared/agent/gated-tools.ts](../../src/shared/agent/gated-tools.ts) (the
  gated-name constant — `write_file` is added here so the renderer parks its approval card too).
- **Renderer Review tab + cards:** [ConversationRail.view.tsx](../../src/renderer/src/rail/ConversationRail.view.tsx)
  (the `review` slot + count badge), [useReviewTab.ts](../../src/renderer/src/rail/useReviewTab.ts) /
  [useReviewTab.test.tsx](../../src/renderer/src/rail/__tests__/useReviewTab.test.tsx),
  [ArtifactsPanel.controller.tsx](../../src/renderer/src/artifacts/ArtifactsPanel.controller.tsx) +
  [ProposalCard.view.tsx](../../src/renderer/src/artifacts/ProposalCard.view.tsx) /
  [AnnotationCard.view.tsx](../../src/renderer/src/artifacts/AnnotationCard.view.tsx) as the card
  view/controller pattern to mirror. **The Review tab currently shows in-editor artifacts; the operations
  history is a second section/source there — confirm placement in Open questions.**
- **Renderer port/adapter + query/command hook pattern:** [explorer/](../../src/renderer/src/explorer/)
  (`ports/`, `adapters/*.ipc.ts`, `*-query-keys.ts`, `use*` hooks, in-memory fake under `__tests__/`).
- **i18n:** [en.json](../../src/renderer/src/i18n/locales/en.json) + [es.json](../../src/renderer/src/i18n/locales/es.json)
  (existing `rail.approval.*` keys are the sibling namespace; add `rail.operations.*`).
- **Explorer refresh after a file op** (so an undo's tree change shows): the explorer's folder query keys /
  refresh path ([folder-query-keys.ts](../../src/renderer/src/explorer/folder-query-keys.ts),
  [useExplorerTree.ts](../../src/renderer/src/explorer/useExplorerTree.ts)) — confirm the existing
  invalidation already fires on backend file ops, else the undo's effect won't appear until reopen.

## Done

- After the agent creates/renames/deletes a file or writes content (each through its approval gate), an
  **Operations** entry appears in the Review tab describing the action and its path(s).
- Clicking **Undo** on an entry reverses it on disk (delete restores the file _with its prior content_;
  create removes the file; rename swaps back; write restores prior content), the explorer reflects it, and
  the entry flips to show **Redo**; **Redo** re-applies the original command. The toggle is per-operation.
- An undo whose precondition no longer holds (target was changed/removed outside Pluma since) **fails with
  a typed, surfaced error** and changes nothing — never a partial/corrupting write.
- `npm run lint`, `npm run test` (incl. the e2e coverage audit), `npm run type-coverage`, `npm run build`
  green; for the UI, `npm run test:e2e` green with the new manifest id + spec.

## Steps

> Each step is one small, independently-green mini-commit (≤~300 weighted `src/` lines, ≤15 files, code
>
> > 30 lines lands a test). Order is dependency order. Step 0 is a no-code spike that may re-slice the rest.

0. `[shared]` **ADR spike — pick the log model (no production code).**
   Decide A (custom operation log) vs B (git) vs C (editor history) using the candidates above; validate
   the deleted-content-capture approach (read-before-delete) and that undo/redo reuse the existing file
   use cases. Record the decision + the captured-state shape per op-kind in this file. If not A, re-slice
   Steps 1–7. Output: decision recorded; the `Operation` data shape fixed. **Blocks Steps 1+.**

1. `[shared]` **`Operation` domain data + log port + typed errors (backend application layer).**
   - `src/main/application/operation/data/operation.ts`: a discriminated `Operation` record (no behavior)
     — `{ id, kind: 'create'|'rename'|'delete'|'write', status: 'done'|'undone', ...captured fields }`,
     where captured fields per kind carry exactly what the inverse needs (delete/write carry the prior
     `content`; rename carries `oldPath`+`newPath`; create carries `path`). Plus a `record-operation`
     input shape.
   - `src/main/application/operation/port/operation-log.port.ts`: an `OperationLogPort` repository
     (`append`, `all`, `getById`, `setStatus`) — collection-like, store-agnostic (per backend
     conventions; no SQL leaking).
   - `src/main/application/operation/error/`: typed `Data.TaggedError`s for undo/redo preconditions
     (`OperationNotFound`, `OperationAlreadyInState`, and reuse the existing file errors for the replayed
     use case). Tags recorded in the contract.
   - Pure-data + port interface only — small, no tests needed beyond type-coverage; if any logic creeps in
     (e.g. an `invert(operation)` calculation) it lands with a unit test.

2. `[backend]` **Pre-command content capture + the in-memory log adapter.**
   - `src/main/adapters/operation/in-memory-operation-log.ts`: `OperationLogPort` backed by a `Ref`-held
     immutable list (mirror the no-global-mutable-state pattern in
     [claude-runtime-agent.ts](../../src/main/adapters/agent/claude/runtime/claude-runtime-agent.ts)).
     Per-workspace scoping decided in Open questions.
   - A pure `capture-for` calculation: given an op-kind + path(s), the read it needs _before_ the command
     runs (delete/write read current content via `readFile`; create/rename read nothing). Keep the read
     itself an action at the edge; the _what-to-read_ decision is the pure part.
   - Tests: append/all/getById/setStatus round-trip on the in-memory log; capture-for returns the right
     read plan per kind. (Adapter test exercises the Ref-backed store directly.)

3. `[backend]` **Record an operation at the approve-and-run chokepoint.**
   - Extend `gatedUseCaseTool` ([gated-use-case-tool.ts](../../src/main/adapters/agent/tools/gated-use-case-tool.ts))
     (or a thin wrapper beside it) so that, on approve, it (a) captures pre-state per Step 2, (b) runs the
     use case, and (c) on success `append`s the `Operation` to the log. Thread the `OperationLogPort` +
     a `readFile` capability into the gated tools via `backendTools(deps)` /
     [index.ts](../../src/main/adapters/agent/tools/backend/index.ts) and the run wiring in
     [claude-runtime-agent.ts](../../src/main/adapters/agent/claude/runtime/claude-runtime-agent.ts).
   - **Capture ordering invariant:** for `delete`/`write` the content read happens _before_ the use case,
     or the prior content is unrecoverable. A capture failure aborts recording but must not break the
     command's own result to the agent (record best-effort, surface a non-fatal "not undoable" marker —
     confirm in Open questions).
   - Tests (real temp dir, fake bridge approving): approve a delete → file gone _and_ an `Operation` with
     the prior content is logged; approve a create → op logged, no content; reject → no op logged, no fs
     effect (existing behavior preserved).

4. `[backend]` **Gate `write_file` as an agent tool (so content writes are recorded too).**
   - `src/main/adapters/agent/tools/backend/write-file-tool.ts`: a `BackendTool` mirroring the others
     (`spec` = `write_file {path, content}`, no `readOnlyHint`), `run` → `gatedUseCaseTool` over the
     `writeFile` use case + `FsFileWriterLive`. Register in
     [index.ts](../../src/main/adapters/agent/tools/backend/index.ts); add `write_file` to the
     `mcp__backend__*` allow-list in [build-options.ts](../../src/main/adapters/agent/claude/logic/build-options.ts)
     and to `GATED_TOOL_NAMES` in [gated-tools.ts](../../src/shared/agent/gated-tools.ts) (+ a `write`
     branch in the renderer's [approval-logic.ts](../../src/renderer/src/agent/approval-logic.ts)).
   - System prompt ([agent-system-prompt.ts](../../src/main/adapters/agent/claude/logic/agent-system-prompt.ts)):
     teach `write_file` (whole-file content, absolute path, requires approval). **⚠ shared file** with any
     in-flight prompt work — rebase-aware. Update its test.
   - Tests: approve → content written + op logged with prior content; typed errors surface as `_tag`.

5. `[backend]` **Undo / redo use cases + IPC endpoints.**
   - `src/main/application/operation/usecase/undo-operation.ts` and `redo-operation.ts`: each loads the
     `Operation` by id, checks status precondition (typed error if already in the target state), invokes
     the **inverse** (undo) or **original** (redo) command through the existing file use cases with the
     captured args, and on success `setStatus`. CQS: these are commands (return void/ack). Inverse mapping
     from Step 0/1; `delete` undo = `createEmptyFile`-then-`writeFile(captured)`.
   - `src/main/application/operation/usecase/list-operations.ts`: a query returning the log newest-first.
   - IPC endpoints (`src/main/ipc/operation/`) wiring the three to `window.api`, serializing to the
     `Result` boundary; register channels.
   - Tests: undo each kind reverses it (against in-memory file writer + log); precondition violation →
     typed error, no fs effect; redo re-applies; list returns newest-first.

6. `[frontend]` **Renderer port/adapter + query/command hooks for the operations log.**
   - Mirror [explorer/](../../src/renderer/src/explorer/): `operations/ports/operation-log.port.ts`,
     `operations/adapters/operation-log.ipc.ts` (the only place touching `window.api`), an in-memory fake
     under `__tests__/`, `operations/operation-query-keys.ts`, a `useOperations` query hook and a
     `useOperationCommands` (undo/redo) command hook that invalidates both the operations key **and** the
     explorer folder key so the tree reflects the change.
   - Tests: query hook lists ops; command hook calls undo/redo and invalidates; error result surfaces.

7. `[frontend]` **Operations history UI in the Review tab + e2e.**
   - `OperationsList.view.tsx` + `OperationCard.view.tsx` (view, pure) and an `Operations.controller.tsx`
     wiring `useOperations`/`useOperationCommands` — each card shows the action label + path(s) and an
     Undo button that flips to Redo by `status`. Mount it in the Review tab's `review` slot alongside the
     artifacts (placement per Open questions). Design tokens, Base UI, Motion, `t()`, **both `en.json` +
     `es.json`** under `rail.operations.*` (`undo`, `redo`, `created`, `renamed`, `deleted`, `wrote`,
     `empty`, `undoFailed`), view/controller split, `Scrollable` for overflow. Surface the undo-failed
     typed error as a translated message.
   - e2e: add `feature:agent-operation-history` to [coverage-manifest.ts](../../e2e/coverage-manifest.ts)
     and a real-app `*.e2e.ts` (pattern: [artifacts.e2e.ts](../../e2e/artifacts.e2e.ts)) — drive the agent
     to create a file, approve it, assert an Operations entry, click Undo, assert the file disappears from
     the explorer and the entry shows Redo. Manifest id + spec in the **same** commit.

8. `[docs]` **Remove this plan file** in its own `docs:` commit once all steps ship.

## Constraints

- **Hexagonal + CQS.** Recording is a command side-effect of an already-approved command; `list-operations`
  is a query; `undo`/`redo` are commands. The operation log is a **repository port** in the application
  layer with an adapter — no store details leak inward. Undo/redo **reuse the existing file use cases**;
  no business logic (path validation, .md rules, typed errors) is re-implemented in the operation layer.
- **Result boundary holds.** Op outcomes serialize to `{ ok }` discriminated unions with tagged errors;
  nothing throws across IPC. Undo precondition failures are typed errors, not thrown.
- **Capture-before-mutate is the load-bearing invariant** for delete/write reversibility — read prior
  content before the destructive command, store it on the `Operation`.
- **No new dependency** (rules out git/isomorphic-git unless Step 0 explicitly justifies and gets
  approval). No `as` casts / `@ts-ignore` / `eslint-disable` / non-null `!` — fix the code or ask.
- **Frontend:** tokens-only, Base UI, Motion, `t()` for every string, both locales, view/controller split,
  `Scrollable` for overflow. Only `/adapters/` may touch `window.api`.
- **Minimal diff.** Don't touch the editor proposal/annotation extensions or the in-editor artifacts model;
  this is filesystem-operation history, separate from in-document review.
- **Backend may not import `src/shared`** (the wire layer) — IPC handlers map domain↔wire; mirror any
  shared constant locally if needed (per the adapters-cannot-import-shared rule).

## Open questions

- **[BLOCKS Step 1] Log model — A vs B vs C (Step 0 spike).** Leaning A (custom in-process log reusing the
  file use cases). B (git) buys durability + out-of-app safety + free content restore at a heavy cost and a
  workspace-is-a-repo assumption; C (editor history) is the wrong granularity. Decide in Step 0. — _open_
- **Out-of-app edits invalidate the log.** The log records _operations Pluma did_, not filesystem truth. If
  the user (or another tool) edits/moves/deletes a target outside Pluma, an undo's precondition no longer
  holds. v1 stance: undo _checks_ the precondition (e.g. delete-undo refuses if the path now exists; the
  existing use-case errors — `FileAlreadyExists`, `FileNotFound` — already enforce this) and fails loudly
  rather than clobbering. Is "fail and surface" acceptable for v1, or must we detect divergence proactively
  (a watcher marking entries stale)? Proactive detection is deferred unless required. — _open_
- **Interleaving user edits + linear vs stack history.** v1 is a **per-operation Undo/Redo toggle** (each
  entry independently reversible by its own captured inverse), _not_ a single global undo stack — so undoing
  op #3 then op #5 is allowed and each is self-contained. Is that the intended model, or do we want a strict
  LIFO stack (undo only the latest, like Ctrl+Z)? Per-operation is simpler and matches "a history of
  operations each undoable"; confirm. — _open_
- **Deleted-file content restoration fidelity.** delete-undo = `createEmptyFile` + `writeFile(captured)`.
  This restores _content_ at the original path but not OS metadata (timestamps, perms). Acceptable for a
  markdown writing app? (Assumed yes.) Also: very large files inflate the in-memory log — cap/size limit? — _open_
- **Capture-failure policy.** If reading prior content fails at capture time (Step 3), do we (a) still run
  the command but mark the op "not undoable", or (b) refuse the command? Leaning (a) — never block the
  agent's approved action on a history concern; mark non-undoable and disable its Undo. Confirm. — _open_
- **Per-workspace scoping + lifetime.** The log is in-memory for v1 (lost on restart — durability is
  explicitly out). Is it keyed per opened workspace folder and cleared when the folder closes/switches, or
  global for the session? Leaning per-workspace, cleared on folder switch. — _open_
- **Review-tab placement.** Does the operations history share the Review tab with the in-editor artifacts
  (two sections under one tab, one count badge summing both), or is it a distinct tab/section? The user's
  framing ("the review/history tab becomes a history of agent operations") suggests it belongs in Review;
  confirm whether it _replaces_ or _sits alongside_ the artifacts list, and how the badge counts. — _open_
- **`write_file` gating is a real behavior change.** Gating `write_file` (Step 4) exposes a new agent
  capability (whole-file content writes), not just history. Is adding that tool in-scope here, or should the
  history cover only the three already-gated tools and `write_file` history wait until the tool ships under
  another plan? If out, drop Step 4 and the `write` kind. — _open_
- **Explorer refresh on undo.** Confirm the explorer already invalidates its folder listing on a backend
  file mutation (so an undo's create/delete shows without reopening the folder); if not, the command hook's
  invalidation in Step 6 must cover it. — _open_

```

```
