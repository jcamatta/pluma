# External write sync — give the open file's content a single owner

## Summary

A Markdown file open in the editor that is changed **externally** (another program, a git checkout,
a sync client writes new content to it on disk) is not reflected in the editor. Worse, the next
autosave writes the editor's stale content back, silently **overwriting** the external change. We
already sync external **rename** and **delete**; this plan adds the missing **external write /
content-change** sync.

Rather than bolt a fifth hook onto the pile, this plan **consolidates the open file's content
lifecycle into one owner**. Today that lifecycle is smeared across hooks that cannot see each other —
which is the actual reason the sync is broken (see Root cause). One coordinator hook plus one pure
policy function replaces the scattered read / apply / write actors, and the correct sync behaviour
falls out of an explicit **on-disk baseline** instead of fragile cross-hook coordination.

This is a **renderer-only** fix. The OS watcher, IPC, and preload already emit and transport
`updated` events correctly; the renderer just never acts on them for file _content_.

## Root cause

The content of an open file is **one piece of state with two writers** — the user (editor → disk)
and the OS (disk → editor) — and **no owner**. Today it is split by _mechanism_, one hook per action,
across two different component trees:

- [useFileContent.ts](src/renderer/src/explorer/useFileContent.ts) reads disk → editor (query).
- [useEditorContent.ts](src/renderer/src/editor/useEditorContent.ts) applies that content into the
  editor via `setContent`.
- [useAutoSave.ts](src/renderer/src/editor/useAutoSave.ts) writes editor → disk (debounced).
- The watcher subscription lives in a **different component**,
  [DeletedFilesBridge.tsx](src/renderer/src/editor/DeletedFilesBridge.tsx) /
  [useCloseDeletedFiles.ts](src/renderer/src/editor/useCloseDeletedFiles.ts), and only handles
  `deleted` — its test even asserts `updated` is ignored.

These actors coordinate only implicitly, through the React Query cache, and the content hooks live in
`EditorController` while the watcher hooks live in the bridge. Two concrete failures result:

1. **No reload.** An `updated` watcher event (which the OS layer _does_ emit, via the `folder:changed`
   IPC channel) invalidates only the **folder listing** key in
   [useExplorerCommands.ts](src/renderer/src/explorer/useExplorerCommands.ts); nothing invalidates the
   **file content** key (`['file', path]`, from
   [file-query-keys.ts](src/renderer/src/explorer/file-query-keys.ts)). The editor never re-reads disk.

2. **Overwrite, and no way to do reload safely.** `useAutoSave` writes `editor.getMarkdown()` with no
   awareness that disk diverged, clobbering the external change. And critically, **no actor tracks the
   last-synced baseline** — the content we last read or wrote. Without it you cannot distinguish
   "the user has unsaved edits (editor diverged from disk)" from "the OS changed the file (disk
   diverged from the editor)": both look like `current ≠ incoming`. So a naive reload can't tell a
   safe reload from one that would destroy unsaved edits. The missing baseline is the real defect; a
   per-hook string-compare guard cannot fix it.

## Approach

Introduce one owner of the open file's content, plus one pure policy. **The conflict policy is
disk-wins:** an external change always reloads into the editor. This is exactly the behaviour the bug
report asks for ("the editor should reflect the new content"), and it is the opposite of the
overwrite bug; the only thing it can cost is keystrokes typed in the same ~1s window an external write
lands, which is rare and recoverable. The alternative (editor-wins) would _preserve_ the overwrite
bug in the conflict case, so disk-wins is both the correct fix and the simpler model.

- **`useEditorFileSync(editor, path)`** — a per-file coordinator the controller owns. It reads via
  `useFileContent` (kept as the query seam), applies disk → editor, writes editor → disk (debounced,
  via the `useFileWrite` command seam), subscribes to `writer.onChange` **for its own path** to
  invalidate the file-content query on `updated`, and holds the **baseline** (`useRef`) — the content
  we last synced with disk — advanced on every applied read **and** every successful write. It returns
  `void`, exactly like `useAutoSave` does today. Because each open file is a `key`-ed
  `EditorController` instance ([EditorStack.tsx](src/renderer/src/editor/EditorStack.tsx)), `path` is
  stable for the coordinator's lifetime, so the baseline starts `null` and never needs resetting.

- **`reconcileFileContent(disk, base)` → `'apply' | 'skip'`** — a pure function that _is_ the entire
  sync policy, in one testable place:
  - `disk === base` → `skip` — disk matches our baseline. This is the normal idle case and, crucially,
    **absorbs the self-write echo**: after our own save advances the baseline, the watcher-triggered
    re-read sees `disk === base` and does nothing (no reload, no cursor jump).
  - `disk !== base` → `apply` — disk diverged from our baseline (initial load, or an external change).
    Reload it: advance the baseline to `disk`, and `setContent(disk)` **unless the editor already shows
    `disk`** (a cheap `editor.getMarkdown() !== disk` guard that keeps the cursor stable on a residual
    echo). `base === null` (nothing synced yet) takes this branch, which is how the first load applies.

The baseline is the linchpin: advancing it on our own successful writes is what stops a debounced
self-write — read back through the OS watcher while the user keeps typing — from looking like an
external change and reverting newer keystrokes.

Why this is _less_ code doing the _same_ thing, not more: it removes `useEditorContent` and
`useAutoSave` (and obviates the otherwise-needed reload hook + guard), folding their three concerns
into one coordinator whose behaviour is driven by a single pure function. The self-write loop, the
overwrite, and the reload all fall out of the baseline model instead of needing guards spread across
hooks.

`useCloseDeletedFiles` stays as-is: deletion is **lifecycle**, not content, so it is a genuinely
separate concern and already works.

### CQS / architecture fit

CQS is preserved — the query (`useFileContent`) and the command (`useFileWrite`) remain **separate
seams** the coordinator uses internally; the coordinator returns `void` and exposes neither a
`useQuery` result nor a `useMutation` to callers (mirroring `useAutoSave`). The reconcile policy is an
extracted **pure calculation**, which the codebase explicitly wants out of hooks.

## Done

- A file open in the editor whose content is changed on disk by another process **updates in place**
  to show the new content, without the user reopening it (disk-wins).
- The editor no longer overwrites an external write with stale content during normal editing; a
  debounced self-write read back through the watcher does not revert newer keystrokes.
- Unit tests cover `reconcileFileContent` (both branches + the `null` baseline) and the
  `useEditorFileSync` coordinator (initial load applies, external change reloads, self-write echo is a
  no-op, debounced write-back advances the baseline, flush on unmount).
- A real-app e2e spec opens a file, writes new content to it externally, and asserts the editor
  reflects it.
- `npm run lint`, `npm run test` (incl. the e2e coverage audit), `npm run type-coverage`, and
  `npm run build` pass; `npm run test:e2e` passes (UI change).

## Steps

### 1. Pure sync policy

- **`src/renderer/src/editor/reconcile-file-content.ts`** (new, pure) — `reconcileFileContent(disk,
base)` returning `'apply' | 'skip'` per the rules above. No editor, no side effects — plain strings
  (and a nullable baseline) in, decision out.
- **`src/renderer/src/editor/__tests__/reconcile-file-content.test.ts`** (new) — covers: `disk === base`
  → skip; `disk !== base` → apply; `base === null` → apply (first load).

Delivers the whole sync decision as a tested pure function before any hook depends on it. Trivially
green and independently reviewable.

### 2. Consolidate the content lifecycle into `useEditorFileSync`

- **`src/renderer/src/editor/useEditorFileSync.ts`** (new) — the coordinator. Reads content with
  `useFileContent(path)`; holds `baseRef` (`useRef<string | null>`, starts `null`); on a content
  result applies `reconcileFileContent` (apply → `baseRef = disk` then `setContent` unless the editor
  already shows `disk`; skip → leave editor); on editor `update` debounce-writes via `useFileWrite` and
  advances `baseRef` to the written markdown on `ok: true`; subscribes to `writer.onChange` for `path`
  and on `updated` invalidates `fileContentKey(path)` so the read path re-runs reconcile.
  Flush-on-unmount is preserved from the old autosave.
- **`src/renderer/src/editor/useManuscriptEditor.ts`** (change) — drop the `content` param and the
  `useEditorContent` call; it now only constructs the editor instance. Content sync moves to the
  coordinator.
- **`src/renderer/src/editor/Editor.controller.tsx`** (change) — call `useManuscriptEditor()` then
  `useEditorFileSync(editor, path)`, replacing `useAutoSave` and the `useFileContent`/`content`
  plumbing (which now lives in the coordinator).
- **Remove** `src/renderer/src/editor/useEditorContent.ts`, `src/renderer/src/editor/useAutoSave.ts`,
  and `__tests__/useAutoSave.test.tsx`, migrating their still-relevant assertions into the
  coordinator's test.
- **`src/renderer/src/editor/__tests__/useEditorFileSync.test.tsx`** (new) — initial content loads;
  an external change (`emit({type:'updated'})` after changing the fake's file content) reloads the
  editor; a self-write echo (disk equals what we wrote) is a no-op; a debounced edit writes back and
  advances the baseline; flush-on-unmount writes the latest markdown.

Delivers the single owner. Watch the commit-size budget: this is the meatiest step (new coordinator +
two edits + deletions). If it exceeds ~300 weighted lines or 15 files, split by first extracting the
debounced-write helper into its own module, but keep the two sync _directions_ in one commit — keeping
them together is the whole point.

### 3. Real-app e2e: editor reflects an external write

- **`e2e/editor-external-write.e2e.ts`** (new) — picks a temp folder, opens a seeded `chapter-1.md`,
  asserts its content rendered in `.ProseMirror:visible`, then `writeFile`s **new** content to that same
  path on disk (as `explorer.e2e.ts` does for external create/delete), and asserts the visible editor
  reflects the new content (`toContainText`, generous timeout for watcher latency, à la the 15s used for
  external create/delete). Scope every locator to `.ProseMirror:visible` to dodge the known
  multi-editor strict-mode gotcha.
- `@e2e` header tags claimed in step 4.

### 4. e2e coverage manifest

- **`e2e/coverage-manifest.ts`** (change) — add a dedicated feature id `editor-external-sync` and claim
  it (plus `operation:folder.changed`, `operation:file.read`) from the step-3 spec, so the audit
  **hard-gates** the existence of this spec. Manifest files are weight 0, so this folds into the step-3
  commit. (Alternative: claim only the pre-existing `editor` / `folder.changed` / `file.read` ids — but
  then the audit would not uniquely force this spec to exist. Recommended: add the dedicated id.)

### 5. Remove the plan

- Delete `docs/plans/external-write-sync.md` as its own `docs:` commit once every step is shipped and
  green. (Performed by `finish-plan`.)

## Constraints

- **Renderer rules.** Data access via TanStack Query; the query (`useFileContent`) and command
  (`useFileWrite`) stay separate seams — the coordinator orchestrates them and returns `void`, it does
  not expose a `useQuery`+`useMutation` pair. No `window.api` in hooks — go through the repo port
  (`writer.onChange` is the existing seam). No `as` (except `as const`), no escape-hatch directives, no
  `let` (baseline is a `useRef`, never module-level mutable), one export per file, comments explain
  _why_.
- **Pure logic out of hooks.** The sync decision is `reconcileFileContent`, a pure module with its own
  tests — no policy branching inline in the hook.
- **No new dependencies.**
- **Renderer-only.** Do not touch the watcher / IPC / preload — confirm they already carry `updated`,
  but the fix lives in the renderer.
- **e2e** has its own ESLint block but the hard bans (no `as`, no disable, no `let`) still apply; drive
  the real app, never mock `window.api` — the external write is a real `fs.writeFile` to the temp folder.
- **Worktree.** Use worktree-prefixed paths for all file tools in this branch.

## Decisions

- **Conflict policy: disk-wins (decided).** On any external change the editor reloads. The cost is
  keystrokes typed in the same ~1s window an external write lands; rare and recoverable, and far
  cheaper than silently destroying an external change (which editor-wins would do). The baseline
  advancing on our own writes is what keeps disk-wins from reverting a user who keeps typing through a
  self-write echo. A "file changed on disk — keep mine" affordance is a possible later refinement, not
  part of this fix.
- **Manifest gate (step 4): add the dedicated `editor-external-sync` feature id (decided)** so the
  audit uniquely forces this spec to exist.

## Open questions

- **Watcher-latency race.** A debounced write could still fire in the brief window before an `updated`
  event lands, momentarily writing then immediately reading back the same content. Benign under
  disk-wins (the echo reconciles to `skip`); acceptable for a single-user app. — _accepted for MVP._
