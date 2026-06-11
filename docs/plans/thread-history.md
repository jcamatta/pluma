# Thread history: list past threads, resume a conversation

Let the user open a **list of previous threads**, select one, see its **whole conversation history**,
and **continue where they left off**. Today the rail runs one ephemeral turn at a time and the
threads list is explicitly deferred (`ConversationRail.controller.tsx`: "the multi-turn chats list is
deferred"). Resume already works under the hood — what's missing is _discovering_ past threads and
_rehydrating_ their transcript into the UI.

We use **"thread"** as the user-facing term (AG-UI's vocabulary — every conversation has a
`threadId`, and we already name UI parts like `ThreadDot.view`). See the naming note below.

Reference: https://code.claude.com/docs/en/agent-sdk/session-storage
and https://code.claude.com/docs/en/agent-sdk/sessions
SDK installed: `@anthropic-ai/claude-agent-sdk` — exports verified present:
`listSessions`, `getSessionInfo`, `getSessionMessages`, `renameSession`, `tagSession`,
`deleteSession`, `forkSession`, `foldSessionSummary`.

## Parallelization & collisions (read before starting)

This plan runs **in its own worktree** (`feature/thread-history`) and opens **its own PR**. Three
plans are in flight at once — this one, `agent-system-prompt.md`, and `04-chat-panel.md` (B5/F5).

- **Start this plan AFTER `agent-system-prompt.md` merges.** Step 0 (`cwd`) edits the same four
  files that plan does — each an additive one-liner. If that plan has merged, this is a clean append;
  if not, expect four trivial 1-line conflicts to resolve on rebase. The shared files:
  [`build-options.ts`](../../src/main/adapters/agent/claude/logic/build-options.ts) (options object +
  `BuildOptionsInput` — we add `cwd` beside its `systemPrompt`),
  [`claude-run-options.ts`](../../src/main/adapters/agent/claude/data/claude-run-options.ts) (the
  `Pick` — add `'cwd'`), [`run-agent-input.ts`](../../src/main/application/agent/data/run-agent-input.ts)
  **and** [`ipc-contract/agent.ts`](../../src/shared/ipc/ipc-contract/agent.ts) (`RunAgentInput` — add
  `cwd?` beside `context`), and [`to-run-input.ts`](../../src/renderer/src/agent/to-run-input.ts) (lift
  `forwardedProps.cwd`).
- **`04-chat-panel.md` runs fully in parallel** — it lives in `rail/` + the editor and touches none
  of these files. Only note: this plan's step 7 extends
  [`Agent.ts`](../../src/renderer/src/agent/adapters/Agent.ts); chat-panel does **not** edit `Agent.ts`
  in its remaining work, so no conflict there.

### Internal split: backend ‖ frontend (parallelize within this worktree)

The two halves meet **only at the IPC contract** ([`ipc-contract/agent.ts`](../../src/shared/ipc/ipc-contract/agent.ts)):
the two channel names, the `ThreadSummary` / `Message[]` payloads, and the `ThreadReadError` tag.
**Land that contract first as one small commit, then the two tracks run in parallel** with zero file
overlap until the e2e step rejoins them:

- **Backend track (`src/main`, `src/shared`) — steps 0–4 + 4b.** cwd plumbing, data/error/ports
  (reader **and** writer), the query use cases + title calc + the rename/delete command use cases, the
  Claude adapter (reader + writer), the read and write IPC channels + handlers.
- **Frontend track (`src/renderer`) — steps 5–9 + 8b.** reader/writer ports + IPC adapters + provider,
  the query hooks + the rename/delete **command** hooks (with invalidation), `Agent.ts` seeding, the
  ThreadList view/panel with rename + delete affordances, history rendering.
- **Join — step 10.** e2e spec drives both halves through the real app.

## Naming: thread (UI) = session (SDK)

**A thread's id _is_ the SDK session id. There is one id, not two to reconcile.** "Thread" is just
the user-facing word for the conversation; the value we list, store, and resume is the SDK session id
the backend reports — they are the same value under two names.

The `RUN_STARTED.threadId` the renderer sees is the **SDK session id** (main sets it from
`system/init.session_id`), which `build-options.ts` feeds straight to `resume`.
[`Agent.ts`](../../src/renderer/src/agent/adapters/Agent.ts) already adopts it: it stores the
reported id and resends it as the threadId on the next turn, so resume rides the real session id.

AG-UI's `AbstractAgent` happens to mint its own random per-instance threadId, but **we never use it
for anything** — it is discarded, not a second identity to track (resuming it would fail with "No
conversation found"). So there is nothing to reconcile: ignore the AG-UI instance id and treat the
reported id as _the_ thread/session id throughout.

On disk these are "sessions" and the SDK's read functions are named `*Session*`. We keep the
domain/UI types `Thread*` and only touch the SDK's `*Session*` names inside the Claude adapter — a
naming convention, not a second id.

## What "done" looks like

- A "Threads" panel in the rail lists previous conversations, most-recent first, each with a title
  and a relative timestamp.
- Selecting a thread loads its full message history into the rail and shows it.
- The composer is live on a loaded thread: the next message **resumes that thread's SDK session** and
  the agent has full prior context.
- "New thread" opens a fresh session (current behaviour), and after its first turn it appears in the list.
- All checks green (`lint`, `test`, `type-coverage`, `build`); `test:e2e` green for the new UI; the
  e2e manifest lists the new operations and a real-app spec claims them.

## How it works (the SDK facts that drive the design)

- **Sessions persist to disk automatically.** The SDK writes each session as JSONL under
  `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl` (or `$CLAUDE_CONFIG_DIR/projects/...`). No
  custom `SessionStore` is needed for a single-machine desktop app — the default local store is exactly
  our case. We do **not** add S3/Redis/Postgres adapters.
- **The thread's id already resumes.** `build-options.ts` maps `threadId` → `resume`, and `Agent.ts`
  adopts the real id from `RUN_STARTED.threadId`. So "continue an existing thread" is solved; this plan
  only adds _list_ + _load history_ + _select-to-resume_.
- **Reading threads, without a custom store** (default filesystem):
  - `listSessions(options)` → enumerate threads on disk (`{ sessionId, mtime, ... }`).
  - `getSessionInfo(options)` → metadata for one thread.
  - `getSessionMessages(options)` → the **post-compaction** message chain the agent would see on
    resume. This is what we replay as history (after compaction, old turns are a summary — correct for
    a thread view; we are not building a forensic raw-transcript viewer).
- **`cwd` must match — and today it is wrong.** Sessions are keyed by working directory. `query()` and
  the read functions must run from the **same** `cwd`. **The `cwd` is the workspace folder** — the one
  the user opens in the launcher and that `folder:watch` watches. But `claude-runtime-agent.ts` calls
  `query()` with **no `cwd`**, so the SDK is currently keying sessions by the Electron process's
  directory, not the workspace. **This is settled as O1: pass the workspace folder path as `cwd` to
  both `query()` and the read functions.** `cwd` is not an AG-UI field, so it rides AG-UI's
  `forwardedProps` from the renderer and is lifted to a top-level `cwd` on our own IPC input (step 0).

## Design decisions (settled)

- **Two read-only query use cases, behind one new reader port.** Per CQS these are queries (no state
  change): `list-threads` and `get-thread-history`. They live in `application/agent/` alongside the
  existing run/abort/submit use cases. Resume itself reuses the **existing** run path (pass the chosen
  thread id as `threadId`) — no new command use case.
- **Port split read/write.** Add a `ThreadReaderPort` (`listThreads`, `getThreadHistory`) in
  `application/agent/port/` for the queries, and a separate `ThreadWriterPort` (`renameThread`,
  `deleteThread`) for the commands — CQS keeps reads and writes on distinct ports. The existing
  `RuntimeAgent` port stays the runner. The Claude adapter implements both over the SDK's session
  functions; tests get in-memory fakes.
- **Default title is derived; the user can override it (O2).** A thread's _initial_ title is derived
  from its first user message (a pure calculation over `getSessionMessages`/`listSessions` output).
  The user can **rename** a thread, persisted via the SDK's `renameSession`; a renamed thread shows the
  stored name instead of the derived one. `tagSession` stays out of scope (no tags UI). On read, prefer
  the stored name when present, else fall back to the derived title.
- **The user can delete a thread (O3).** A delete command removes the session from disk via the SDK's
  `deleteSession`; the list refetches and drops it. If the deleted thread was the active one, the rail
  falls back to a new-thread state.
- **History crosses IPC as plain `Message[]`** (`@ag-ui/core`), same type the run path already uses, so
  the renderer can seed the AG-UI agent's messages directly. Each read returns a `Result<…, E>` like
  every other endpoint; the thread-not-found / read-failure error carries a `_tag`.
- **Renderer follows the explorer reference exactly.** A reader port + IPC adapter + context provider,
  and two **query** hooks (`useThreads`, `useThreadHistory`) on TanStack Query with a shared
  `threadsKey` / `threadHistoryKey(id)` helper. No `useState`+`useEffect` fetching.
- **Selecting a thread seeds the agent.** On select, set the rail's active thread id and replace the
  AG-UI agent's `messages` with the loaded history; `Agent.ts` already resends the adopted session id,
  so we extend it to _accept an initial_ thread id (the selected one) instead of only adopting one.

## Steps (each a small, independently committable unit, checks green at the end)

> Sizing target: each step ≤ ~300 weighted `src/` lines, ≤ 15 files, lands with its tests. `docs/`,
> `e2e/`, manifest are weight 0.

### Workspace cwd (prerequisite — fixes the keying)

0. ✅ **DONE.** Workspace folder now flows to `query()` as `cwd`. `App` passes its `root` to
   `AgentProvider`, which pushes it into the `Agent` via a new `setCwd` (mutable field, like the
   existing `sessionId`); on each run the `Agent` stamps `cwd` onto `forwardedProps`, `to-run-input`
   lifts it (via a `'cwd' in`-narrowing guard, no `as`) to a top-level `cwd` on the IPC `RunAgentInput`
   (added in both `shared/ipc/ipc-contract/agent.ts` and `application/agent/data/run-agent-input.ts`),
   and `build-options` maps it into the SDK options (`ClaudeRunOptions` Pick now includes `cwd`).
   Covered by `to-run-input.test.ts` (lift + omit) and `build-options.test.ts` (present + omit). This
   alone makes resume key under the workspace. **Next: step 1 (data + error + reader port).**

   **Thread the workspace folder into the agent as `cwd`.** The workspace folder (opened in the
   launcher, watched by `folder:watch`) must be the `cwd` for `query()` so sessions are keyed there.
   `claude-runtime-agent.ts` passes no `cwd` today, so the SDK keys sessions by the Electron process's
   directory — wrong. This step routes the workspace path to `query({ options: { cwd } })`.

   **`cwd` is not an AG-UI field.** AG-UI's `RunAgentInput` is `threadId` / `runId` / `messages` /
   `tools` / `state?` / `context` / `forwardedProps?` — no `cwd`, and `state` means _agent/conversation
   state echoed in `STATE_SNAPSHOT`/`STATE_DELTA`_, which `cwd` is not. The one sanctioned channel for
   app-specific pass-through data is **`forwardedProps`** (typed `any` by AG-UI, purpose-built for
   exactly this). So:
   - **Renderer:** stamp `cwd` into `forwardedProps` when starting a run, sourced from the open-folder
     the explorer already tracks (`useRootFolder.ts` / launcher). Use a single workspace source — do
     not re-derive the path per call. Reading `forwardedProps.cwd` needs a small **type-guard**
     (`forwardedProps` is `any`/`unknown`) — a pure calculation, no `as`.
   - **`to-run-input.ts`:** lift `forwardedProps.cwd` (via that guard) to a **top-level `cwd`** on our
     _own_ IPC `RunAgentInput` — our IPC type is independent of AG-UI's, so adding `cwd?: string`
     beside `threadId` is clean and honest. Add it in `shared/ipc/ipc-contract/agent.ts` **and**
     `application/agent/data/run-agent-input.ts`.
   - **Adapter:** `buildOptions` spreads `...(cwd === undefined ? {} : { cwd })`, parallel to how it
     already maps `threadId → resume`; `claude-runtime-agent.ts` passes it through.

   Cover the new mapping in `to-run-input.test.ts` (forwardedProps.cwd → top-level cwd; absent → omitted)
   and `build-options.test.ts` (cwd present → in options; absent → omitted). Small and self-contained;
   it also makes _resume_ correct on its own. **Without it, the thread list and resume look in the wrong
   directory.** Update `FILE.md`.

### Backend — read threads

1. **Data + error + reader port.** Add `application/agent/data/thread-summary.ts` (`ThreadSummary`:
   `id`, `title`, `updatedAt`) and `application/agent/error/thread-read-failed.ts` (tagged error).
   Add `application/agent/port/thread-reader.port.ts` (`ThreadReaderPort` with `listThreads(cwd)` →
   `Effect<readonly ThreadSummary[], ThreadReadFailed>` and `getThreadHistory(cwd, id)` →
   `Effect<readonly Message[], ThreadReadFailed>`). **Both reads take the workspace `cwd`** so they
   resolve against the same directory the runs are keyed under (O1) — the list and resume must agree.
   Update `FILE.md`. (Types + port only — pair with step 2's tests if the >30-line rule needs a test in
   the same commit; otherwise this is small.)

2. **`list-threads` + `get-thread-history` use cases.** Add
   `application/agent/usecase/list-threads.ts` and `.../usecase/get-thread-history.ts`, each depending
   only on `ThreadReaderPort`. Tests under `usecase/__tests__/` against an in-memory fake reader:
   success (`ok: true`) and the `ThreadReadFailed` path. Add the **title-derivation calculation** in
   `application/agent/logic/derive-thread-title.ts` with its own unit test (first user message →
   trimmed/truncated title; empty → a fallback key). The list use case prefers a thread's **stored**
   name (from step 2b's write) over the derived title when present. Update `FILE.md`.

2b. **Writer port + rename/delete command use cases.** Add
`application/agent/port/thread-writer.port.ts` (`ThreadWriterPort` with `renameThread(cwd, id, title)`
and `deleteThread(cwd, id)`, each → `Effect<void, ThreadWriteFailed>`) and the tagged error
`application/agent/error/thread-write-failed.ts`. Add `application/agent/usecase/rename-thread.ts`
and `.../usecase/delete-thread.ts`, each depending only on `ThreadWriterPort`. Tests against an
in-memory fake writer: success (`ok: true`) and the `ThreadWriteFailed` path. Both take the workspace
`cwd` (O1) so the write targets the same directory the list reads. Update `FILE.md`.

3. **Claude thread-reader adapter.** Add
   `adapters/agent/claude/runtime/claude-thread-reader.ts` implementing `ThreadReaderPort` over the
   SDK's `listSessions` / `getSessionMessages` (+ `getSessionInfo` if needed for `mtime`), passing the
   explicit `cwd` (O1). Map SDK rows → `ThreadSummary` via the step-2 title calculation (this adapter is
   the one place SDK `*Session*` names are touched). Provide it as a `Layer`. Adapter test exercises real
   reads against a temp `CLAUDE_CONFIG_DIR` seeded with a session (or, if that's impractical, a thin
   seam test — decide in step 3). Update `FILE.md`.

3b. **Claude thread-writer adapter.** Add
`adapters/agent/claude/runtime/claude-thread-writer.ts` implementing `ThreadWriterPort` over the
SDK's `renameSession` / `deleteSession`, passing the explicit `cwd` (O1). Provide it as a `Layer`.
Adapter test against a temp `CLAUDE_CONFIG_DIR` seeded with a session: rename then re-read shows the
new name; delete then list omits it. Update `FILE.md`.

### IPC

4. **Two query channels.** In `shared/ipc/ipc-contract/agent.ts` add `AGENT_LIST_THREADS_CHANNEL`
   (`{ cwd }` → `readonly ThreadSummary[]`) and `AGENT_THREAD_HISTORY_CHANNEL` (`{ cwd, threadId }` →
   `readonly Message[]`), each with a `ThreadReadError` (`_tag`). The `cwd` rides each request so reads
   match the workspace. Wire handlers in `ipc/agent/` that run the use cases and serialize to `Result`.
   Register in `ipc/register.ts`. Handler tests assert `ok:true`/`ok:false` serialization. Update
   `FILE.md`.

4b. **Two command channels.** In `shared/ipc/ipc-contract/agent.ts` add `AGENT_RENAME_THREAD_CHANNEL`
(`{ cwd, threadId, title }` → ack) and `AGENT_DELETE_THREAD_CHANNEL` (`{ cwd, threadId }` → ack),
each with a `ThreadWriteError` (`_tag`). Wire handlers in `ipc/agent/` running the step-2b use cases,
serialize to `Result`, register in `ipc/register.ts`. Handler tests assert `ok:true`/`ok:false`.
Update `FILE.md`.

### Renderer — ports, hooks

5. **Reader + writer ports + IPC adapters + provider.** Under `renderer/src/agent/` (or a new
   `threads/` feature folder — decide in step 5), add a `ThreadsReaderPort` (`listThreads(cwd)` /
   `getThreadHistory(cwd, id)`) **and** a `ThreadsWriterPort` (`renameThread(cwd, id, title)` /
   `deleteThread(cwd, id)`), both `Promise<Result<…>>`, with their `window.api` adapters (pass `Result`
   through, never throw on `ok:false`), exposed through a context provider/`useThreadsRepo` hook
   mirroring the explorer's `RepositoriesProvider`/`useRepos` (which splits reader/writer the same way).
   In-memory fakes for tests. Update `FILE.md`.

6. **Query hooks + key helper.** Add `threadKeys.ts` (`threadsKey(cwd)`, `threadHistoryKey(cwd, id)` —
   the workspace is part of the key, so switching folders refetches the right list),
   `useThreads.ts` (wraps `useQuery`, reads `cwd` from the same workspace source as step 0, `data` is a
   `Result`), `useThreadHistory.ts` (enabled only when a thread is selected). Hook tests via `renderHook`
   with `QueryClientProvider` + fake provider. Wire query invalidation: a finished run invalidates
   `threadsKey(cwd)` so a new thread appears in the list. Update `FILE.md`.

### Renderer — UI + resume wiring

7. **Seed the agent on select.** Extend `Agent.ts` to accept an **initial thread id** and an initial
   message list (so a selected thread resumes its session and shows its history); keep "new thread" =
   no id. Add/extend `useAgent` to expose `selectThread(id)` and `newThread()`. Unit-test the seeding
   (the next `startRun` sends the selected id as `threadId`; `newThread` sends none). Update `FILE.md`.

8. **Threads list view + panel.** Add `ThreadList.view.tsx` (rows: title + relative time, Base UI
   buttons, Motion mount/hover; each row exposes a **rename** and a **delete** affordance via props —
   the view stays hook-free and just calls `onRename(id, title)` / `onDelete(id)`) and a
   `ThreadsPanel.controller.tsx` that reads `useThreads`, renders the list, and calls `selectThread`.
   Wire the rail's existing "Threads" entry (`rail.chats` label — rename to a `rail.threads` key) to
   open this panel; "New thread" → `newThread()`. View tests render with plain props; controller test
   with the fake provider asserts select invokes the seam. Add i18n keys to `en.json`. Update `FILE.md`.

8b. **Rename + delete command hooks, wired into the panel.** Add `useRenameThread.ts` and
`useDeleteThread.ts` (each wraps `useMutation` over the `ThreadsWriterPort`, returns a `Result`, and
on `ok:true` **invalidates `threadsKey(cwd)`** — never on `ok:false`). Wire them into
`ThreadsPanel.controller`: rename uses an inline editable title (a Base UI `Input`, mirroring the
explorer's `NameInput`); delete uses a Base UI `AlertDialog` to confirm, and if the deleted thread is
the active one, calls `newThread()`. `error._tag` → a `t()` key for each failure. Hook tests via
`renderHook` with `QueryClientProvider` + fake writer asserting the mutation + invalidation; extend
the controller test to assert rename/delete invoke the seam. Add i18n keys to `en.json`. Update
`FILE.md`.

9. **Load + render history in the turn view.** When a thread is selected, render its loaded history
   above the live turn (reuse/extend `ConversationTurn.view` or add a `ConversationHistory.view`).
   Empty/error states map `error._tag` → a `t()` key. Tests for the view + the loading/error branches.
   Update `FILE.md`.

### e2e + close

10. **e2e coverage.** Add to `e2e/coverage-manifest.ts`: `operation:agent-list-threads`,
    `operation:agent-thread-history`, `operation:agent-rename-thread`, `operation:agent-delete-thread`,
    and `feature:thread-history`. Write a real-app spec (`e2e/agent-thread-history.e2e.ts`) that: runs
    one turn (creates a thread), opens "New thread", opens the threads list, sees the prior thread,
    **renames it and asserts the new title shows**, selects it, asserts its message is shown, sends a
    follow-up, asserts the reply (resumed context), then **deletes it and asserts it leaves the list**.
    Drives the real built app — **no `window.api` mocks**. Run `npm run test:e2e` green.

11. **Finish.** Run `lint`, `test`, `type-coverage`, `build`, `test:e2e`; update this plan's notes;
    then a separate `docs:` commit removes this plan; push branch; open PR (use the `finish-plan` skill).

## Constraints

- No new dependencies — the SDK session functions and TanStack Query are already present.
- Reads are **queries** (CQS): side-effect-free, return `Result`, error carries a `_tag`. Resume reuses
  the existing run command. Rename and delete are **commands** (CQS): they mutate, return an ack
  `Result`, and live on a separate `ThreadWriterPort` — never folded into the reader.
- Keep Effect inside the application/adapter; serialize at IPC. No throwing across the boundary.
- Design tokens + Base UI + Motion + `t()` for all new UI; `*.view.tsx` stays hook-free.
- `Thread*` is the domain/UI vocabulary; SDK `*Session*` names stay inside the Claude adapter.
- Each commit within the size budget; split a step if it trips the hook.

## Open questions

- **O1 — `cwd`. SETTLED.** The `cwd` is the **workspace folder** (the launcher's open folder, watched
  by `folder:watch`). `query()` currently passes no `cwd`, so step 0 fixes this by threading the
  workspace path into the run and the reads. Threads are therefore scoped per workspace: opening a
  different folder shows that folder's threads — which is the desired behaviour. (If we later want a
  global, cross-workspace thread list, that's a separate change and would need a fixed `cwd` or a
  `SessionStore`.)
- **O2 — titles / rename. SETTLED: in scope.** Titles default to the derived first-user-message text,
  and the user can **rename** a thread (SDK `renameSession`); a stored name wins over the derived one.
  This is a command — writer port + `rename-thread` use case + channel + `useRenameThread` hook + inline
  edit UI (steps 2b/3b/4b/5/8b). `tagSession` (tags) stays out of scope — no tags UI is planned.
- **O3 — delete. SETTLED: in scope.** The list lets the user delete a thread (SDK `deleteSession`),
  also a command on the writer port (`delete-thread` use case + channel + `useDeleteThread` hook +
  confirm dialog). Deleting the active thread falls back to a new-thread state.
- **O4 — compaction.** `getSessionMessages` returns the post-compaction chain, so very old turns may be
  collapsed to a summary in the rendered history. Acceptable for v1; note it in the UI if it confuses.
- **O5 — multiple threads vs the one-turn rail.** The current rail renders a single turn. Step 9 must
  decide whether selecting a thread replaces that single-turn view with a scrollable transcript, or the
  rail keeps showing only the latest turn with history above. Lean toward a simple scrollable transcript.
