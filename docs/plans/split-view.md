# Plan: Split view — two editor panes side by side

## What & why

Let the writer split the editor column into **two panes ("groups")**, each with its own tab strip and
its own active file, so they can read/edit two files in parallel (e.g. a chapter and its notes). One
group is **focused** at a time; the focused group's active file is what the agent tools, the
Ctrl/Cmd+K focus toggle, and the artifacts/suggestions panels act on. v1 is deliberately small: a
single split into exactly two panes (horizontal, side by side), no nesting, no per-pane resize handle
beyond a fixed 50/50, no drag-and-drop of tabs between panes. The hard part is that the app today
assumes ONE editor column with ONE open-files set and ONE active editor; this plan introduces the
"editor group" abstraction and a "focused group" without changing how any single editor, tab, or
agent tool behaves once it is told which group it belongs to.

## Today's single-editor assumptions (what split must generalise)

Cited so the slicing stays honest:

- **App owns one `OpenFiles`** (`{ paths, active }`) via `useState(noOpenFiles)` and exposes it as one
  `OpenFilesNav` through `OpenFilesContext`
  (`src/renderer/src/App.tsx`, `src/renderer/src/editor/open-files-logic.ts`,
  `src/renderer/src/editor/OpenFilesContext.ts`).
- **One `EditorStack`** renders that one open-set inside one Base UI `Tabs.Root`
  (`src/renderer/src/editor/EditorStack.tsx`, `EditorTabStrip.view.tsx`).
- **One active-editor slot** — `ActiveEditorProvider` holds a single `editor` + `register`, set by
  whichever `EditorController` is `isActive`
  (`src/renderer/src/editor/ActiveEditorProvider.tsx`, `ActiveEditorContext.ts`,
  `Editor.controller.tsx` lines 38–42).
- **One `OpenEditorsStore`**, keyed by path, is the source of truth for every open editor; the
  artifacts panel and pending counts read it via `useOpenEditors`
  (`src/renderer/src/editor/open-editors-store.ts`, `useOpenEditors.ts`,
  `src/renderer/src/artifacts/useOpenArtifacts.ts`, `editor/useEditorPendingCounts.ts`).
- **Agent editor tools target "the active path"** — `EditorToolsBridge` passes `activePath` (from the
  single `OpenFilesNav`) and a path→editor `resolve`/`ensure` over the single store; the read tools
  (`get_current_selection`, `list_open_files`) report THE active file
  (`src/renderer/src/editor/EditorToolsBridge.tsx`, `useEditorTools.ts`,
  `editor-resolver.port.ts`). **This is the key risk** — see Open questions.
- **Ctrl/Cmd+K** reads the single active editor to hand focus back
  (`src/renderer/src/rail/ChatShortcutBridge.tsx`).

## Design: a group is the existing single-editor unit, lifted up

Keep the per-file machinery exactly as-is (`EditorController`, `useEditorFileSync`, the one
`OpenEditorsStore` keyed by path). Add **above** it the concept of editor groups:

- **A file lives in at most one group at a time** (v1 invariant). The single path-keyed
  `OpenEditorsStore` stays the source of truth for mounted editors and artifacts — no per-group store,
  no duplicate editors — because the artifacts/pending-count readers already fold across ALL open
  editors regardless of pane. This avoids a same-file-in-two-panes refactor (deferred).
- **Group layout state** is a small pure module: an ordered list of groups, each `{ id, open:
OpenFiles }`, plus a `focusedGroupId`. v1 caps the list at two groups. The existing `open-files-logic`
  functions operate **inside** one group's `open`; the new module routes a command (open/close/activate)
  to a group by id and maintains the focused-group + the two-group cap. App holds this one state instead
  of one `OpenFiles`.
- **Focused active path** = the focused group's `open.active`. `ActiveEditorProvider` keeps ONE active
  slot, but only the `EditorController` that is active **in the focused group** registers — so "the
  active editor" stays single and unambiguous, and every existing reader (agent tools, Ctrl/Cmd+K,
  same-file panel commands) keeps working untouched.
- **Agent tools** keep their path-addressed contract (PR #58 already made the acting/insert tools take
  an explicit `path` and open-on-demand). Only the two **read** tools that reference "the active file"
  change: `activePath` becomes the **focused** group's active path; `ensure`/`resolve` are unchanged
  (still path-keyed over the one store). The agent never sees "groups" in v1 — it still addresses files
  by path. (Whether the agent should be able to target a specific pane is deferred — Open questions.)
- **Layout**: the editor column renders one `EditorGroupView` per group inside the existing rounded
  surface, side by side via flex; the split toggle adds/removes the second group. The per-group tab
  strip gains a "focus this group" affordance (clicking any tab or the pane focuses the group).

This keeps every step small because each layer (group-state module → focused-active wiring → layout →
tools read-path → e2e) lands independently green on top of the unchanged per-file stack.

## Done

- The writer can click a "Split editor" control to split the editor column into two side-by-side
  panes; each pane has its own tab strip and its own active file. Opening a file from the explorer
  opens it in the **focused** pane. Clicking a pane (or one of its tabs) focuses it. A "close split"
  control collapses back to one pane (its files merge into the remaining pane, or the second pane's
  files close — settled in Open questions).
- Agent tools, Ctrl/Cmd+K, suggestions bar, and the artifacts panel all act on the **focused** pane's
  active file; nothing regresses for the single-pane case.
- `npm run lint`, `npm run test` (incl. e2e coverage audit), `npm run type-coverage`, `npm run build`
  green; for the UI `npm run test:e2e` green, including a new real-app split-view spec.
- Both locales (`en.json` + `es.json`) carry every new key.

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[frontend]` **Editor-group layout state (pure module, no React).**
   - `src/renderer/src/editor/editor-groups-logic.ts`: a pure model over the existing `OpenFiles`.
     Type `EditorGroup = { readonly id: string; readonly open: OpenFiles }`;
     `EditorGroups = { readonly groups: readonly EditorGroup[]; readonly focusedGroupId: string }`.
     Functions (all pure, reusing `openFile`/`openFileInBackground`/`closeFile` from `open-files-logic`):
     `singleGroup(): EditorGroups` (one empty group), `splitEditor(state)` (add a second empty group,
     cap at 2, focus the new one — no-op if already two), `closeSplit(state)` (back to one group; the
     surviving-files rule from Open question Q2), `focusGroup(state, id)`,
     `openInFocused(state, path)` / `openInFocusedBackground` / `closeInGroup(state, id, path)`
     (route to a group, then delegate to `open-files-logic`), and a `closePathEverywhere(state, path)`
     used by the deleted-files bridge (a deleted file may live in either pane). Stable references on
     no-op (mirror `open-files-logic`).
   - `__tests__/editor-groups-logic.test.ts`: split caps at two; open routes to focused group; focus
     switches; closeSplit merges/closes per Q2; deleted-path closes in both panes; no-ops keep refs.
   - Pure data/calc only — no `App` wiring yet, so this lands green in isolation.

2. `[frontend]` **Per-group nav context + focused-active seam (no layout change yet).**
   - Extend `OpenFilesContext.ts`: add a `groupId` to the nav so a command knows which group it acts
     in, and keep `activePath` = the **focused** group's active. Introduce a tiny
     `FocusedGroupContext.ts` exposing `{ focusedGroupId, focusGroup, isSplit }` for the layout/tab
     strip to read and drive. Keep the existing `OpenFilesNav` shape additive (don't break current
     consumers).
   - `App.tsx`: replace `useState(noOpenFiles)` with `useState(singleGroup)` and derive the focused
     group's `OpenFilesNav` from `editor-groups-logic` (commands call the new routed functions). Still
     render ONE `EditorStack` fed by the focused group (so behaviour is identical to today) — this step
     is the state swap + context, not the visible split. `DeletedFilesBridge` uses
     `closePathEverywhere`.
   - Tests: a small `App`-level or context test that opening/closing still works and `activePath`
     tracks the focused group. No e2e here (no user-visible change yet).

3. `[frontend]` **Focused-group gating of the single active-editor slot.**
   - `Editor.controller.tsx` + `EditorStack.tsx`: thread which group a stack belongs to, and have the
     `register(editor)` effect fire only when the controller is active **and** its group is focused
     (read `FocusedGroupContext`). Pass `groupId` down so a controller can tell. The
     `OpenEditorsStore.mount/markReady/remove` calls stay unconditional (every open editor still
     participates in artifacts/pending counts regardless of focus).
   - Tests: extend `Editor.controller.test.tsx` — registers only when active and focused; a focused
     switch moves the active slot to the newly focused group's active editor; unfocused active editor
     does not own the slot.
   - Still one stack rendered, so this is green; it just makes the slot focus-aware ahead of the split.

4. `[frontend]` **Editor-group view + side-by-side layout + split/close controls.**
   - `src/renderer/src/editor/EditorGroup.view.tsx` (or `.tsx`): wraps today's `EditorStack` body for
     one group, adds an `onFocus`/click handler that calls `focusGroup`, and a focused-vs-unfocused
     visual treatment (token-based border/opacity — Motion for the transition).
   - `EditorStack.tsx` / a new `EditorColumn.tsx`: render one `EditorGroup` per group from
     `editor-groups-logic`, side by side via flex (50/50, `min-w-0`), with a split toggle (lucide
     `Columns2`/`PanelRight`-style icon, no hand-rolled SVG) in the tab strip's right cluster
     (next to settings) — "Split editor" when single, "Close split" when split. Base UI, tokens,
     Motion, `t()`, BOTH `en.json` + `es.json`.
   - `App.tsx`: render the multi-group column instead of the single stack; the explorer's `onSelect`
     opens into the focused group (already wired via step 2).
   - Tests: `EditorGroup.view` renders its tab strip + body and fires focus on click;
     column renders one group when single and two when split; the toggle calls split/closeSplit.
   - Green: with one group it is visually identical to today; split shows two panes.

5. `[frontend]` **Agent read-tools + Ctrl/Cmd+K follow the focused pane.**
   - `EditorToolsBridge.tsx`: `activePath`/`openPaths` now come from the focused group via the new nav
     (the focused group's active path; `openPaths` still the whole store's keys — every open file is
     addressable regardless of pane). `resolve`/`ensure` are unchanged (path-keyed). No change to the
     acting/insert tools — they already take explicit `path`.
   - `ChatShortcutBridge.tsx` already reads `useActiveEditor().editor`, which step 3 made the focused
     group's editor — assert (don't re-wire) via a test.
   - Tests: extend `EditorToolsBridge.test.tsx` — `get_current_selection`/`list_open_files` report the
     **focused** group's active file; switching focus changes the reported active; a file open in the
     unfocused pane is still resolvable/actable by path.

6. `[e2e]` **Manifest id + real-app split-view spec.**
   - Add `feature:split-view` to `e2e/coverage-manifest.ts` and a `*.e2e.ts` (pattern:
     `e2e/editor.e2e.ts`) that: opens a file, clicks "Split editor", opens a second file (lands in the
     focused pane), asserts two panes each show their file, clicks the other pane to focus it and
     asserts focus moved, then "Close split" collapses to one. Manifest id + spec in the SAME commit.
   - If feasible in the same spec, drive the agent to act on a file and assert it targets the focused
     pane's active file (covers the step-5 contract); otherwise leave agent-targeting to the existing
     agent e2e and keep this spec layout-focused.

7. `[docs]` Remove this plan file in its own `docs:` commit once all steps ship (`finish-plan` does it).

## Constraints

- **Reuse the single path-keyed `OpenEditorsStore` and per-file `EditorController` untouched.** A file
  is open in at most one pane (v1). No second store, no duplicate editors — the artifacts/pending-count
  readers already fold across all open editors.
- **Exactly one active-editor slot.** `ActiveEditorProvider` stays single; only the focused group's
  active controller registers. Every existing reader of `useActiveEditor().editor` keeps working
  unchanged.
- **Agent tool wire contract is unchanged** — tools stay path-addressed (PR #58); only the two read
  tools' "active path" becomes the focused pane's. No new agent tool, no schema change. Validate the
  read-tool change with the agent-facing test, not only layout tests (per memory: agent tool changes
  need real-agent-shaped validation).
- Frontend conventions: view/controller split, design tokens only (keep our palette), Base UI, Motion,
  `t()` for every string in BOTH locales, no hand-rolled SVG (lucide icons), `Scrollable` for overflow.
- `renderer` rules: no `document.querySelector` to drive a sibling — focus flows through
  `FocusedGroupContext`; `window.api` only in adapters (no new adapters needed here).
- Minimal diff / YAGNI; no new dependency; no `as`/`@ts-ignore`/non-null `!`.

## Open questions

- **Q1 — Should the agent be able to target a specific pane?** v1 says **no**: tools stay path-keyed and
  read-tools report the focused pane. A path can only be open in one pane (v1), so "which pane" is
  derivable from the path. If a future version lets the same file open in two panes, the agent tools
  need a pane/group selector — **deferred**, flagged as the main risk. _Proposed: SETTLED for v1 (no
  pane targeting); confirm with the user._
- **Q2 — On "Close split", what happens to the second pane's files?** Two options: (a) **merge** the
  second pane's open files into the surviving pane (no data loss, tabs accumulate), or (b) **close**
  the second pane's files (simpler, but closes editors the user opened). _Proposed: merge into the
  surviving pane and keep the focused pane's active file active. Confirm with the user._
- **Q3 — Same file in two panes?** Disallowed in v1 (the single store is path-keyed). Opening a file
  already open in the other pane should **focus that pane and activate the file there** (rather than a
  no-op or a duplicate). _Proposed: focus-and-activate-existing; confirm._
- **Q4 — Split orientation & resize.** v1: horizontal (side by side), fixed 50/50, no drag handle.
  Vertical split, a draggable divider, and >2 panes are **deferred**.
- **Q5 — Persistence.** v1 does not persist the split across restarts (the current open-files set isn't
  persisted either). Deferred.
