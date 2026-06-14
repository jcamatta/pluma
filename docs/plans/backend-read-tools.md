# Backend read tools

Today the agent can only read what the renderer hands it (the open editor's selection or content). It
cannot read a **closed** file, or any file it hasn't been told about. This plan exposes the existing
read-only use cases — `readFile` and `listFolder` — as **backend agent tools** the Claude agent calls
**in-process**, so it can list the workspace and read any markdown file directly, with no approval gate.

It is PR 2.1 of the roadmap in [agent-write-amplification.md](agent-write-amplification.md) (Track 2),
lifted out as its own small plan. It also lands a structural split that Track 2's write tools (PR 2.2)
build on, drawn along one line:

- **`adapters/agent/tools/` — the agent's tools, SDK-neutral.** What the tools _are_: their specs, their
  `run` handlers (invoke a use case, serialize the result), the catalog, and the shared suspend/resume
  bridge. Nothing here imports the Claude SDK.
- **`adapters/agent/claude/` — the Claude binding.** What calls `createSdkMcpServer` / `tool()`. It
  **imports the agent's catalog and registers it** with the SDK. The only place the SDK is touched.

A backend tool is an **inbound adapter** — the same architectural role as an IPC endpoint. It invokes a
use case through its port (providing the live adapter) and serializes the outcome to the shared
`AgentToolResult`. It holds **no business logic**: the `.md`-only rule, path validation, and typed
errors all stay in the use cases, enforced by the ports. The agent goes through the exact same business
logic as the UI.

## Done

When shipped:

- During an agent run, the model can call `list_folder` (lists the workspace's markdown files/folders,
  defaulting to the run's `cwd`) and `read_file` (reads a `.md` file by absolute path) — **including
  files that are not open in the editor**.
- These are queries: they run directly in the main process, no human approval, no renderer round-trip.
- The agent's tools (specs, handlers, catalog, bridge) live under `adapters/agent/tools/` and import no
  SDK; the `createSdkMcpServer` binding for both the frontend and backend tools lives under
  `adapters/agent/claude/`.
- `npm run lint`, `npm run test`, `npm run type-coverage`, `npm run build` are green. **No e2e manifest
  id** — this ships no user-facing UI and no new user-triggered IPC channel; the tools back the
  existing agent run. The change is proven by the `change-validator` driving the real agent to read a
  **closed** file (evidence in the PR body).

## Steps

Every step is `[backend]` (`src/main` only); this is a single-area change, run sequentially on the one
branch. Each step is independently green and within the commit budget.

### Step 1 — Split the tool plumbing along the SDK line `[backend]`

Pure move, **no behavior change**. `git mv` so rename detection keeps the size hook cheap. The
SDK-neutral bridge moves to the agent side; the SDK-calling server stays on the Claude side (renamed for
symmetry with the backend server added later):

- `adapters/agent/claude/runtime/tool-bridge.ts` → `adapters/agent/tools/tool-bridge.ts` — the bridge is
  SDK-neutral suspend/resume infra (it imports no SDK). Frontend tools use it now; PR 2.2's approval
  gate will reuse it, which is why it sits at the agent-side `tools/` root.
- `adapters/agent/claude/runtime/build-tool-server.ts` → `…/runtime/build-frontend-tool-server.ts`
  (export `buildFrontendToolServer`) — it calls `createSdkMcpServer`/`tool()`, so it **stays under
  `claude/`**; only the file name and export are renamed.
- Move each test alongside its file (`tool-bridge.test.ts` → `tools/__tests__/`,
  `build-tool-server.test.ts` → `build-frontend-tool-server.test.ts`) and fix import paths.
- Update imports/usages in `claude-runtime-agent.ts` (the only non-test consumer): the renamed frontend
  server and the bridge's new agent-side path.

Existing behavior and tests are unchanged — green from the new locations.

### Step 2 — Neutral use-case-to-tool-result helper `[backend]`

Add `adapters/agent/tools/run-use-case-tool.ts`: runs a use-case `Effect` and serializes its outcome to
the shared `AgentToolResult` ([agent-tool.ts](../../src/main/application/agent/data/agent-tool.ts)) —
success → `{ ok: true, output }`, typed error → `{ ok: false, error: <tag> }`, defect → a fallback
error result. This is the tool layer's outcome serializer; it carries **no IPC vocabulary** (it is not a
`runIpc`). The caller passes the already-provided effect and a function mapping the typed error to its
`_tag` string, mirroring how the IPC handlers map errors — but expressed in tool terms.

Tests: success output; each typed-error tag; a defect falls back to the error result.

### Step 3 — `read_file` backend tool `[backend]`

Add `adapters/agent/tools/backend/read-file-tool.ts`, shaped `{ spec, run }`:

- `spec` — the AG-UI `Tool`: name `read_file`, one required string `path` param (absolute path to a
  `.md` file), described so the model knows it reads any workspace file, open or not.
- `run(args)` — calls `readFile(path)` ([read-file.ts](../../src/main/application/file/usecase/read-file.ts)),
  provides `FsFileReaderLive` + `NodeContext.layer`, serializes via `run-use-case-tool` to an
  `AgentToolResult` (text output).

The `.md`-only validation and typed `FileNotFound` / `FileReadFailed` errors come from the use case —
the tool adds none. Tests: existing `.md` → `{ ok: true, output: text }`; missing or non-`.md` path →
`{ ok: false, error }`.

### Step 4 — `list_folder` backend tool `[backend]`

Add `adapters/agent/tools/backend/list-folder-tool.ts`, same `{ spec, run }` shape over `listFolder`
([list-folder.ts](../../src/main/application/folder/usecase/list-folder.ts)) + `FsFolderReaderLive` +
`NodeContext.layer`. The tool's JSON output maps each `FolderEntry`
([entry.ts](../../src/main/application/folder/data/entry.ts)) to include its **absolute path** — the
listed folder joined with the entry `name` — alongside `name` and `type`. `FolderEntry` itself is
unchanged (the explorer still uses it); the absolute path is added only in the tool's output shape, so
the agent can feed a listed path straight into `read_file` and can descend into a subfolder by listing
that path. (`listFolder` is one level deep — see the Step 6 prompt.)

**`path` is optional, defaulting to the run's `cwd`** (the workspace root); `run` is constructed with
the run's `cwd: string | undefined`. Resolution: arg `path` if given, else `cwd`, else **no workspace
is open** → a typed error result (no `!` on the optional `cwd`). Tests: entries → JSON output with
absolute paths; missing folder → error; **no `path` → lists `cwd`**; **no `path` and no `cwd` →
typed "no workspace" error**.

### Step 5 — Backend tool catalog (agent) + Claude-SDK binding `[backend]`

The catalog is SDK-neutral and lives on the agent side; the `createSdkMcpServer` binding lives on the
Claude side and imports the catalog:

- `adapters/agent/tools/backend/index.ts` — the catalog: a function taking the run's
  `cwd: string | undefined` and returning the array of backend `{ spec, run }` tools (read + list), so
  `list_folder` gets its `cwd` default (and the no-workspace case). Imports no SDK.
- `adapters/agent/claude/runtime/build-backend-tool-server.ts` — the in-process counterpart to the
  frontend server: imports the catalog, wraps each tool in an SDK `tool()` whose handler runs the tool's
  `Effect` via `Effect.runPromise` (**no bridge**) and returns the `AgentToolResult` as a
  `CallToolResult`, then assembles them with `createSdkMcpServer`. Every tool is marked
  `readOnlyHint: true`.

Tests: the catalog yields both tool specs; the built server exposes both tools; a tool handler returns
the use case's content for a real temp file and a typed error for a missing one (run against a temp dir,
like the adapter tests).

### Step 6 — Wire the backend server into the run `[backend]`

- `claude/logic/build-options.ts` — generalize `toolServerOptions` to register **both** MCP servers
  (`frontend` and `backend`) under `mcpServers`, and merge their permission allow-lists
  (`mcp__frontend__*` + `mcp__backend__*`) into `allowedTools`. A server is registered only when
  present; the `holdStreamOpen` `PreToolUse` hook stays (harmless for the non-suspending backend tools).
- `claude/runtime/claude-runtime-agent.ts` — in `startRun`, build the backend server from the run's
  `input.cwd` (static apart from `cwd`; no renderer input) and pass it to `buildOptions` alongside the
  frontend server.
- `claude/logic/agent-system-prompt.ts` — teach the two read tools: when a folder is open the workspace
  root is its `cwd`, the starting point for `list_folder`; `list_folder` lists **one level** and returns
  each entry's absolute path, so the agent descends by listing a subfolder's path; `read_file` reads a
  markdown file by an absolute path taken from a listing.

Tests: updated `build-options` tests assert both servers register and the merged allow-list; a prompt
assertion that the read tools are described.

### Final step — remove the plan `[docs]`

When every step has shipped and checks are green, `finish-plan` deletes this file in its own `docs:`
commit ("remove backend-read-tools plan, complete") and checks PR 2.1 off in
[agent-write-amplification.md](agent-write-amplification.md).

## Constraints

- **Hexagonal.** A backend tool is an inbound adapter: it invokes a use case through its port (providing
  the live adapter) and serializes — **no business logic in the tool**. Adapter→application and
  adapter→adapter (sibling) imports are allowed; application→adapter is not. Nothing in `tools/` imports
  `ipc/`, and no IPC vocabulary appears there.
- **CQS.** Both tools are queries (reads) — run directly, no gate. Write tools and their approval gate
  are out of scope (PR 2.2).
- **Result contract.** Tool outcomes serialize to the shared `AgentToolResult` discriminated union;
  `ok: false` carries the failure's `_tag` as a bare string (the contract's `error` is a string, not a
  tagged object like the IPC `Result`). Nothing throws across the tool boundary.
- **No new dependency.** `@anthropic-ai/claude-agent-sdk` (`createSdkMcpServer`/`tool`), Effect, and the
  use cases/adapters all already exist.
- **SDK boundary.** The Claude SDK (`createSdkMcpServer` / `tool()` / `CallToolResult`) is touched
  **only under `claude/`**. The agent side (`tools/`) defines what the tools are and imports no SDK;
  `claude/` imports the catalog and binds it. No speculative multi-SDK abstraction (YAGNI) — the split
  is the existing frontend/backend server pair, not a new port.
- **Commit budget.** Each step ≤ ~300 weighted `src/` lines, ≤ 15 files, code > 30 lines lands with a
  test. The Step 1 move is rename-detected, so it stays cheap.

## Open questions

- **`list_folder` default path → SETTLED (yes).** When the agent passes no `path`, `list_folder` lists
  the run's `cwd` (the workspace root). When there is also no `cwd` (no folder open), it returns a typed
  "no workspace" error rather than guessing. The catalog is constructed with `cwd: string | undefined`.
- **`read_file` gets absolute paths from where? → SETTLED.** `list_folder`'s output includes each
  entry's absolute path (joined in the tool output, `FolderEntry` unchanged), so the agent feeds a
  listed path straight into `read_file` — no client-side path joining, no Windows separator hazard.
- **Rename `buildToolServer` → `buildFrontendToolServer`?** Cosmetic symmetry with the backend server.
  Decided in Step 1; either is fine, kept out of the critical path.

## Out of scope (this plan)

- **Write tools** (`create_file`, `write_file`, `rename_file`, `delete_file`) and the **frontend
  approval gate** — they suspend for human approval before running their command use case. That is PR
  2.2 (it reuses the relocated `tool-bridge.ts`). Not built here.
- The whole-document diff feed (Track 1) — unrelated frontend track.
