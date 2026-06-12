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

### 7. Seed the agent on select

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

### 8. Threads list view + panel

Add `ThreadList.view.tsx` (rows: title + relative time, Base UI buttons, Motion mount/hover; each row
exposes a **rename** and **delete** affordance via props — the view stays hook-free, just calls
`onRename(id, title)` / `onDelete(id)`) and a `ThreadsPanel.controller.tsx` that reads `useThreads(cwd)`,
renders the list, and calls `selectThread`. Mount `ThreadsProvider` high enough that the panel + rail
share it. Thread `cwd` down from `App`'s `root` as a prop (like `ExplorerController` receives `root`).

Wire the rail's existing "Threads"/chats entry (`rail.chats` label → a `rail.threads` key, or a new
threads entry) to open this panel; "New thread" → `newThread()`. View tests render with plain props;
controller test with the fake provider asserts select invokes the seam. Add i18n keys to `en.json`
(including the empty-title fallback). Update `FILE.md`.

### 8b. Rename + delete command hooks, wired into the panel

Add `useRenameThread.ts` and `useDeleteThread.ts` (each wraps `useMutation` over the `ThreadsWriterPort`,
returns a `Result`, and on `ok:true` **invalidates `threadsKey(cwd)`** — never on `ok:false`). Wire into
`ThreadsPanel.controller`: rename via an inline editable title (Base UI `Input`, mirroring the explorer's
`NameInput`); delete via a Base UI `AlertDialog` to confirm, and if the deleted thread is the active one,
call `newThread()`. Map `error._tag` → a `t()` key per failure. Hook tests via `renderHook` +
`QueryClientProvider` + fake writer asserting mutation + invalidation; extend the controller test for
rename/delete. Add i18n keys. Update `FILE.md`.

### 9a. Render the in-session transcript from `agent.messages` (done)

**Landed ahead of 7/8** to fix a standalone bug: the rail rendered a single local `prompt` string, so
each new turn overwrote the previous one (the first message visibly vanished on the second send) and the
header title jumped to the latest prompt — even though `agent.messages` held the whole conversation and
the backend resumed correctly. O5 is **settled here as a scrollable transcript**.

The rail now renders `agent.messages` (the AbstractAgent transcript: user `addMessage` + the apply
pipeline's streamed assistant/tool messages) as the source of truth, with **settled history stacked above
the current turn** (O5's "latest turn with history above" — the existing live-turn UX is unchanged, prior
turns simply pile up above it):

- `rail/transcript-logic.ts` — pure `splitConversation(messages, live)`: peels the current turn (from the
  last user message onward) off the settled history. While a run is live (working/done/error) the current
  turn's streamed reply is owned by the activity, so it is excluded from the history; with no live run the
  whole conversation is history (e.g. a freshly loaded thread). User + non-empty assistant turns are kept;
  tool/system/empty turns dropped.
- `rail/Transcript.view.tsx` — pure view mapping the settled-history items to `UserMessage` / a plain
  assistant reply bubble.
- `ConversationRail.controller.tsx` — reads `agent.messages` instead of `prompt`: renders `TranscriptView`
  (history) above the existing `ConversationTurnView` (current turn = last user message + live activity,
  keeping the "Worked ✓ · N steps" + reply UX). Title derives from the first user message; `newChat` clears
  via `agent.setMessages([])`.
- `rail/useAgentActivityLog.ts` — resets the activity to idle on a new **user** message (`onNewMessage`), so
  the previous turn's settled activity stops being shown/mis-attributed the moment the next turn is sent
  (assistant/tool messages mid-run do not reset).
- `rail/RailComposer.view.tsx` — composer textarea now auto-grows (`field-sizing-content`) inside a
  `Scrollable`, so long drafts scroll with the Base UI scrollbar instead of the native one (capped at
  `max-h-40`).

Proven end-to-end: `e2e/rail.e2e.ts` sends two turns and asserts both user bubbles + the first reply
remain visible. **Pre-existing, out of scope:** the Stop button does not abort (its `agent.abortRun()` is a
no-op in `@ag-ui/client` 0.0.55) — fails on a clean tree too, tracked separately. **Still deferred to step
7/8:** true "new thread" session reset (`newThread()` resetting the SDK session id) and seeding a _selected_
thread's loaded history — those rejoin below.

### 9. Load + render history in the turn view

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
