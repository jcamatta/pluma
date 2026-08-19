# Plan: editor status bar — word/character count + sync badge

## What & why

Give the active editor a thin status bar along the bottom of the editor panel showing, for the file
the user is editing: its **word count** and **character count**, and a **sync badge** that says whether
the file is currently `synced`, has `unsaved edits`, or has `changed on disk`. The counts answer "how
much have I written"; the badge surfaces the disk ↔ editor ↔ last-saved state that
`useEditorFileSync` already coordinates but never exposes, so the writer can see at a glance whether
their keystrokes have been autosaved and whether an external change has been pulled in.

This is purely a **renderer** feature: no IPC, no backend, no new dependency. Counts derive from the
TipTap document (`editor.getText()`); badge state derives from values `useEditorFileSync` already holds
internally (disk content, live editor content, the last-disk-synced baseline).

## The sync model (read before slicing)

`src/renderer/src/editor/useEditorFileSync.ts` is the single owner of an open file's content. It tracks
exactly three things that define every badge state:

- **disk** — the latest content read from disk: `fileContent.ok ? fileContent.value : null` (the
  `useFileContent(path)` query, re-fetched when the OS watcher reports the file changed).
- **editor** — the live document content: `editor.getMarkdown()`.
- **baseline** (`baseRef.current`) — the content last _synced with disk_: it advances to `disk` when an
  external change is applied into the editor, and advances to the just-written content on a _successful_
  debounced save. This baseline is effectively the **last-saved version** (the bytes we believe are on
  disk and reflected in the editor).

The disk-wins reconcile (`reconcile-file-content.ts`) is: if `disk !== baseline`, apply disk into the
editor; equal is idle (absorbs the self-write echo). So the badge is a pure function of the same three
strings:

| disk vs baseline | editor vs baseline | badge state         | meaning                                                  |
| ---------------- | ------------------ | ------------------- | -------------------------------------------------------- |
| equal            | equal              | **synced**          | disk, editor, and last-saved all agree — nothing pending |
| equal            | differ             | **unsaved edits**   | user typed; autosave hasn't flushed (or is debouncing)   |
| differ           | —                  | **changed on disk** | external change detected; disk-wins reload is imminent   |

`changed on disk` is a brief transitional state: the reconcile effect reloads the editor and advances
the baseline to disk, returning to `synced`. We still model it explicitly so a momentary external write
shows the right colour instead of flickering through `unsaved edits`. This is the **core design
question** (SETTLED below): the badge is derived, not a fourth piece of stored state.

## Design

- **Counts**: a pure module `editor-count-logic.ts` turns the editor's plain text into
  `{ words, characters }`. Characters = the `Intl.Segmenter`-free simple length is acceptable for v1
  (`[...text].length` to count code points, not UTF-16 units); words = non-empty whitespace-split tokens.
  A `useEditorCounts(editor)` hook reads it live off the editor's `transaction` event via
  `useSyncExternalStore`, caching the snapshot against `editor.state` identity so it doesn't re-render
  on every no-op transaction (same pattern as `useEditorPendingCounts.ts`).
- **Badge**: a pure module `sync-badge-logic.ts` mapping `(disk, editor, baseline)` → one of
  `'synced' | 'unsaved' | 'changed-on-disk'`. `useEditorFileSync` is extended to **return** the current
  sync state (it already has all three values) so the status bar reads it without reaching into the
  editor a second time or duplicating the baseline.
- **Status bar**: a `EditorStatusBar.view.tsx` (pure) rendered by `EditorController` _only for the
  active editor_, sitting below the manuscript inside `EditorSurface`. It shows the counts and a small
  badge dot + label. Tokens-only (`text-text-muted`, `feedback-success/warning/info`), `t()` for every
  string, both locales.
- **Per-tab dot (optional, deferred — see Open questions)**: the tab strip already renders a pending
  badge; a sync dot on the tab is a possible add but is OUT of v1 scope to keep the diff small and avoid
  threading per-file sync state up to `EditorStack`. v1 surfaces sync state for the _active_ file only.

## Anchors (reuse these, don't reinvent)

- Content owner / three sync values: `src/renderer/src/editor/useEditorFileSync.ts` (`fileContent`,
  `editor.getMarkdown()`, `baseRef`); reconcile `src/renderer/src/editor/reconcile-file-content.ts`.
- Live-read-off-editor pattern (useSyncExternalStore + `transaction` event + state-identity cache):
  `src/renderer/src/editor/useEditorPendingCounts.ts`.
- Controller that mounts per-active-editor UI and owns the sync hook:
  `src/renderer/src/editor/Editor.controller.tsx`; layout shell
  `src/renderer/src/editor/EditorSurface.view.tsx` (`bar` above, `body` below — add a `footer` slot).
- Counts source: `editor.getText()` (TipTap core, already available — **no** `@tiptap/extension-
character-count` dependency).
- Tokens: `src/renderer/src/App.css` — `--color-feedback-success/warning/info`, `text-text-muted`,
  `--line`. i18n: `src/renderer/src/i18n/locales/en.json` + `es.json` under `editor`.
- Pending-tab badge precedent: `src/renderer/src/editor/EditorTabStrip.view.tsx`.

## Done

- With a file open, a status bar along the bottom of the editor shows the active file's word and
  character counts, updating live as the user types.
- The status bar shows a sync badge that reads **synced** when the file is saved and unchanged,
  **unsaved edits** right after typing (until autosave flushes ~1s later), and **changed on disk** when
  an external write is detected (before disk-wins reloads).
- All strings are translated in both `en.json` and `es.json`; the locale-parity test passes.
- `npm run lint`, `npm run test`, `npm run type-coverage`, `npm run build` green; for the e2e step,
  `npm run test:e2e` green.

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[frontend]` **Count logic + hook.**
   - `src/renderer/src/editor/editor-count-logic.ts`: pure `countText(text: string): { readonly words:
number; readonly characters: number }` — characters via `[...text].length`, words via
     `text.trim().split(/\s+/).filter(Boolean).length` (empty text → 0/0). + `__tests__/editor-count-
logic.test.ts` (empty, single word, multi-word with punctuation/newlines, unicode/emoji code-point
     count).
   - `src/renderer/src/editor/useEditorCounts.ts`: `useEditorCounts(editor: Editor | null): { words,
characters }` reading `editor.getText()` live via `useSyncExternalStore` over the `transaction`
     event, snapshot cached against `editor.state` identity (mirror `useEditorPendingCounts.ts`); null
     editor → `{ words: 0, characters: 0 }`. + `__tests__/useEditorCounts.test.tsx` (renderHook with a
     real headless editor from `extensions/__tests__/editor-test-harness`; type text, assert counts
     update).

2. `[frontend]` **Sync-badge logic + expose state from the file-sync hook.**
   - `src/renderer/src/editor/sync-badge-logic.ts`: pure `syncBadgeState({ disk, editor, baseline }: {
disk: string | null; editor: string; baseline: string | null }): 'synced' | 'unsaved' | 'changed-
on-disk'` per the table above (null disk/baseline before first load → treat as `synced` so an
     unloaded editor isn't shown as dirty). + `__tests__/sync-badge-logic.test.ts` (all three rows +
     the null/pre-load cases).
   - Extend `useEditorFileSync.ts` to also return `syncState` of that union: it already reads `disk`
     (the `fileContent` value), `baseRef.current`, and can read `editor.getMarkdown()`; compute via
     `syncBadgeState` on each render. Keep the return shape `{ loaded, syncState }` (additive — existing
     `Editor.controller.tsx` reads `{ loaded }` only). Update `__tests__/useEditorFileSync.test.tsx`
     with cases asserting `syncState` is `'synced'` after load, `'unsaved'` after a keystroke before the
     debounce flush, and back to `'synced'` after the write settles.
   - NOTE: this step edits the live-stream sync owner — keep the existing baseline/reconcile behaviour
     byte-for-byte; only ADD the derived `syncState` read. Don't change `SAVE_DELAY_MS` or the effects.

3. `[frontend]` **Status-bar view + controller wiring + i18n.**
   - `src/renderer/src/editor/EditorStatusBar.view.tsx`: pure view taking `{ words, characters,
syncState, countsLabel, syncLabel }` (or precomposed strings) and rendering a thin row — counts on
     one side, a badge dot + label on the other. Badge colour by state: `synced` →
     `feedback-success`, `unsaved` → `feedback-warning`, `changed-on-disk` → `feedback-info`; the dot is
     a CSS-coloured `<span>` (NO hand-rolled SVG). Tokens-only, `text-text-muted`, top `border-(--line)`.
     - `__tests__/EditorStatusBar.view.test.tsx` (renders counts; badge label/role per state).
   - `EditorSurface.view.tsx`: add an optional `footer` slot rendered below `body` (additive prop).
     Update `__tests__/EditorSurface.view.test.tsx`.
   - `Editor.controller.tsx`: call `useEditorCounts(editor)`, take `syncState` from `useEditorFileSync`,
     and pass the status bar as `EditorSurface`'s `footer`. Build labels via `t()`:
     `editor.status.words` (`{{count}}`), `editor.status.characters` (`{{count}}`),
     `editor.status.synced` / `editor.status.unsaved` / `editor.status.changedOnDisk`. Update
     `__tests__/Editor.controller.test.tsx`.
   - `i18n/locales/en.json` + `es.json`: add the `editor.status.*` keys in BOTH (parity test).

4. `[e2e]` **Manifest id + real-app spec.**
   - Add a feature id (e.g. `feature:editor-status-bar`) to `e2e/coverage-manifest.ts` and a
     `e2e/editor-status-bar.e2e.ts` that opens a file, asserts the word/character counts render and
     update after typing, asserts the badge reads "synced" at rest, asserts it flips to "unsaved edits"
     immediately after typing, and (best-effort) returns to "synced" after the autosave settles. Manifest
     id + spec in the SAME commit. Pattern: an existing editor e2e spec.

5. `[docs]` Remove this plan file in its own `docs:` commit once all steps ship.

## Constraints

- **Renderer-only, no new dependency.** Counts come from `editor.getText()`, not
  `@tiptap/extension-character-count`. No IPC, no backend, no shared contract change.
- **Minimal diff to the sync owner.** Step 2 only ADDS a derived `syncState` to `useEditorFileSync`'s
  return; the baseline/reconcile/autosave behaviour is unchanged. Do not alter `SAVE_DELAY_MS` or the
  disk-wins policy.
- **View/controller split**: `EditorStatusBar.view.tsx` is pure (props in, JSX out); all hooks and
  `t()` live in `Editor.controller.tsx`. Logic modules (`editor-count-logic`, `sync-badge-logic`) are
  plain TS, directly unit-testable.
- **Tokens / Base UI / Motion / `t()`**: status bar uses design tokens only (`feedback-*`, `text-
muted`, `--line`); every string via `t()`; both locales. **No hand-rolled SVG** — the badge dot is a
  CSS-coloured element, not `<svg>/<circle>`.
- **Live-read referential stability**: `useEditorCounts` caches its snapshot against `editor.state`
  identity (like `useEditorPendingCounts`) so it doesn't re-render the status bar on every keystroke
  that leaves the counts unchanged.
- **Active editor only**: the status bar is rendered by `EditorController` for the active file; hidden
  editors don't show one. No per-tab sync dot in v1 (see Open questions).
- No `as` casts / `@ts-ignore` / `eslint-disable` / non-null `!` — fix the code or ask.

## Open questions

- **SETTLED — badge is derived from the three existing values, not a stored fourth state.**
  `(disk, editor, baseline)` fully determine `synced` / `unsaved` / `changed-on-disk` per the table;
  `useEditorFileSync` already owns all three, so it exposes the derived state rather than tracking a
  separate dirty flag. `changed-on-disk` is transitional (disk-wins reloads it back to `synced`); we
  still model it so an external write shows the right colour.
- **SETTLED — counts use `editor.getText()`, no CharacterCount extension** (no new dep). Characters
  count code points (`[...text].length`); v1 does not use `Intl.Segmenter` grapheme clustering.
- **OPEN — per-tab sync dot.** Should each tab in `EditorTabStrip.view.tsx` also carry a sync dot, or
  is the active-file status bar enough for v1? Default in this plan: status bar only (smaller diff,
  avoids threading per-file sync state up through `EditorStack`/`useEditorPendingCounts`). If a per-tab
  dot is wanted, it's a follow-up plan that lifts `syncState` into a per-path store like the pending
  counts. Confirm before implementing.
- **OPEN — "characters" definition.** Count characters of the plain text (`getText()`, excludes
  markdown syntax/markup) — confirm that's the intended "character count" (vs raw markdown length). This
  plan assumes plain-text characters, matching what a writer perceives.
