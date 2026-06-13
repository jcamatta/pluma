# Editor tabs

Turn the editor panel's single-file top bar into a real **tab strip**, built on the Base UI **Tabs** primitive: one tab per open file across the top of the editor area, each showing the file's name, click a tab to make that file active, and a per-tab close button that drops the file from the open set. The strip reflects and drives the open-files state the shell already owns (`open.paths` / `open.active` and the `openFile` / `closeFile` reducers); the settings gear that lives in today's top bar moves to the right edge of the strip.

This is a **renderer-only** feature. No backend, no IPC, no shared contract: switching and closing tabs are pure shell-state changes over data that already crosses the boundary. Opening a tab is already wired — clicking a file in the explorer calls `openFile(current, path)` (`App.tsx`), which adds the path to `open.paths` and makes it active, so the strip is fed directly by that flow. Closing a tab needs no eviction code — removing the path from `open.paths` unmounts that file's `EditorController`, whose existing cleanup calls `unregisterEditor(path)` and tears down its TipTap instance, so the editor and its artifacts (annotations/proposals) go with it.

## Why Base UI Tabs

We use Base UI `Tabs` directly rather than a hand-rolled row of buttons (per the "use Base UI primitives" rule), because the primitive supplies, controlled, exactly what this feature needs:

- **`Tabs.Root`** is controlled by `value` / `onValueChange` — bind `value={open.active}` and `onValueChange={onActivate}`, so activation is structural (no per-tab click handler).
- **`Tabs.Tab value={path}`** automatically carries `data-selected` when it is the active tab — the active styling and accent underline key off that, so no `isActive` flag is threaded through.
- **`Tabs.Indicator`** tracks the active tab through CSS variables (`--active-tab-left` / `--active-tab-width`) — that is the sliding accent underline, native.
- **`Tabs.Panel value={path} keepMounted`** keeps inactive editors mounted in the DOM — exactly our "artifacts survive switching away and back" requirement — so it replaces `EditorStack`'s hand-rolled `className="hidden"` mapping with the primitive (the active panel is shown, the rest get the `hidden` attribute).
- **`render`** on every part lets us compose `Tabs.Tab` with `motion.button` (hover/tap) and wrap the mapped tabs in `AnimatePresence` (enter/exit) — the documented Base UI + Motion pattern.

The one constraint the primitive does not solve is the **per-tab close button**: it cannot be a DOM child of `Tabs.Tab` (a button inside a button). It is rendered as a sibling inside a relatively-positioned per-tab wrapper within `Tabs.List`, overlaying the tab's right edge; Base UI's composite registers tabs through context refs (not direct-child enumeration), so a wrapper does not break roving focus or the indicator's measurement. (Open question below records the fallback if it does.)

## Done

When shipped, with a folder open and at least one file opened:

- The editor panel shows a Base UI `Tabs` strip at the top, one `Tabs.Tab` per file in `open.paths`, each with a document icon and the file's name (basename, `.md` stripped — the label `editorFileName` already derives).
- The **active** tab is visually distinguished (the `Tabs.Indicator` accent underline tracks it, matching the design's current single-tab treatment); inactive tabs are muted.
- **Clicking** a non-active tab makes that file active via `onValueChange`; the previously active editor stays mounted (its `Tabs.Panel` is `keepMounted`), so artifacts survive the switch.
- Each tab has a visible **close** control (an `X` button); clicking it removes that file from the open set without activating it. Closing the active tab activates a neighbour; closing the last tab returns to the existing "No file open" empty state.
- When the open tabs exceed the panel width, the strip **scrolls horizontally** through the shared `Scrollable` (no native scrollbar).
- The **settings** gear sits at the right edge of the strip and still opens the settings dialog.
- The old per-editor `EditorTopBar` is gone (one strip for the panel, not one bar per mounted editor).
- All four checks green (`lint`, `test`, `type-coverage`, `build`) and `test:e2e` green, with a real-app spec driving open → switch → close.

## Steps

### 1. Tab-model calculation — DONE

- **Add** `src/renderer/src/editor/editor-tabs-logic.ts` — a pure calculation `buildEditorTabs(open, fallback)` mapping `OpenFiles` to an ordered `readonly EditorTab[]`, where `EditorTab = { path; name }` and `name` reuses `editorFileName(path, fallback)`. (No `isActive`: Base UI derives the active tab from `Tabs.Root` `value`.) No React, no editor — data over data.
- **Add** `src/renderer/src/editor/__tests__/editor-tabs-logic.test.ts` — covers order preserved from `paths`, `.md`-stripped labels, the fallback label, and the empty-set case.

Delivers the data the strip renders, unit-tested in isolation. Tiny, green on its own.

_Landed: `buildEditorTabs` + `EditorTab` type and its test; 4 tests green, lint clean._

### 2. Horizontal orientation for `Scrollable` — DONE

- **Edit** `src/renderer/src/components/Scrollable.tsx` — add an optional `orientation?: 'vertical' | 'horizontal'` prop (default `'vertical'`, so every current caller is unchanged). When `'horizontal'`, render `ScrollArea.Scrollbar orientation="horizontal"` with horizontal sizing (`h-2` instead of `w-2`) and a horizontally-sized thumb, and let the content lay out in a row that can exceed the viewport width.
- **Add/Edit** `src/renderer/src/components/__tests__/Scrollable.test.tsx` — assert the default stays vertical and that `orientation="horizontal"` renders a horizontal scrollbar. (Add the test file if none exists.)

Delivers the shared primitive the strip needs for overflow, without touching existing usages. Green on its own.

_Landed: `orientation` prop on `Scrollable` (default `vertical`); the axis-class choice extracted to a pure `scrollbar-axis.ts` (`scrollbarAxis`) and unit-tested, since the Base UI scrollbar only mounts under real layout (not jsdom). `Scrollable.test.tsx` keeps a thin children-render test. Lint clean, tests green._

### 3. Tab strip view (Base UI Tabs.List) — DONE

- **Add** `src/renderer/src/editor/EditorTabStrip.view.tsx` — a pure `*.view.tsx` (no hooks, no `window.api`) rendering the strip's contents to be composed **inside** a `Tabs.Root` (provided by `EditorStack` in step 4). Props: `tabs: readonly EditorTab[]`, `activePath: string`, `settingsLabel`, `closeLabel: (name: string) => string`, `onClose: (path) => void`, `onOpenSettings: () => void`. It renders:
  - A horizontal `Scrollable` wrapping `Tabs.List`, which contains, per tab, a relatively-positioned wrapper holding a `Tabs.Tab value={path}` (rendered via `render={<motion.button …/>}` for hover/tap; lucide `FileText` + `name`, muted by default, accent text when `data-selected`) and a sibling close `IconButton` (lucide `X`, `stopPropagation`, `aria-label={closeLabel(name)}`) overlaying the tab's right edge.
  - `Tabs.Indicator` styled from `--active-tab-left` / `--active-tab-width` as a 2px `action-primary` underline, with a CSS transition on position (Base UI's native indicator animation — not a Tailwind `transition-*` on a Motion element).
  - The mapped tabs wrapped in `AnimatePresence` so a closed tab animates out.
  - The settings `IconButton` (lucide `Settings`) pinned at the right edge, outside the scrolling region — same as today's top bar.
  - Tokens only (`action-primary`, `text-*`, `border-(--line)`); no arbitrary/fractional values.
- **Add** `src/renderer/src/editor/__tests__/EditorTabStrip.view.test.tsx` — render the view wrapped in a `Tabs.Root` (with `value` + a spy `onValueChange`); assert a tab per entry, the active tab marked (`data-selected` / accessible selected state), selecting a non-active tab fires `onValueChange(path)`, clicking close fires `onClose(path)` **without** firing `onValueChange`, and the settings button fires `onOpenSettings`.
- **Edit** `src/renderer/src/i18n/locales/en.json` — add `editor.tabs.close` (`"Close {{name}}"`). (`editor.settings` already exists.)

Delivers the strip's presentation, tested against the real Base UI Tabs context. Unused by the app shell at this point (imported only by its test) — green.

_Landed: `EditorTabStrip.view.tsx` (Tabs.List + per-tab close overlay + Tabs.Indicator underline + horizontal Scrollable + settings gear), its test (4 cases, against a real `Tabs.Root`), and the `editor.tabs.close` key. Deviation from the sketch: no `activePath` prop — Base UI surfaces selection as `data-selected` from the controlling `Tabs.Root`, so the view styles off that and never needs the active value. 4 tests green, lint clean._

### 4. Compose Tabs in the panel; retire the per-editor top bar — DONE

- **Edit** `src/renderer/src/editor/EditorStack.tsx` — when a file is open, render a single `Tabs.Root value={open.active} onValueChange={onActivate}` containing: the `EditorTabStrip` view (fed by `buildEditorTabs(open, t('editor.untitled'))`, the `activePath`, and the close/settings callbacks), and one `Tabs.Panel value={path} keepMounted` per open file wrapping its `EditorController` — replacing the hand-rolled `className={… ? 'flex …' : 'hidden'}` mapping. New props: `onActivate`, `onClose` (alongside the existing `onOpenSettings`). The empty-state branch is unchanged. `EditorController` no longer receives `onOpenSettings`.
- **Edit** `src/renderer/src/editor/Editor.view.tsx` — drop `EditorTopBar`; the view renders only `EditorManuscript`. Remove the `fileName` / `settingsLabel` / `onOpenSettings` props.
- **Edit** `src/renderer/src/editor/Editor.controller.tsx` — stop deriving the file name / settings label for the bar and stop passing them (and `onOpenSettings`) to the view; drop `onOpenSettings` from `EditorControllerProps`. (`editorFileName` keeps its caller in `editor-tabs-logic`.)
- **Edit** `src/renderer/src/App.tsx` — pass `onActivate` and `onClose` to `EditorStack`, wired to the existing `setOpen(… openFile …)` / `setOpen(… closeFile …)` it already holds (the same callbacks behind `openFiles.open` / `openFiles.close`).
- **Delete** `src/renderer/src/editor/EditorTopBar.tsx` and `src/renderer/src/editor/__tests__/EditorTopBar.test.tsx` — no remaining users.
- **Edit** the affected tests: `__tests__/EditorStack.test.tsx` (the existing "keeps an editor mounted for every open file" still holds under `keepMounted`; add: a tab per open file renders, selecting a tab switches the visible surface, closing a tab removes it / activates a neighbour, settings fires), `__tests__/Editor.view.test.tsx` and `__tests__/Editor.controller.test.tsx` (drop the top-bar assertions/props).

Delivers the working feature: one Base UI `Tabs` strip drives switching, the per-editor bar is gone and settings lives on the strip. Green at the end.

_Landed. Deviations from the sketch, all deliberate:_

- _**Kept the conditional-mount divs, did not adopt `Tabs.Panel`.** Base UI hides an inactive panel with the HTML `hidden` attribute, which a `display:flex` class (needed to make the editor surface fill height) overrides — so a `Tabs.Panel` would not actually hide. The proven `className={active ? 'flex …' : 'hidden'}` mapping is what `keepMounted` would only have reproduced, so the stack stays as conditional divs inside `Tabs.Root`._
- _**Deleted `Editor.view` (+ test) entirely**, not just emptied it: with the top bar gone it was a pure passthrough to `EditorManuscript`, so the controller now renders `EditorManuscript` directly. `EditorTopBar` (+ test) removed too._
- _**`EditorStack` reads activate/close from `useOpenFiles()`** (the existing `OpenFilesNav` seam, which already carries `open`/`close`) instead of new `App` props — so `App` is unchanged. This also kept `App`'s render function under the 75-line limit._
- _All checks green: typecheck, build, full unit suite (659), type-coverage, lint (the repo-wide `␍` warnings are this worktree's `autocrlf=true` checkout, not these files)._

### 5. End-to-end coverage

- **Edit** `e2e/coverage-manifest.ts` — add `editor-tabs` to `FEATURES`. No new `OPERATIONS`: tabs drive only existing IPC (`folder.list` / `file.read` on open); switching and closing are pure renderer state.
- **Add** `e2e/editor-tabs.e2e.ts` — header `@e2e feature:editor-tabs`. Drives the built app: open a folder seeded with two markdown files, open the second via the explorer so two tabs show, select the first tab and assert its surface becomes visible, then close a tab via its X and assert the tab disappears and the neighbour stays active. Only the native folder chooser is stubbed; real folder/file IPC runs.

Ships the feature id and its real-app spec together so the audit stays green. `e2e/` is weight 0.

### 6. Remove the plan

When every step is shipped and green, delete `docs/plans/editor-tabs.md` as its own `docs:` commit (performed by `finish-plan`).

## Constraints

- **Renderer-only, no IPC.** No new use case, port, adapter, IPC channel, or shared type. Do not add an operation id to the manifest.
- **No new state owner.** Reuse the shell's `open` state and the `openFile` / `closeFile` reducers. `closeFile` already handles the active-fallback and last-tab-empty cases; do not reimplement them.
- **No eviction code.** Closing a tab = removing its path; the existing `EditorController` unmount cleanup (`unregisterEditor`, TipTap teardown) evicts the editor and its artifacts.
- **Base UI Tabs.** Use `Tabs.Root` / `Tabs.List` / `Tabs.Tab` / `Tabs.Indicator` / `Tabs.Panel` directly; `Tabs.Root` is controlled by `open.active` / `onActivate`; inactive panels use `keepMounted`. No raw `<button>` for tabs.
- **Scrollable for overflow.** Strip overflow scrolls through the shared `Scrollable` (extended with a horizontal orientation in step 2); no native `overflow-*` scrollbars.
- **Component-type split.** `EditorTabStrip.view.tsx` is a pure view — no hooks, no `window.api`; tab models, labels, and callbacks arrive via props from `EditorStack` / `App`, and it is composed inside the `Tabs.Root` that `EditorStack` owns.
- **Motion + tokens + `t()`.** Tab hover/tap and enter/exit animate via `motion/react` (`render` prop + `AnimatePresence`); the `Tabs.Indicator` animates via its CSS-variable transition. Colours/spacing from design tokens only (no arbitrary/fractional values). All user-facing text through `t`.
- **One export per file**, exports consolidated at the bottom where a module exposes a symbol plus its type.
- **No new dependencies** (Base UI and Motion are already present).

## Decisions (resolved)

- **Overflow → horizontal `Scrollable`.** When tabs exceed the panel width the strip scrolls horizontally via the shared `Scrollable`, extended with an `orientation` prop (step 2). Auto-scrolling the newly-active tab into view is a later refinement, not in this plan.
- **Close → a visible per-tab `X` button**, click to close. No middle-click or keyboard shortcut in v1.
- **Duplicate basenames → out of scope.** Two open files with the same basename in different folders show identical labels for now; disambiguate by relative path later.

## Open questions

- **Close button vs. `Tabs.List` composite.** The plan renders each tab's close button as a sibling overlaying the `Tabs.Tab` inside a per-tab wrapper. If that wrapper disturbs roving focus or the `Tabs.Indicator` measurement in practice, the fallback is to keep `Tabs.Root` / `Tabs.List` / `Tabs.Tab` for the tabs and position the close button just outside each `Tabs.Tab` (still within the list row). _Lead with the overlay; validate during step 3/4._ — **noted, low risk.**
