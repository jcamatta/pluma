# Plan: Workspace file-op security gate + "always allow" approvals

## What & why

The agent already exposes three gated file commands — `create_file`, `rename_file`, `delete_file`
(`src/main/adapters/agent/tools/backend/`) — each suspended behind a human Approve/Reject card in the
rail before it touches disk (shipped in the agent-file-tools plan). Two governance gaps remain:

- **(a) Security gate.** Nothing confines a gated op to the open workspace. The model supplies an
  absolute `path`/`oldPath`/`newPath`; today the only validation is `validateMarkdownPath`
  (`src/main/application/file/logic/validate-markdown-path.ts` — trimmed, non-empty, `.md`). A path
  like `C:\Users\me\.ssh\config.md` or `..\..\secret.md` would surface an approval card and, if
  approved, write/rename/delete outside the workspace root. We add a containment check that rejects any
  target escaping the currently-open workspace root **before** the approval card is shown.

- **(b) "Always allow".** Every gated op requires a per-call Approve click. We add a persistent
  "always allow" grant so the user can approve `create`/`rename`/`delete` in blanket instead of one
  card at a time. This governs the renderer approval flow only — the security gate (a) is never
  bypassed by an always-allow grant.

The workspace root is already threaded into the backend tool layer as `cwd`
(`backendTools({ cwd, bridge, runId })` in `claude-runtime-agent.ts`), so the gate has the root it
needs without new plumbing. Always-allow is a renderer-side decision applied in the approvals store
before a card is parked.

## Anchors (reuse these, don't reinvent)

Security gate (a):

- Backend tool layer where `cwd` is in scope: `src/main/adapters/agent/tools/backend/index.ts`
  (`backendTools({ cwd, bridge, runId })`), each tool in
  `src/main/adapters/agent/tools/backend/{create-file,rename-file,delete-file}-tool.ts`. The `cwd`
  originates at `claude-runtime-agent.ts:56` from `input.cwd` (the open workspace folder).
- The gated helper the tools call: `src/main/adapters/agent/tools/gated-use-case-tool.ts`
  (`gatedUseCaseTool` — emits the approval, then folds the use case via
  `run-use-case-tool.ts`). The gate must run **before** `bridge.callTool` so an escaping path never
  surfaces a card.
- Result contract: `AgentToolResult = { ok: true; output } | { ok: false; error: string }` (error is a
  bare `_tag` string), `src/main/application/agent/data/agent-tool.ts`. Existing tools already return
  bare-string errors like `'invalid_args'` for a bad-shape arg (see `create-file-tool.ts`).
- Path-confinement reference: `listFolderTool` resolves a target against `cwd` and uses
  `node:path`; no containment helper exists yet (confirmed — only `rename-thread-input.ts` mentions
  `relative`).

Always-allow (b):

- Renderer approvals store: `src/renderer/src/agent/AgentApprovalsProvider.tsx` +
  `AgentApprovalsContext.ts` (`requestApproval` parks a call and returns the promise the bridge awaits;
  `resolve(toolCallId, approved)` settles it; `approvedResult`/`declinedResult` are the two shapes).
- The bridge branch that parks gated calls: `src/renderer/src/agent/useToolBridge.ts`
  (`isGatedToolName(call.toolName) ? requestApproval(call) : dispatch(...)`).
- The card: `src/renderer/src/rail/ApprovalCard.{view,controller}.tsx`, `ApprovalCardList.view.tsx`;
  action-label/path projection in `src/renderer/src/agent/approval-logic.ts`
  (`describeApproval` → `ApprovalPaths` of kind `create`/`rename`/`delete`/`unknown`).
- Shared gated-name set: `src/shared/agent/gated-tools.ts`
  (`CREATE_FILE_TOOL`/`RENAME_FILE_TOOL`/`DELETE_FILE_TOOL`, `GATED_TOOL_NAMES`, `isGatedToolName`,
  `GatedToolName`).
- i18n: `src/renderer/src/i18n/locales/{en,es}.json` under `rail.approval.*`
  (existing keys: `createFile`, `renameFile`, `deleteFile`, `action`, `approve`, `reject`).
- e2e: `e2e/agent-filesystem-approval.e2e.ts` (real-app gated-create flow),
  `e2e/coverage-manifest.ts` (`agent-filesystem-approval` already registered). Renderer test patterns
  alongside the components in `__tests__/`.

## Scope

- IN (gate): a pure workspace-containment calculation; wiring it into all three gated file tools
  (`create_file`, `rename_file`, `delete_file` — both paths of `rename`) so an escaping or
  outside-root target is rejected with a typed error **before** the approval card; the typed error and
  its rejection wording; system-prompt teaching that paths must stay inside the workspace.
- IN (always-allow): a persisted always-allow grant; the approvals store consulting it so a granted op
  resolves approved without parking a card; a card affordance to grant ("Always allow"); reflecting an
  active grant in the UI; both locales; one real-app e2e.
- OUT (not this plan): folder create/rename/delete agent tools (no `create_folder`/`rename_folder`/
  `delete_folder` tool exists today — only the `FsFolderWriter` adapter; the feature brief names
  "folder operation" but there is nothing to gate yet — see Open questions); `move_file` (only
  `rename_file` exists); per-path / per-file granular always-allow (v1 is per-command-kind);
  batching several ops under one approval; revoking a grant from a settings surface (revocation lives
  on the card / approvals UI only unless Open question Q3 says otherwise).

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

### Part A — Security gate (confine to workspace root)

1. `[backend]` Workspace-containment calculation + its error.
   - `src/main/adapters/agent/tools/within-workspace.ts` (pure, `node:path` only): given a workspace
     root and a candidate absolute path, return whether the candidate resolves to a location at or
     under the root. Resolve both with `path.resolve`, then compare via `path.relative(root, target)`
     — inside iff the relative path is non-empty, is not `..`, and does not start with `..` + sep and
     is not absolute (drive-letter change on Windows yields an absolute relative → outside). Reject a
     candidate when no workspace root is open (root `undefined` → outside).
   - A bare-string rejection label for the `AgentToolResult` error — reuse the existing
     bare-string convention (no typed Effect error needed; the tool layer returns
     `{ ok: false, error: 'outside_workspace' }` like it already returns `'invalid_args'`). Confirm the
     exact label string in Open question Q1.
   - Test: inside paths (root itself, nested child, child with `.md`); outside paths (`..` escape,
     sibling dir, absolute path on another drive, `undefined` root); trailing-slash and
     mixed-separator roots. Pure unit test, no fs.

2. `[backend]` Wire the gate into the three gated file tools (before the approval round-trip).
   - Thread `cwd` to the tools that gate: `backendTools` already receives `cwd`; pass it into
     `createFileTool`/`renameFileTool`/`deleteFileTool` (currently they take only `GatedDeps =
{ bridge, runId }` — extend to carry `cwd`). Keep `index.ts`'s single `gated` object shape.
   - In each tool's `run`, after the existing arg-shape guard and before `gatedUseCaseTool`, check
     every path the op touches with `within-workspace`: `create_file`/`delete_file` check `path`;
     `rename_file` checks **both** `oldPath` and `newPath`. On any failure return
     `{ ok: false, error: 'outside_workspace' }` — the card is never shown.
   - Tests (extend the existing `__tests__/{create,rename,delete}-file-tool.test.ts`): a path outside
     the configured `cwd` returns `outside_workspace` and (critical) **never calls the bridge** and
     **never touches the fs**; an inside path still reaches the approval round-trip as before; for
     `rename_file`, an outside `newPath` with an inside `oldPath` is rejected. Tests run against a real
     temp dir as the existing ones do.
   - Watch the budget: three tools + three test files + `index.ts` is close to the file cap — if it
     exceeds ~15 files or 300 weighted lines, split into 2a (`create_file`/`delete_file`) and 2b
     (`rename_file`, which is the two-path case).

3. `[backend]` System-prompt teaching. ⚠️ shared file — rebase-aware.
   - `src/main/adapters/agent/claude/logic/agent-system-prompt.ts`: extend the existing file-tree
     paragraph (the `create_file`/`rename_file`/`delete_file` sentence) to state that these tools may
     only target paths **inside the open workspace**, that a path outside the workspace is refused
     before any approval card, and (for `rename_file`) that both source and destination must be inside
     the workspace. No emojis. Update its test (`__tests__/agent-system-prompt.test.ts` if present;
     otherwise add a focused assertion in the existing prompt test).

### Part B — "Always allow" persistent approval

> Part B's persistence target and grant scope are gated on Open questions **Q2 / Q3** — do not start
> B1 until they are SETTLED. The slicing below assumes a renderer-owned persisted preference keyed by
> command kind; revise the steps if Q2/Q3 land elsewhere (e.g. a main-process settings repo, which
> would add a `[shared]` IPC-contract step and a `[backend]` repository step ahead of B1).

4. `[shared]` Always-allow grant shape + its persistence port (renderer-side).
   - A small grant model: which command kinds (`create`/`rename`/`delete`, mirroring `ApprovalPaths`
     kinds and `GatedToolName`) are blanket-approved. Reuse the kind vocabulary already in
     `approval-logic.ts` rather than introduce a parallel enum.
   - A renderer port for reading/persisting the grant set (follow the explorer/threads renderer
     port→adapter pattern: `*.port.ts` + a `window.api`/storage adapter + an in-memory fake). The
     concrete persistence (localStorage vs a main-process settings repo over IPC) follows Q2.
   - Tests for the pure grant logic (map a `GatedToolName` → kind; is-granted predicate). If the port
     is trivial pass-through, its adapter test rides with B5.

5. `[frontend]` Approvals store consults the grant; auto-resolve granted ops.
   - `AgentApprovalsProvider.tsx`: in `requestApproval`, when the call's command kind is in the active
     grant set, resolve **approved immediately** (return `approvedResult`) without adding a pending
     entry — the card never appears for a granted kind. Ungated/unknown kinds and non-granted kinds
     park as today.
   - Load the persisted grants via the Part-B4 port; keep the resolver/ref design intact.
   - Tests (`AgentApprovalsProvider` test): a call whose kind is granted resolves approved and adds no
     pending entry; a non-granted kind still parks; the security gate is upstream so this never sees an
     `outside_workspace` op (it was already rejected in the backend).

6. `[frontend]` Card affordance to grant + active-grant indication.
   - `ApprovalCard.{view,controller}.tsx` + `approval-logic.ts`: add an "Always allow <kind>" control
     on the card (e.g. a third action or a checkbox on Approve) that, when chosen, persists the grant
     for that kind via the Part-B4 port and approves the current call. Reflect an already-active grant
     somewhere visible (Q3 decides whether revocation lives here too). Tokens-only, Base UI, Motion,
     `t()`, view/controller split.
   - i18n: add `rail.approval.alwaysAllow` (+ any revoke/granted-state strings) to **both**
     `en.json` and `es.json` under `rail.approval.*`.
   - Tests: choosing "Always allow" persists the grant and resolves approved; a card for a kind already
     granted does not appear (covered in B5) — here assert the control renders and calls the port.

7. `[e2e]` Real-app spec for always-allow.
   - New `e2e/agent-always-allow-file.e2e.ts` + a new manifest id in `e2e/coverage-manifest.ts`
     (id + spec in the **same** commit). Pattern from `agent-filesystem-approval.e2e.ts`: drive the
     real agent to create a file, click "Always allow" on the first card, then drive a second
     create/delete of the same kind and assert **no card appears** and the op takes effect (file lands
     in the explorer / disappears) — proving the grant persisted and auto-approved. Reuse
     `withTempFolder`, `stubFolderPicker`, `launchApp`.

8. `[docs]` Remove this plan file in its own `docs:` commit when all steps ship (`finish-plan`).

## Constraints

- **Hexagonal / CQS.** The gate is an inbound-adapter calculation in the tool layer; no business logic
  leaks into it and it adds no use case. These remain gated commands. The grant persistence follows the
  renderer port→adapter pattern (or a main-process repo if Q2 says so).
- **Result boundary.** `AgentToolResult` holds; the gate's rejection is a bare-string error
  (`outside_workspace`), consistent with the existing `invalid_args` rejection; nothing throws across
  IPC.
- **Gate precedes approval, always.** The containment check runs before `bridge.callTool`, so an
  escaping path never surfaces a card and an always-allow grant can never approve an outside-workspace
  op (B never sees one — A rejected it upstream).
- **No new dependency.** `node:path` only for the gate. No `as` casts / `@ts-ignore` /
  `eslint-disable` / non-null `!` — fix the code or ask.
- **Frontend.** Tokens-only, Base UI, Motion, `t()` for every string, **both** locales, view/controller
  split, `Scrollable` for any overflow.
- **No DOM-tree reaching; `window.api` only in `/adapters/`.** The grant adapter is the only renderer
  file that may touch `window.api`/storage; hooks/stores reach it through the port.
- **Minimal diff.** Don't touch the editor/proposal path or unrelated rail rows. The gate edits only
  the three gated tools + the new helper; always-allow edits only the approvals store + card + grant
  port/adapter + locales.
- **Windows paths.** The app runs on Windows; the containment calculation must handle drive letters,
  backslash separators, and a drive change (treat a cross-drive target as outside).

## Open questions

- **Q1 (gate rejection label) — open.** Exact bare-string error for an out-of-workspace target:
  `outside_workspace` (proposed, parallels `invalid_args`) vs a more specific `path_outside_workspace`.
  Pick one before Step 1; it is user-invisible (the model sees it), so low-risk. Does the agent need a
  distinct label when the _reason_ is "no workspace open" vs "path escapes the root", or is one label
  enough? (Proposed: one label — both are "refused, outside the workspace".)
- **Q2 (always-allow persistence) — open, blocks Part B.** Where is the grant stored?
  (i) renderer-local (e.g. `localStorage` via a renderer adapter — simplest, no IPC, no `[shared]`
  step); (ii) a main-process settings repository over IPC (durable, app-wide, adds a `[shared]`
  contract step + a `[backend]` repository step before B4). Is there an existing settings/preferences
  surface to extend? (`e2e/settings.e2e.ts` exists — confirm whether a settings repo already exists to
  reuse before choosing (ii).)
- **Q3 (grant scope) — open, blocks Part B.** Is the grant **per-session** (clears when the app /
  workspace closes), **per-workspace** (remembered for this folder, keyed by `cwd`), or **global**
  (all workspaces)? This changes the grant key (none / `cwd` / global) and whether the user can revoke
  it and where. The brief explicitly leaves this open. Until settled, B4–B7 are blocked.
- **Q4 (grant granularity) — open.** Is "always allow" per command **kind** (`create`/`rename`/
  `delete` — proposed v1) or a single blanket "allow all file ops"? Per-kind matches the existing
  `ApprovalPaths`/`GatedToolName` vocabulary and is the safer default; confirm before B4.
- **Q5 (folder operations) — open.** The feature brief names "create/rename/delete/**move**/**folder**"
  operations, but today **no** agent tool exists for folders or `move` (only `create_file`/
  `rename_file`/`delete_file`; `FsFolderWriter` is used elsewhere, not exposed to the agent). This plan
  gates the three tools that exist. If folder/move agent tools are also wanted, that is a separate
  feature (expose the `create_folder`/`rename_folder`/`delete_folder` use cases as gated tools) — out
  of scope here unless the brief means otherwise.
