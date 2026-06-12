# FILE — what each file is about

This is the project's file index. It replaces the per-file header comment: instead of describing a file in a comment at the top of the source, we describe it here, once, in one place.

## How to use this file

- **Whenever you create, edit, or delete a source file, update this index in the same change.** Create → add an entry. Delete → remove its entry. An edit that changes what the file is _for_ → revise its entry. A pure refactor that doesn't change a file's responsibility needs no change here.
- **Write a functional description:** what the file does — its responsibility, the role it plays, the contract it exposes. One to a few sentences.
- **No history, no process notes.** Don't write "added in plan 04" or "edited to fix X", and don't cite plan IDs. That lives in git and in `docs/plans/`. This index describes each file as it is now, not how it got there.

The index is populated incrementally as files are touched, so it starts mostly empty and fills in over time.

---

## Files

<!-- Add entries below, grouped by area. Key each entry by its full repo-relative path. Example:
### src/main/application/file
- `src/main/application/file/usecase/create-file.ts` — command use case that creates a markdown file at a validated path.
-->

### src/main/application/agent — threads (read)

- `src/main/application/agent/data/thread-summary.ts` — plain `ThreadSummary` record (id, title, updatedAt) for the threads list.
- `src/main/application/agent/error/thread-read-failed.ts` — tagged error for a thread that is missing or unreadable.
- `src/main/application/agent/port/thread-reader.port.ts` — reader port for listing threads and loading one thread's message history under a workspace cwd.
- `src/main/application/agent/usecase/list-threads.ts` — query use case returning the workspace's thread summaries via the reader port.
- `src/main/application/agent/usecase/get-thread-history.ts` — query use case returning one thread's post-compaction message chain via the reader port.
- `src/main/application/agent/logic/derive-thread-title.ts` — pure calculation deriving a thread's default title from its first user message.
- `src/main/application/agent/logic/__tests__/derive-thread-title.test.ts` — tests for the title-derivation calculation.
- `src/main/application/agent/usecase/__tests__/list-threads.test.ts` — tests for the listThreads use case against an in-memory reader fake.
- `src/main/application/agent/usecase/__tests__/get-thread-history.test.ts` — tests for the getThreadHistory use case against an in-memory reader fake.

### src/main/application/agent — threads (write)

- `src/main/application/agent/data/rename-thread-input.ts` — plain record (cwd, id, title) bundling the rename arguments.
- `src/main/application/agent/error/thread-write-failed.ts` — tagged error for a thread rename/delete that could not be completed.
- `src/main/application/agent/port/thread-writer.port.ts` — writer port for renaming and deleting threads under a workspace cwd (CQS-separate from the reader).
- `src/main/application/agent/usecase/rename-thread.ts` — command use case persisting a user-chosen thread title via the writer port.
- `src/main/application/agent/usecase/delete-thread.ts` — command use case removing a thread's session via the writer port.
- `src/main/application/agent/usecase/__tests__/rename-thread.test.ts` — tests for the renameThread use case against an in-memory writer fake.
- `src/main/application/agent/usecase/__tests__/delete-thread.test.ts` — tests for the deleteThread use case against an in-memory writer fake.

### src/main/adapters/agent/claude — threads (read adapter)

- `src/main/adapters/agent/claude/logic/session-info-to-summary.ts` — pure map from an SDK session row to a ThreadSummary (stored title wins over derived).
- `src/main/adapters/agent/claude/logic/session-messages-to-history.ts` — pure map from the SDK session message chain to AG-UI Messages (text-only, system/empty turns dropped).
- `src/main/adapters/agent/claude/runtime/claude-thread-reader.ts` — ThreadReader adapter over the SDK's listSessions/getSessionMessages, keyed by the workspace dir.
- `src/main/adapters/agent/claude/logic/__tests__/session-info-to-summary.test.ts` — tests for the session-row → summary calculation.
- `src/main/adapters/agent/claude/logic/__tests__/session-messages-to-history.test.ts` — tests for the message-chain → history calculation.
- `src/main/adapters/agent/claude/runtime/__tests__/claude-thread-reader.test.ts` — seam tests for the reader adapter with the SDK module mocked.

### src/main/adapters/agent/claude — threads (write adapter)

- `src/main/adapters/agent/claude/runtime/claude-thread-writer.ts` — ThreadWriter adapter over the SDK's renameSession/deleteSession, keyed by the workspace dir.
- `src/main/adapters/agent/claude/runtime/__tests__/claude-thread-writer.test.ts` — seam tests for the writer adapter with the SDK module mocked.

### src/main/ipc/agent — threads (read endpoints)

- `src/main/ipc/agent/list-threads-handler.ts` — IPC endpoint serializing the listThreads use case to a Result.
- `src/main/ipc/agent/thread-history-handler.ts` — IPC endpoint serializing the getThreadHistory use case to a Result.
- `src/main/ipc/agent/__tests__/list-threads-handler.test.ts` — tests for the list-threads handler with the SDK mocked.
- `src/main/ipc/agent/__tests__/thread-history-handler.test.ts` — tests for the thread-history handler with the SDK mocked.

### src/main/ipc/agent — threads (write endpoints)

- `src/main/ipc/agent/rename-thread-handler.ts` — IPC endpoint serializing the renameThread use case to an ack Result.
- `src/main/ipc/agent/delete-thread-handler.ts` — IPC endpoint serializing the deleteThread use case to an ack Result.
- `src/main/ipc/agent/__tests__/rename-thread-handler.test.ts` — tests for the rename-thread handler with the SDK mocked.
- `src/main/ipc/agent/__tests__/delete-thread-handler.test.ts` — tests for the delete-thread handler with the SDK mocked.

### src/renderer/src/threads — ports, adapter, provider, query hooks

- `src/renderer/src/threads/ports/threads-reader.port.ts` — renderer query port: list threads / load history, returning the IPC Result.
- `src/renderer/src/threads/ports/threads-writer.port.ts` — renderer command port: rename / delete thread, returning the IPC Result.
- `src/renderer/src/threads/adapters/threads-repository.ipc.ts` — real reader+writer adapter over window.api (the only threads module touching IPC).
- `src/renderer/src/threads/ThreadsContext.ts` — React context + useThreadsRepo for the threads ports.
- `src/renderer/src/threads/ThreadsProvider.tsx` — provides the real IPC-backed threads repositories to the subtree.
- `src/renderer/src/threads/threadKeys.ts` — pure React Query key helpers (threadsKey, threadHistoryKey), keyed by workspace cwd.
- `src/renderer/src/threads/useThreads.ts` — query hook listing the workspace's threads (data is a Result).
- `src/renderer/src/threads/useThreadHistory.ts` — query hook loading one selected thread's history (enabled when a thread is selected).
- `src/renderer/src/threads/__tests__/fake-threads-repository.ts` — in-memory fake of the threads repositories for hook/controller tests.
- `src/renderer/src/threads/__tests__/useThreads.test.tsx` — tests for the useThreads query hook against the fake.
- `src/renderer/src/threads/__tests__/useThreadHistory.test.tsx` — tests for the useThreadHistory query hook against the fake.
- `src/renderer/src/threads/ThreadsPanel.view.tsx` — pure threads (chats) panel: header (title/back/new) over a scrollable list of thread rows (title + relative-time subtitle), active row highlighted; all data and callbacks via props.
- `src/renderer/src/threads/__tests__/ThreadsPanel.view.test.tsx` — tests the panel view's empty state, row rendering, and onSelect/onNewThread/onBack callbacks.
- `src/renderer/src/threads/ThreadsPanel.controller.tsx` — wires the threads panel: reads useThreads(cwd), maps summaries to rows (localized untitled fallback + relative-time subtitle), renders the view; selection/new/back lifted to the caller via props.
- `src/renderer/src/threads/__tests__/ThreadsPanel.controller.test.tsx` — tests the panel controller lists threads against the fake repo, shows the untitled fallback, and bubbles onSelect with the row id.
- `src/renderer/src/threads/format-relative-time.ts` — pure calculation rendering how long ago an instant was (localized via Intl.RelativeTimeFormat), used for each thread row's subtitle.
- `src/renderer/src/threads/__tests__/format-relative-time.test.ts` — tests the relative-time calculation across seconds/minutes/hours/days for the English locale.
- `src/renderer/src/threads/useRenameThread.ts` — command hook renaming a thread through the writer port and invalidating ['threads', cwd] on success.
- `src/renderer/src/threads/__tests__/useRenameThread.test.tsx` — tests rename goes through the writer and refetches the listing on success but not on failure.
- `src/renderer/src/threads/useDeleteThread.ts` — command hook deleting a thread through the writer port and invalidating ['threads', cwd] on success.
- `src/renderer/src/threads/__tests__/useDeleteThread.test.tsx` — tests delete goes through the writer and refetches the listing on success but not on failure.
- `src/renderer/src/threads/ThreadTitleInput.tsx` — stateful leaf: inline title field for renaming a thread (focus/select on mount, commit on Enter/blur, cancel on Escape).
- `src/renderer/src/threads/__tests__/ThreadTitleInput.test.tsx` — tests the inline title field commits trimmed on Enter, cancels on Escape, and commits at most once.
- `src/renderer/src/threads/ThreadDeleteDialog.tsx` — pure controlled delete-confirmation dialog (Base UI AlertDialog + Motion), confirm/cancel via props.
- `src/renderer/src/threads/__tests__/ThreadDeleteDialog.test.tsx` — tests the dialog renders only when open and fires onConfirm/onCancel from its buttons.
- `src/renderer/src/threads/useThreadCommands.ts` — owns the panel's inline-rename + delete-confirm state and drives the rename/delete command hooks; deleting the active thread bubbles onActiveDeleted.

### src/renderer/src/rail

- `src/renderer/src/rail/useThreadSession.ts` — owns the rail's thread-selection state (chat vs threads view, active thread) and seeds the agent to resume a selected thread or start a fresh one.
- `src/renderer/src/rail/__tests__/useThreadSession.test.tsx` — tests select seeds the agent + tracks the active thread, new clears it, and the view toggles.
- `src/renderer/src/rail/ChatRail.controller.tsx` — wires the chat half of the rail: composer value + current turn, runs a turn against the live agent, and folds its events into the rendered ConversationTurn.
- `src/renderer/src/rail/message-text.ts` — pure calculation flattening an AG-UI message's content (string or text parts) to display text.
- `src/renderer/src/rail/__tests__/message-text.test.ts` — tests messageText returns string content, joins text parts, and yields '' otherwise.
- `src/renderer/src/rail/ConversationHistory.view.tsx` — pure transcript of a loaded thread (loading/error states; user bubbles + assistant blocks, non-text roles omitted).
- `src/renderer/src/rail/__tests__/ConversationHistory.view.test.tsx` — tests the transcript view's loading/error states and rendering of user/assistant messages.
- `src/renderer/src/rail/ConversationHistory.controller.tsx` — loads the selected thread's history (useThreadHistory) and renders the transcript view with loading/error labels.
- `src/renderer/src/rail/__tests__/ConversationHistory.controller.test.tsx` — tests the history controller renders the loaded transcript and the error state against the fake repo.
- `src/renderer/src/rail/useThreadsRefresh.ts` — subscribes to the agent's run-finalized signal and invalidates ['threads', cwd] so a new thread appears in the list.
- `src/renderer/src/rail/__tests__/useThreadsRefresh.test.tsx` — tests a finalized run invalidates the threads query for the workspace.

### src/renderer/src/agent

- `src/renderer/src/agent/ThreadControlsContext.ts` — React context carrying the Agent's thread-lifecycle controls (seedThread / newThread); default is a no-op so trees mounting only AgentContext still render.
- `src/renderer/src/agent/__tests__/Agent.test.ts` — tests that seedThread adopts a selected thread's id + history for the next run and newThread clears both.

### src/main/application/agent

- `src/main/application/agent/data/agent-context-entry.ts` — plain data type for one entry of the per-session AG-UI context channel (`description` + `value`), folded into a fresh run's opening message.

### src/main/adapters/agent/claude

- `src/main/adapters/agent/claude/logic/agent-system-prompt.ts` — pure constant exposing the custom system prompt for every Claude SDK run: the Pluma writing-assistant identity, surface (chat panel beside the editor), tone, and scope.
- `src/main/adapters/agent/claude/logic/__tests__/agent-system-prompt.test.ts` — asserts the system prompt is non-empty and states the identity claims (Pluma, writing assistant, chat panel, not a coding assistant, tools-only manuscript access).
- `src/main/adapters/agent/claude/logic/context-to-message.ts` — pure calculation folding the per-session AG-UI context entries into the single opening user message of a fresh run (each entry rendered as description + value inside a `<context>` marker); returns nothing when there is no context.
- `src/main/adapters/agent/claude/logic/__tests__/context-to-message.test.ts` — covers the empty case (no message), the SDK envelope shape, and the rendered description/value content.
- `src/main/adapters/agent/claude/runtime/stream-input.ts` — builds the SDK streaming-input prompt: yields the folded context message first on a fresh run (gated on `threadId === undefined`), then the conversation mapped by `toSdkPrompt`.
- `src/main/adapters/agent/claude/runtime/__tests__/stream-input.test.ts` — asserts the context message is yielded first on a fresh run, not re-injected on a resume, and absent when there is no context.

### src/renderer/src/editor

- `src/renderer/src/editor/useEditorTools.ts` — contributes the editor's five frontend tools (get_current_selection, get_current_document, get_ranges, create_annotation, propose_edit) to the agent tool registry for the lifetime of the editor column, binding each handler to the live `Editor` and returning a recoverable error when no document is open.
- `src/renderer/src/editor/__tests__/useEditorTools.test.tsx` — tests that `useEditorTools` registers all five tools, dispatches a handler against the live editor (get_ranges → propose_edit lands a proposal), and reports a recoverable error when no editor is mounted.
