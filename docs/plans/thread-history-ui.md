# Thread history — UI: threads panel, resume, history rendering

The **backend + renderer data layer for thread history is already shipped** (on branch
`feat/thread-history`). This plan covers only the **remaining UI integration**: a threads panel in the
rail, select-to-resume wiring, rename/delete affordances, and rendering a loaded thread's history.

User-facing goal (unchanged): the user opens a **list of previous threads**, selects one, sees its
**whole conversation history**, and **continues where they left off**. "Thread" is the user-facing word;
a thread's id **is** the SDK session id (one value, two names).

## What's already done (the surfaces this plan consumes)

All of the following exist, are tested, and pass `lint`/`test`/`type-coverage`/`build`:

- **`cwd` keying (step 0).** `App` holds the workspace `root` and passes it to `AgentProvider`, which
  calls `agent.setCwd(root)`. On each run the `Agent` stamps `cwd` onto `forwardedProps`; `to-run-input`
  lifts it to a top-level `cwd` on the IPC `RunAgentInput`; `build-options` maps it to the SDK. Threads
  are therefore scoped per workspace.
- **Backend reads + writes** behind ports/adapters + use cases, exposed over IPC:
  - Channels (in [`src/shared/ipc/ipc-contract/agent.ts`](../../src/shared/ipc/ipc-contract/agent.ts)):
    `agent:list-threads` (`{ cwd }` → `readonly ThreadSummary[]`), `agent:thread-history`
    (`{ cwd, threadId }` → `readonly Message[]`), `agent:rename-thread`
    (`{ cwd, threadId, title }` → ack), `agent:delete-thread` (`{ cwd, threadId }` → ack). Read errors
    carry `_tag: 'ThreadReadFailed'`; write errors `_tag: 'ThreadWriteFailed'`. `ThreadSummary` is
    `{ id, title, updatedAt }` (title is `''` when a thread has no stored/derived title — **the renderer
    supplies the localized fallback**, e.g. `t('threads.untitled')`).
- **Renderer data layer** in [`src/renderer/src/threads/`](../../src/renderer/src/threads/):
  - Ports `ThreadsReaderPort` / `ThreadsWriterPort`, IPC adapter `adapters/threads-repository.ipc.ts`,
    `ThreadsProvider` + `useThreadsRepo` (mirrors the explorer's `RepositoriesProvider`/`useRepos`).
  - Key helpers `threadKeys.ts`: `threadsKey(cwd)` = `['threads', cwd]`,
    `threadHistoryKey(cwd, id)` = `['thread-history', cwd, id]`.
  - Query hooks `useThreads(cwd)` and `useThreadHistory(cwd, id | null)` (history disabled until a thread
    is selected). Each `data` is an IPC `Result`; branch on `data.ok`.
  - In-memory `__tests__/fake-threads-repository.ts` for hook/controller tests.
- **Resume already works.** `Agent.ts` (`src/renderer/src/agent/adapters/Agent.ts`) adopts the real SDK
  session id from `RUN_STARTED.threadId` into its mutable `sessionId` and resends it as the threadId on
  the next turn (`resumeThreadId()`), so "continue an existing thread" is solved. AG-UI's own random
  threadId is ignored.

**Not yet wired:** the renderer never mounts `ThreadsProvider`, never calls the query hooks, and has no
threads UI. The rail (`src/renderer/src/rail/`) still renders a single ephemeral turn
(`ConversationRail.controller.tsx` notes "the multi-turn chats list is deferred").

## Remaining steps (each a small, committable unit; checks green at the end)

### 7. Seed the agent on select — DONE

**Landed.** `Agent.seedThread(id, messages)` sets `sessionId = id` + `setMessages([...messages])`;
`Agent.newThread()` clears both. Resolved the typing open-point with option (b): a `ThreadControls`
interface (seedThread/newThread) on its own context (`agent/ThreadControlsContext.ts`) with a **no-op
default**, so fake-agent tests that mount only `AgentContext` keep working. `AgentProvider` supplies the
concrete `Agent` (which satisfies `ThreadControls`) via the new context; `useAgent` now returns
`{ agent, selectThread, newThread }` (selectThread = seedThread). Tested in
`agent/__tests__/Agent.test.ts` via a probe subclass reading the protected `resumeThreadId()`. Next:
step 8 (threads list view + panel) consumes `useThreads(cwd)` + `selectThread`/`newThread`.

Extend `Agent.ts` to accept an **initial thread id + initial message list** so a selected thread resumes
its session and shows its history; "new thread" = no id. Concretely add two methods to `Agent`:

- `seedThread(id: string, messages: readonly Message[]): void` → set `sessionId = id` and
  `this.setMessages([...messages])` (AbstractAgent exposes `setMessages` and a public `messages`).
- `newThread(): void` → `sessionId = undefined`, `this.setMessages([])`.

Extend `useAgent` to expose `selectThread(id, messages)` and `newThread()`.

**Open design point:** `AgentContext` is typed as `AbstractAgent` (so tests inject fake agents), but
`seedThread`/`newThread` are `Agent`-specific. Resolve by either (a) narrowing the context to the
concrete `Agent`, or (b) a small `ThreadControls` interface the `Agent` implements and the provider
supplies alongside the agent. Prefer the least-invasive option that keeps the fake-agent tests working.

Unit-test the seeding (next `startRun` sends the selected id as `threadId`; `newThread` sends none).
Update `FILE.md`.

### 8. Threads list view + panel — DONE

**Landed.** Pure `threads/ThreadsPanel.view.tsx` (header: back/title/new; scrollable list of rows = title

- relative-time subtitle, active row highlighted) + `ThreadsPanel.controller.tsx` (reads `useThreads(cwd)`,
  maps summaries → rows with the localized `threads.untitled` fallback and a `format-relative-time` subtitle;
  selection/new/back lifted to the rail via props). `ThreadsProvider` mounted at the app root in `main.tsx`
  (beside the explorer's `RepositoriesProvider`). Rail integration via `rail/useThreadSession.ts` (owns
  chat-vs-threads view + active id; seeds the agent on select / new); `ConversationRail.controller` is now a
  thin switch between the new `ChatRail.controller` (the prior turn logic, extracted to stay under the
  size/statement limits) and `ThreadsPanelController`. The chat header's chats button opens the list. The
  chat half **remounts** when returning from the list, so selecting/new naturally clears the live turn.
  `Date.now()` captured once via `useState` initializer (purity rule); `formatRelativeTime` takes one args
  object (max-params). **Deferred to 8b:** rename/delete affordances + command hooks. **Deferred to 9:**
  loading + rendering the selected thread's history (today select only resumes the session via
  `seedThread(id, [])`) and run-finished `threadsKey` invalidation.

Add `ThreadList.view.tsx` (rows: title + relative time, Base UI buttons, Motion mount/hover; each row
exposes a **rename** and **delete** affordance via props — the view stays hook-free, just calls
`onRename(id, title)` / `onDelete(id)`) and a `ThreadsPanel.controller.tsx` that reads `useThreads(cwd)`,
renders the list, and calls `selectThread`. Mount `ThreadsProvider` high enough that the panel + rail
share it. Thread `cwd` down from `App`'s `root` as a prop (like `ExplorerController` receives `root`).

Wire the rail's existing "Threads"/chats entry (`rail.chats` label → a `rail.threads` key, or a new
threads entry) to open this panel; "New thread" → `newThread()`. View tests render with plain props;
controller test with the fake provider asserts select invokes the seam. Add i18n keys to `en.json`
(including the empty-title fallback). Update `FILE.md`.

### 8b. Rename + delete command hooks, wired into the panel — DONE

**Landed.** `useRenameThread` / `useDeleteThread` (useMutation over the writer port; invalidate
`threadsKey(cwd)` on `ok:true` only). UI: each row reveals a rename (inline `ThreadTitleInput`, mirroring
the explorer's `NameInput`) and delete affordance on hover; delete opens `ThreadDeleteDialog` (Base UI
`AlertDialog` + Motion). `useThreadCommands` owns the inline-edit + confirm-dialog state and drives the
command hooks; a blank rename is ignored, and deleting the **active** thread bubbles `onNewThread` so the
rail starts fresh. Error `_tag`s map to `t()` delete/rename keys (one dialog message key with the title
interpolated). Tested: hook tests (rename/delete go through the writer + invalidate on success, not on
failure), leaf-component tests, view tests (rename/delete affordances, inline commit, dialog confirm), and
controller tests (rename through writer; delete active → writer + onNewThread). i18n keys added.

Add `useRenameThread.ts` and `useDeleteThread.ts` (each wraps `useMutation` over the `ThreadsWriterPort`,
returns a `Result`, and on `ok:true` **invalidates `threadsKey(cwd)`** — never on `ok:false`). Wire into
`ThreadsPanel.controller`: rename via an inline editable title (Base UI `Input`, mirroring the explorer's
`NameInput`); delete via a Base UI `AlertDialog` to confirm, and if the deleted thread is the active one,
call `newThread()`. Map `error._tag` → a `t()` key per failure. Hook tests via `renderHook` +
`QueryClientProvider` + fake writer asserting mutation + invalidation; extend the controller test for
rename/delete. Add i18n keys. Update `FILE.md`.

### 9. Load + render history in the turn view — DONE

**Landed.** O5 resolved toward a **scrollable transcript**: the selected thread's history renders above
the live turn inside the rail's scroll area. `ConversationHistory.view` (pure: loading/error states; user
bubbles + assistant blocks via `message-text`, non-text roles omitted) driven by
`ConversationHistory.controller` (loads `useThreadHistory(cwd, threadId)`, maps loading/`ok:false` →
`t()` keys). Wired into `ChatRail` (now takes `cwd` + `selectedId`; renders the history controller when a
thread is selected and treats a selection as `hasTurn` so the panel shows the transcript even before the
first new message). **No agent message-seeding needed for display:** the transcript comes from the query,
and resume already works via the session id (`seedThread(id, [])`); the backend's `toSdkPrompt` only sends
new user turns after the last assistant, so nothing is re-sent. Run-finished invalidation via
`useThreadsRefresh(agent, cwd)` (subscribes to `onRunFinalized`, invalidates `threadsKey(cwd)`). Tests:
message-text calc, transcript view (loading/error/messages), history controller (loaded + error),
refresh hook. **Note (O4):** very old turns may render as a post-compaction summary — acceptable for v1.

When a thread is selected, render its loaded history above the live turn (reuse/extend
`ConversationTurn.view` or add a `ConversationHistory.view`). Source the history from
`useThreadHistory(cwd, selectedId)` and seed the agent with it on select (step 7's `selectThread`).
Empty/error states map `error._tag` → a `t()` key. Decide (O5) whether selecting a thread replaces the
single-turn view with a scrollable transcript or keeps the latest turn with history above — **lean toward
a simple scrollable transcript**. Tests for the view + loading/error branches. Update `FILE.md`.

Also wire **run-finished invalidation**: when a run completes, invalidate `threadsKey(cwd)` so a brand
new thread appears in the list (deferred from the data layer — do it where the run lifecycle is observed,
e.g. the rail controller or a subscriber).

### 10. e2e coverage

Add to `e2e/coverage-manifest.ts`: `operation:agent-list-threads`, `operation:agent-thread-history`,
`operation:agent-rename-thread`, `operation:agent-delete-thread`, and `feature:thread-history`. Write a
real-app spec (`e2e/agent-thread-history.e2e.ts`) that: runs one turn (creates a thread), opens "New
thread", opens the threads list, sees the prior thread, **renames it and asserts the new title shows**,
selects it, asserts its message is shown, sends a follow-up, asserts the reply (resumed context), then
**deletes it and asserts it leaves the list**. Drives the real built app — **no `window.api` mocks**. Run
`npm run test:e2e` green. (The manifest ids must be added **with** this spec, not before — the audit
turns red if an id is unclaimed.)

### 11. Finish

Run `lint`, `test`, `type-coverage`, `build`, `test:e2e`; remove this plan in a separate `docs:` commit;
push; open the PR (use the `finish-plan` skill). The PR should fold in the already-pushed backend commits
on `feat/thread-history`.

## Constraints

- Design tokens + Base UI + Motion + `t()` for all new UI; `*.view.tsx` stays hook-free; controllers wire
  hooks. Validate the UI in the **real running app** with screenshots (animate with Motion; beware tokens
  like `surface-inverse-*` that don't exist).
- Reads are **queries**, rename/delete are **commands** (CQS) — the data layer already enforces this; the
  hooks must keep query/command split (separate hooks, command invalidates on `ok:true` only).
- The backend sends **no user-facing prose**: the renderer maps `_tag` → a `t()` key, and supplies the
  empty-title fallback.
- Each commit within the size budget; split a step if it trips the hook.

## Open questions

- **O4 — compaction.** `getSessionMessages` returns the post-compaction chain, so very old turns may be a
  summary in the rendered history. Acceptable for v1; note it in the UI if it confuses.
- **O5 — transcript vs single turn.** Step 9 decides whether a selected thread shows a scrollable
  transcript or keeps the latest turn with history above. Lean scrollable transcript.
