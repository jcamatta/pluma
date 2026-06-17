# Let the agent act on any file, open or not

Today the AI agent can only annotate, propose edits, or insert into a file that is **already open** in
the editor, and it reads a file's content through the frontend `get_content` tool (which only works on
an open file). This change makes the agent file-agnostic:

1. **Drop `get_content`.** It is fully superseded by the backend `read_file` tool, which reads any
   file's text from disk by absolute path. The agent reads with `read_file`; `get_current_selection`
   stays (the user's live selection cannot be read from disk).
2. **Acting tools work on closed files.** When `propose_edit`, `create_annotation`, `insert`, or
   `insert_at` name a path that has no mounted editor, Pluma **opens that file in the background**
   (a new tab appears but does **not** steal focus), waits until its editor exists and its disk content
   has loaded, then stages the proposal/annotation exactly as for an already-open file.

## Done

- `get_content` no longer exists anywhere (no spec, no handler, no registration, no `readOnlyHint`
  entry, not mentioned in the system prompt or e2e prompts).
- The agent, given a path it has only `read_file`-d (never opened), can `propose_edit` /
  `create_annotation` / `insert` / `insert_at` on it: a tab for that file appears in the strip, the
  proposal/annotation is attached to it, and **the previously-active editor stays active** (focus does
  not move to the opened tab).
- A path that **cannot be opened** (does not exist / cannot be read, or the tab is closed before it
  finishes loading) returns `ok: false` with a clear message and opens **no orphan tab** — the agent
  learns to retry. There is **no timeout**: the await is settled deterministically by the store's
  `'ready'`/`'removed'` events, so the run never hangs (a pre-read file always reaches `'ready'`).
- `npm run lint`, `npm run test`, `npm run type-coverage`, `npm run build` green; `npm run test:e2e`
  green (UI change).

## Steps

> **Steps 1–2 shipped in PR #63** (the `get_content` removal and the system-prompt/`readOnlyHint`
> update). They are kept below for reference; the active work is steps 3 onward. Step numbers are left
> unchanged so the cross-references hold.

### 1. `[frontend]` Remove the `get_content` frontend tool — DONE (#63)

- `src/renderer/src/agent/tools/specs.ts` — drop `getContentTool` (its const, the `agentToolSpecs`
  entry, and the export). Remove the now-unused `filePathDescription` only if no other spec uses it
  (it is still used by the acting tools, so keep it).
- `src/renderer/src/agent/tools/tool-get-content.ts` and
  `src/renderer/src/agent/tools/__tests__/tool-get-content.test.ts` — delete both.
- `src/renderer/src/editor/useEditorTools.ts` — remove the `content` entry, the `getContentTool` /
  `getContent` imports, the `content` field on `EditorToolEntries`, the `readContent` closure, and its
  `useFrontendTool(entries.content)` registration. Update the `readEntries` doc comment (it no longer
  describes `get_content`).
- `src/renderer/src/editor/__tests__/useEditorTools.test.tsx` — drop the `get_content` cases.
- `e2e/editor-tabs.e2e.ts` and `e2e/artifacts.e2e.ts` — in the agent `TOOL_PROMPT` strings, replace
  "read it with get_content" with "read it with read_file" (same frontend agent owns e2e; weight-0
  files). The acting-tool assertions are unchanged.
- **Delivers:** the renderer no longer offers `get_content`. Still green — the backend's
  `READ_ONLY_TOOLS` set may still name `get_content`, but it is now a dead entry (the tool is never in
  the snapshot), so nothing breaks.

### 2. `[backend]` Update the system prompt and drop the dead `readOnlyHint` entry — DONE (#63)

- `src/main/adapters/agent/claude/logic/agent-system-prompt.ts` — rewrite the file-handling prose:
  - The agent reads a file's text with **`read_file`** (by absolute path), not `get_content`; keep
    `get_current_selection` for the active selection and `list_open_files` for the open set.
  - State that the acting tools (`propose_edit`, `insert_at`, `insert`, `create_annotation`) work on
    **any** file by its path — open or not — so it no longer needs the file open first; it still must
    pass the correct path. Replace the old `no_open_editor`/"the file isn't open" guidance: an acting
    tool now fails on a path only when the file can't be read (e.g. a stale path) — a rare, recoverable
    error telling it to recheck the path and retry.
- `src/main/adapters/agent/claude/runtime/build-frontend-tool-server.ts` — remove `'get_content'` from
  `READ_ONLY_TOOLS` (leaving `'get_current_selection'`).
- Update assertions in
  `src/main/adapters/agent/claude/logic/__tests__/agent-system-prompt.test.ts` and any `get_content`
  reference in `src/main/adapters/agent/claude/logic/__tests__/build-options.test.ts`.
- **Delivers:** the agent is told to read via `read_file` and that it can act on any file. Independent
  of Part 2's mechanics (purely prose + a set membership).

### 3. `[frontend]` Open a tab in the background

- `src/renderer/src/editor/open-files-logic.ts` — add `openFileInBackground(state, path): OpenFiles`
  that appends `path` to `paths` (if absent) and leaves `active` unchanged. **Returns the same `state`
  reference when `path` is already open** (so a background-open of an already-open file is a no-op that
  triggers no re-render).
- `src/renderer/src/editor/OpenFilesContext.ts` — add `openInBackground: (path: string) => void` to
  `OpenFilesNav` (doc comment: opens a tab without making it active). `OpenFilesContext` stays the home
  of _tab order + which tab is active_ — UI state owned by `App`; it is deliberately separate from the
  open-editors store (step 4), which owns _mounted editor instances and their load status_. The two are
  keyed by path but model different things; do not merge them.
- `src/renderer/src/App.tsx` — wire it in the `openFiles` memo via `openFileInBackground` (mirrors the
  existing `open`/`close` wiring).
- `src/renderer/src/editor/__tests__/open-files-logic.test.ts` — cases: adds a closed path without
  changing `active`; returns the identical reference when the path is already open; does not disturb an
  existing active path.
- **Delivers:** a shell-level command to open a tab without focusing it. Unused until step 7 — green.

### 4. `[frontend]` The open-editors event store (pure, no React)

Model the open editors as **one** event-driven store: a single source of truth whose entries carry
their lifecycle status, emitting an event on every transition. React reactivity and the "wait until
ready" await both hang off the _same_ event stream, so there is one emitter — not a state plus a
separate notifier. This step is the store in isolation: plain TS, unit-tested directly, used by nobody
yet.

- `src/renderer/src/editor/open-editors-store.ts` — `createOpenEditorsStore(): OpenEditorsStore`:

  ```ts
  type OpenEditorEntry = { readonly editor: Editor; readonly status: 'loading' | 'ready' }
  type OpenEditorEvent =
    | { readonly type: 'mounted'; readonly path: string; readonly editor: Editor }
    | { readonly type: 'ready'; readonly path: string; readonly editor: Editor }
    | { readonly type: 'removed'; readonly path: string }

  interface OpenEditorsStore {
    getSnapshot(): ReadonlyMap<string, OpenEditorEntry> // read (stable identity until a change)
    on(listener: (e: OpenEditorEvent) => void): () => void // subscribe; returns unsubscribe
    mount(path: string, editor: Editor): void // entry @ 'loading'; emits 'mounted'
    markReady(path: string): void // 'loading' -> 'ready'; emits 'ready' (no-op if absent)
    remove(path: string): void // delete entry; emits 'removed'
    waitUntilReady(path: string): Promise<Editor | null> // sugar over on(): 'ready' -> editor, 'removed' -> null
  }
  ```

  - `on(...)` is the one primitive; `getSnapshot()` returns a frozen map with stable identity between
    changes (so it is `useSyncExternalStore`-safe). Each mutator updates the map **and** emits its
    event in the same call, so the map and the stream cannot drift.
  - `waitUntilReady(path)` resolves immediately if the entry is already `ready`; otherwise it subscribes
    and resolves with the editor on the matching `ready` event, or `null` on `removed` (the tab closed
    before it loaded). No timer, no `seen`-heuristic — the event payload makes every case explicit.

- `src/renderer/src/editor/__tests__/open-editors-store.test.ts` — cover: mount→markReady flips status
  and emits; `waitUntilReady` resolves on a later `ready`; resolves immediately when already ready;
  resolves `null` on `remove` before ready; `on` unsubscribe stops delivery; `getSnapshot` identity is
  stable between mutations and changes on each mutation.
- **Delivers:** the event-driven single source of truth for open editors, fully tested without React.

### 5. `[frontend]` Drive the store from the editor; old map becomes a derived view

Cut the editor lifecycle over to the store **without** touching the readers yet — they keep working
through a one-commit derived view, so this commit is small and independently green.

- `src/renderer/src/editor/ActiveEditorContext.ts` — add `store: OpenEditorsStore` to the context.
  Keep the existing `editors` field, but it is now a **read-only derived projection** of
  `store.getSnapshot()` (editor-only map) — a selector over the one source of truth, not a second state
  — so current readers compile unchanged this commit. Drop `registerEditor`/`unregisterEditor` (the
  controller now drives the store). Keep the active/focused editor (`editor` / `register`) — a different
  axis (which tab has focus), not a copy of the open set.
- `src/renderer/src/editor/ActiveEditorProvider.tsx` — create the store once
  (`useRef(createOpenEditorsStore)`); expose it; derive `editors` from a `useSyncExternalStore(store.on,
store.getSnapshot)` snapshot. Active-editor state unchanged.
- `src/renderer/src/editor/useEditorFileSync.ts` — return `loaded: boolean`. **Pin the timing:** it
  must flip true **in the same effect that applies disk content** (the `setContent` effect, currently
  line 47), after the content is in the document — never a render earlier — so a reader that acts on
  "ready" always sees a populated document.
- `src/renderer/src/editor/Editor.controller.tsx` — drive the lifecycle on the store:
  `store.mount(path, editor)` when the instance exists, `store.markReady(path)` once `loaded`,
  `store.remove(path)` on unmount. (Replaces the register/unregister effects; the active-`register`
  effect is unchanged.)
- Tests: `useEditorFileSync` `loaded` flips only once content is applied; `Editor.controller` drives
  mount/ready/remove on the store; the derived `editors` projection still feeds the existing readers.
- **Delivers:** the store is the single source of truth and the editor drives it; readers untouched.

### 6. `[frontend]` Migrate the readers; delete the legacy surface

- Migrate the readers off the derived `editors` projection to `useOpenEditors()` (= the
  `useSyncExternalStore` hook): `src/renderer/src/artifacts/useOpenArtifacts.ts`,
  `src/renderer/src/editor/useEditorPendingCounts.ts`,
  `src/renderer/src/artifacts/ArtifactsPanel.controller.tsx` (`openEditors.get(path)?.editor` — they
  want the editor only; status is irrelevant to them).
- `src/renderer/src/editor/EditorToolsBridge.tsx` — `resolve` (sync) and `list_open_files` read
  `store.getSnapshot()` **at call time** (always fresh — a file opening mid-turn can't hand the agent a
  stale open-set). `list_open_files` reports **every** entry regardless of status, so a just-opened
  `'loading'` tab still appears in the open set.
- `src/renderer/src/editor/ActiveEditorContext.ts` — remove the now-unused derived `editors` field;
  the store is the only open-editor surface.
- Tests: update the `useOpenArtifacts`, `ArtifactsPanel`, and `EditorToolsBridge` tests to a fake store
  / snapshot.
- **Delivers:** the whole shell reads and drives open editors through the one event store; the legacy
  `editors`/`registerEditor` surface is gone.

### 7. `[frontend]` Async resolve: pre-flight read, then open-on-demand (no timeout)

- `src/renderer/src/editor/editor-resolver.port.ts` — add an ensure capability. Keep `EditorResolverPort`
  (the sync map lookup) for the active selection; the outcome is just success-or-failure-with-a-message,
  since nothing parses the failure (the agent only needs to be told to retry):

  ```ts
  type EnsureOutcome =
    | { readonly status: 'ready'; readonly editor: Editor } // open (or opened) and content-loaded
    | { readonly status: 'failed'; readonly message: string } // unreadable path, or closed before it loaded
  type EditorEnsurePort = (path: string) => Promise<EnsureOutcome>
  ```

- `src/renderer/src/editor/EditorToolsBridge.tsx` — build `ensure(path)` from `useRepos().fileReader`,
  `openInBackground`, the `store`, and the React Query client:
  1. **skip the disk read for an already-open file** — if `store.getSnapshot().get(path)?.status ===
'ready'`, return that editor (no read, no open). (`waitUntilReady` already short-circuits a ready
     entry; this extra check is purely to avoid a redundant disk round-trip on the common case.)
  2. **pre-flight read** — `const read = await fileReader.read(path)`. If `!read.ok`, return
     `{ status: 'failed', message: '<path> does not exist or cannot be read' }` and open **nothing**.
  3. on success, prime the content cache (`queryClient.setQueryData(fileContentKey(path), read)`) so
     `useEditorFileSync` loads from cache with no second disk read, call `openInBackground(path)`, then
     `const editor = await store.waitUntilReady(path)` — **no timer**: settled deterministically by the
     store's `'ready'` event (→ ready) or `'removed'` event (→ `failed`, "the file was closed before it
     could open — try again"). A successfully pre-read file always reaches `'ready'` (the seeded cache
     makes `useFileContent` return ok on first render, so the load effect runs deterministically), so
     the only `'removed'` path is the user closing the just-opened tab mid-load. Pass `resolve` (sync,
     unchanged) and `ensure` into `useEditorTools`.
- `src/renderer/src/editor/useEditorTools.ts` — add `ensure: EditorEnsurePort` to `EditorToolDeps`.
  Hoist the **single shared async** `atPath` helper used by the acting + insert tools (today the two
  copies are byte-identical): `const outcome = await deps.ensure(path)`; `'ready'` runs the tool on
  `outcome.editor`, `'failed'` returns `{ ok: false, error: outcome.message }`. This replaces the two
  duplicated `atPath`s and the `noOpenEditor` helper. Handlers return `Promise<AgentToolResult>` (the
  registry `ToolHandler` and the bridge already support async). `readEntries` (selection/list) keeps the
  sync `resolve`. `get_content` is already gone (step 1).
- Update `src/renderer/src/editor/__tests__/useEditorTools.test.tsx` and
  `src/renderer/src/editor/__tests__/EditorToolsBridge.test.tsx`: an acting tool on a **closed but
  readable** path pre-reads it, calls `openInBackground`, and resolves once the editor is marked ready;
  an **unreadable** path returns `ok: false` and opens nothing (no `openInBackground` call); an
  already-open path skips the read and works without changing the active file.
- **Delivers:** the agent can `propose_edit` / `create_annotation` / `insert` / `insert_at` on any
  readable closed file (it opens in the background and the artifact attaches); a bad path is rejected
  cleanly with no phantom tab; one shared `atPath`, one failure path, no timer.

### 8. `[e2e]` Real-app spec + coverage manifest id

- `e2e/coverage-manifest.ts` — add one `FEATURES` id for the new capability (e.g.
  `agent-background-file`). (Added here only, in the step that ships its spec, per the audit rule.)
- `e2e/agent-background-file.e2e.ts` — drive the **real app**: open file A (active), have a closed
  file B in the workspace; instruct the agent to `create_annotation`/`propose_edit` on **B's path**
  (which it `read_file`-s, never opening it). Assert: a tab for B appears in the strip **and stays
  open** (it is not auto-closed — the writer needs to see the artifact's file), **A remains the active
  tab/editor** (focus did not move), and B carries the annotation/proposal. Claim the new id with an
  `@e2e` header tag.
- **Delivers:** the audit stays green and the end-to-end behavior is proven in the real app.

### 9. `[docs]` Remove this plan

- Delete `docs/plans/agent-acts-on-any-file.md` in its own `docs:` commit (performed by `finish-plan`).

## Constraints

- **Frontend-only**; no `src/shared` IPC contract change (the tool wire schemas live in the renderer
  specs). The only `src/main` edits are the agent system prompt and the `READ_ONLY_TOOLS` set (step 2).
- Functional style; **no** `eslint-disable` / `@ts-ignore` / `as` casts / non-null `!`. Async handlers
  use the already-supported `Promise<AgentToolResult>` return.
- **One source of truth, event-driven:** open editors live in a single `OpenEditorsStore`; status is a
  field on the entry, and React reactivity and the await both hang off the store's one event stream
  (`on`) — no parallel state, no separate notifier. Each mutator updates the map and emits its event in
  the same call, so they cannot drift. **No timeouts** (this is a local app; a hang is a bug to fix, not
  a timer to mask) — `waitUntilReady` is settled deterministically by the `'ready'`/`'removed'` events.
  Do not touch the active-selection path or the active/focused editor axis.
- **No DOM-tree reaching:** the open-on-demand path is driven through the store and contexts
  (`OpenFilesContext.openInBackground`, `OpenEditorsStore.waitUntilReady`), never `document.querySelector`.
- **No new user-facing strings** expected — the background tab reuses the existing tab strip
  (`buildEditorTabs` from the path) and the tool descriptions are agent-facing English in `specs.ts`,
  not i18n. If any UI string is added, it lands in **both** `en.json` and `es.json`.
- **No new dependencies.**
- Commit-size budget: each step is one small `src/` commit; steps that change >30 src lines land with
  their test file (every code step above does).

## Open questions

- **SETTLED — focus:** the opened tab does **not** take focus; the user's active editor stays active
  (`openInBackground` leaves `active` unchanged). Confirmed with the user.
- **SETTLED — which read tool stays:** remove `get_content`; keep `get_current_selection`. Confirmed.
- **SETTLED — stale/nonexistent path:** `ensure` does a **pre-flight `fileReader.read(path)`** before
  opening anything (step 7). A failed read returns a clear `ok: false` ("does not exist or cannot be
  read") and opens **no tab**; only a successful read opens the background tab. No phantom/broken tab is
  ever created. Confirmed with the user.
- **SETTLED — one event-driven store, no timeout:** the open-editor map and the load-readiness signal
  are unified into a single event-driven `OpenEditorsStore` (step 4) with a per-entry status; React
  reads and the `waitUntilReady` await share its one event stream. `waitUntilReady` has **no timeout** —
  it is settled deterministically by the store's `'ready'`/`'removed'` events. Chosen with the user
  (event-driven + single source of truth over minimal-diff).
- **SETTLED (simplification review) — one failure outcome:** `EnsureOutcome` is `ready | failed(message)`
  rather than distinguishing `unreadable` vs `gone`. Nothing parses the old `no_open_editor:` string
  (only the system-prompt prose mentions it), the agent's recovery is identical ("retry"), and one
  shared async `atPath`/one `ok:false` path replaces the duplicated helpers — smaller surface, same
  behavior.
