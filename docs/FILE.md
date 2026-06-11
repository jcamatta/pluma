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

### src/main/application/agent

- `src/main/application/agent/data/agent-context-entry.ts` — plain data type for one entry of the per-session AG-UI context channel (`description` + `value`), folded into a fresh run's opening message.

### src/main/adapters/agent/claude

- `src/main/adapters/agent/claude/logic/agent-system-prompt.ts` — pure constant exposing the custom system prompt for every Claude SDK run: the Pluma writing-assistant identity, surface (chat panel beside the editor), tone, and scope.
- `src/main/adapters/agent/claude/logic/__tests__/agent-system-prompt.test.ts` — asserts the system prompt is non-empty and states the identity claims (Pluma, writing assistant, chat panel, not a coding assistant, tools-only manuscript access).
- `src/main/adapters/agent/claude/logic/context-to-message.ts` — pure calculation folding the per-session AG-UI context entries into the single opening user message of a fresh run (each entry rendered as description + value inside a `<context>` marker); returns nothing when there is no context.
- `src/main/adapters/agent/claude/logic/__tests__/context-to-message.test.ts` — covers the empty case (no message), the SDK envelope shape, and the rendered description/value content.
- `src/main/adapters/agent/claude/runtime/stream-input.ts` — builds the SDK streaming-input prompt: yields the folded context message first on a fresh run (gated on `threadId === undefined`), then the conversation mapped by `toSdkPrompt`.
- `src/main/adapters/agent/claude/runtime/__tests__/stream-input.test.ts` — asserts the context message is yielded first on a fresh run, not re-injected on a resume, and absent when there is no context.
