# Plan: Ctrl+Tab / Ctrl+Shift+Tab to switch between open editor tabs

## What & why

The editor panel can hold many open files as tabs (`EditorTabStrip`), but the only way to switch between
them is clicking a tab. Add the browser/IDE convention: **Ctrl+Tab** moves to the next open tab and
**Ctrl+Shift+Tab** moves to the previous one, wrapping around the ends. This is keyboard-only navigation
over the _existing_ open-files state — it opens no files, closes none, and changes no persisted state.

This is a small, self-contained slice of a broader hotkey-management effort. We deliberately do **not**
introduce a shortcut registry, a keymap config, or a command palette here — we follow the existing
single-shortcut pattern (`useChatShortcut` + a thin `*Bridge` mounted in `App`) so the cycling behavior
ships green on its own and can later be folded into a registry without rework.

## Anchors (reuse these, don't reinvent)

- **Open-files state (the model we cycle):** `src/renderer/src/editor/open-files-logic.ts` —
  `OpenFiles = { readonly paths: readonly string[]; readonly active: string | null }`. Tabs render in
  `paths` order. The active file is `active`. Pure data + calculations, no React.
- **Nav seam:** `src/renderer/src/editor/OpenFilesContext.ts` — `OpenFilesNav` exposes
  `activePath`, `open(path)`, `openInBackground(path)`, `close(path)`. `open(path)` makes an
  already-open path active (via `openFile`, which returns the same `paths` and flips `active`). This is
  the existing command we reuse to switch tabs — **no new context method needed**.
- **State owner:** `src/renderer/src/App.tsx` — owns `useState(noOpenFiles)`, builds the
  `OpenFilesNav` memo, and provides `OpenFilesContext`. This is where the new bridge mounts (alongside
  `ChatShortcutBridge`), inside `OpenFilesContext.Provider`.
- **Tab strip / stack:** `src/renderer/src/editor/EditorTabStrip.view.tsx` (Base UI `Tabs.List`),
  `src/renderer/src/editor/EditorStack.tsx` (Base UI `Tabs.Root` controlled by `open.active`, calls
  `activate` on `onValueChange`). Switching the active path here re-selects the tab automatically — the
  shortcut only needs to change `active`.
- **Shortcut pattern to mirror:** `src/renderer/src/rail/useChatShortcut.ts` (pure predicate
  `isChatShortcut` + `useChatShortcut` hook binding a `window` keydown listener, `preventDefault`,
  cleanup on unmount) and `src/renderer/src/rail/ChatShortcutBridge.tsx` (a `null`-rendering bridge that
  reads context and feeds the hook). Test pattern: `src/renderer/src/rail/__tests__/useChatShortcut.test.tsx`.
- **Main-process shortcut swallow risk:** `src/main/index.ts` — `optimizer.watchWindowShortcuts(window,
{ zoom: true })`. The project memory ("watchWindowShortcuts blocks zoom") warns this helper can
  swallow combos before they reach the renderer. **Ctrl+Tab must be verified to actually arrive** (see
  Open questions + Step 4).

## Design

Pure cycling math over the open-files model, bound by a small renderer keyboard hook, wired by a thin
bridge — three layers mirroring the established shortcut pattern:

1. **`editor-tab-cycle.ts` (calc):** given `paths`, `active`, and a direction (`'next' | 'prev'`),
   return the path to activate (with wraparound), or `null` when there's nothing to do (0 or 1 open
   tabs, or no active path). No React, no DOM — directly unit-testable, like `editor-tabs-logic.ts`.
2. **`useTabCycleShortcut.ts` (action):** a `window` keydown hook mirroring `useChatShortcut`. Exports a
   pure predicate that classifies a `KeyboardEvent` as next / previous / neither, and on a match calls a
   single injected `cycle(direction)` callback after `preventDefault()`. No context reach-in.
3. **`TabCycleBridge.tsx` (wiring):** a `null`-rendering bridge mounted in `App` inside
   `OpenFilesContext.Provider`. It reads `OpenFilesNav` (and the current open-files snapshot it needs),
   computes the target with `editor-tab-cycle.ts`, and calls `open(target)` to switch tabs. Keeps the
   App shell free of the cycling logic, exactly as `ChatShortcutBridge` does.

Why reuse `open(path)` instead of a new nav command: `openFile` already makes an open path active and is
a no-op-on-`paths` for an already-open file, so it is precisely "switch to this tab." Adding a
`switchTo`/`activate` method would duplicate it.

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[frontend]` **Tab-cycle calculation + tests.**
   - Add `src/renderer/src/editor/editor-tab-cycle.ts`: `nextTabPath(open: OpenFiles, direction: 'next'
| 'prev'): string | null` — wraps around `paths`, returns `null` when `paths.length < 2` or
     `active` is `null`/absent. Pure calc over the existing `OpenFiles` type; no new dependency.
   - Tests `src/renderer/src/editor/__tests__/editor-tab-cycle.test.ts`: next from middle, next wraps
     last→first, prev wraps first→last, single tab → `null`, empty → `null`, `active` not in `paths` →
     `null`. (Code >30 lines → lands with this test, same commit.)

2. `[frontend]` **Keyboard hook + predicate + tests.**
   - Add `src/renderer/src/editor/useTabCycleShortcut.ts`: export `classifyTabCycle(event:
KeyboardEvent): 'next' | 'prev' | null` (Ctrl/Cmd held, `event.key === 'Tab'`, Shift → `'prev'`
     else `'next'`; everything else → `null`) and `useTabCycleShortcut({ cycle }: { cycle: (direction:
'next' | 'prev') => void })` binding a `window` keydown listener, `preventDefault()` on a match,
     cleanup on unmount. Mirror `useChatShortcut` structure exactly.
   - Tests `src/renderer/src/editor/__tests__/useTabCycleShortcut.test.tsx` (pattern:
     `useChatShortcut.test.tsx`): Ctrl+Tab → `cycle('next')`, Ctrl+Shift+Tab → `cycle('prev')`,
     Cmd+Tab → `'next'`, other keys ignored, listener unbinds on unmount, `preventDefault` is called on
     a match.

3. `[frontend]` **Bridge + mount in App.**
   - Add `src/renderer/src/editor/TabCycleBridge.tsx`: a `null`-rendering bridge that receives the
     current `open: OpenFiles` and the `open(path)` command (from `OpenFilesContext` / props from `App`),
     wires `useTabCycleShortcut({ cycle })` where `cycle(direction)` computes `nextTabPath(open,
direction)` and, when non-`null`, calls `open(target)`. Decide the open-files source in Step 3 per
     the Open question on prop-vs-context.
   - Mount it in `src/renderer/src/App.tsx` next to `<ChatShortcutBridge ... />`, inside
     `OpenFilesContext.Provider` (App already holds `open` state, so it can pass `open` directly).
   - Test `src/renderer/src/editor/__tests__/TabCycleBridge.test.tsx`: render with a small open-files
     set, dispatch Ctrl+Tab, assert the injected `open` is called with the next path; Ctrl+Shift+Tab →
     previous; single tab → `open` not called. (Keeps App's own test untouched beyond the new child.)

4. `[e2e]` **Real-app spec + coverage-manifest id — only after Ctrl+Tab is confirmed to reach the
   renderer (Open question Q1).**
   - Add a manifest id (e.g. `feature:editor-tab-cycle`) to `e2e/coverage-manifest.ts` **and** a
     `*.e2e.ts` spec in the SAME commit (pattern: an existing editor e2e). The spec opens two+ files,
     presses Ctrl+Tab, asserts the active tab advances (next file's editor visible / its tab
     `data-active`), presses Ctrl+Shift+Tab, asserts it goes back, and asserts wraparound at an end.
   - If Q1 resolves "the main process swallows Ctrl+Tab," this step is preceded by a `[backend]` step
     adjusting `src/main/index.ts` (see Q1) before the e2e can pass.

5. `[docs]` **Remove this plan** in its own `docs:` commit once all steps ship (`finish-plan` does this).

## Done

- With two or more files open, **Ctrl+Tab** activates the next tab and **Ctrl+Shift+Tab** the previous,
  wrapping at both ends; the active editor and the highlighted tab update together. With 0–1 tabs open
  the shortcut is a no-op. No file is opened, closed, or persisted by the shortcut.
- `npm run lint`, `npm run test` (incl. the e2e coverage audit), `npm run type-coverage`, `npm run
build` green; for this UI change `npm run test:e2e` green, including the new tab-cycle spec.

## Constraints

- **No new dependency.** Plain DOM `keydown` + the existing `OpenFiles` model and `OpenFilesContext`.
- **Renderer conventions:** no `as` casts / `@ts-ignore` / non-null `!`; the bridge renders `null` and
  reaches no sibling via the DOM (it drives switching through the `open` command, per the project's
  "no DOM-tree reaching" rule). Pure calc in `editor-tab-cycle.ts`, action in the hook — Data/Calc/Action.
- **Reuse the existing nav command** (`open(path)` / `openFile`) to switch tabs; do not add a parallel
  "activate tab" method unless the Open questions force it.
- **No new user-facing strings expected** (keyboard-only behavior, no visible label). If any string is
  added (e.g. a future shortcut hint), it lands in **both** `en.json` and `es.json`.
- **Minimal diff / YAGNI:** this plan delivers _only_ tab cycling. No shortcut registry, keymap, command
  palette, or MRU history infrastructure — those belong to the broader hotkey-management effort.
- **Base UI Tabs interplay:** `EditorStack` keeps owning selection via `Tabs.Root value={open.active}`;
  the shortcut only changes `active`, so Base UI re-selects the tab without us touching its internals.
  Verify the global `keydown` handler doesn't conflict with Base UI Tabs' own roving-focus arrow keys
  (it shouldn't — we bind `Tab`, not arrows).

## Open questions

- **Q1 (BLOCKS Steps 4, and possibly adds a [backend] step) — does Ctrl+Tab reach the renderer?**
  `optimizer.watchWindowShortcuts(window, { zoom: true })` in `src/main/index.ts` can swallow combos
  before the renderer sees them (project memory: it dead-keyed Ctrl +/-/0 until `{ zoom: true }`).
  Verify in the running app whether a renderer `window` `keydown` for Ctrl+Tab fires. If it does **not**,
  add a `[backend]` step (before Step 4) to stop the helper from consuming Ctrl+Tab — preferred:
  intercept via `webContents.on('before-input-event', ...)` to allow/forward it, or register an
  application-menu accelerator that messages the renderer — chosen per what's minimal and consistent
  with the existing zoom handling. Do **not** assume; confirm first.
- **Q2 (BLOCKS Step 1's ordering semantics) — cycle in tab order or MRU (most-recently-used) order?**
  IDEs differ: VS Code's default Ctrl+Tab cycles **MRU**; browsers cycle **tab order**. The current
  model (`OpenFiles.paths`) is tab/insertion order and has **no MRU history**. This plan as written
  cycles **tab order** (no new state). If the product wants MRU, Step 1 needs an MRU list threaded
  through `App`'s open-files state (new state + reducer changes) — a meaningfully larger change. **Pick
  tab order vs MRU before Step 1.** Default assumption pending an answer: **tab order** (smaller, no new
  state) — confirm with the user.
- **Q3 — should the shortcut fire only when editor focus is in the editor panel, or globally?** Mirroring
  `useChatShortcut`, this plan binds it **globally on `window`**. Confirm that's acceptable (e.g. it
  should still cycle tabs when focus is in the composer), or scope it to when the editor/app shell holds
  focus. Default: global, matching the existing shortcut.
- **Q4 — manifest id name.** Proposed `feature:editor-tab-cycle`; confirm naming matches the manifest's
  existing convention when Step 4 is written.
