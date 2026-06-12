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
