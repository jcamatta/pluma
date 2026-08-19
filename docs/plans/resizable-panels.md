# Plan: Draggable resize handles for the explorer and chat-rail panels

## What & why

Today the explorer column and the chat rail are fixed-width: `App.tsx` renders each in a `flex-none`
wrapper whose width is a hard CSS variable (`--explorer-w: 280px`, `--rail-w: 360px` in `App.css`).
The user wants to "drag and extend" those panels — grab the seam between explorer↔editor or
editor↔rail and drag to set the width, with sensible min/max clamps so a panel can't collapse or
swallow the editor. The pattern to adapt is serene's `Drawer` (`.references/serene/src/frontend/
components/Drawer.tsx`): a thin `cursor-col-resize` strip using pointer-capture + `clientX` delta,
side-aware direction, and a `clamp`. We build ONE reusable handle component, a small pure
width-logic module, and a hook that owns the two widths, then wire both seams in `App.tsx`.

## Anchors (reuse these, don't reinvent)

- **Three-panel layout:** `src/renderer/src/App.tsx` — explorer wrapper (`flex-none`, `width:
var(--explorer-w)`), editor wrapper (`flex-1 min-w-0`), rail wrapper (`flex-none`, `width:
var(--rail-w)`). The two seams to make draggable are explorer↔editor and editor↔rail.
- **Fixed widths / tokens:** `src/renderer/src/App.css` — `--explorer-w: 280px; --rail-w: 360px`
  live in the `@theme inline`/layout block (commented "ported verbatim from the design"). These are
  the default widths the hook seeds from.
- **Serene drag pattern to adapt:** `.references/serene/src/frontend/components/Drawer.tsx` —
  `handlePointerDown/Move/Up`, `setPointerCapture`, `delta = clientX - startX`, `direction = side ===
'left' ? 1 : -1`, `clamp(value, min, max)`, and the absolute thin strip
  (`w-1 cursor-col-resize hover:bg-... active:bg-...`). We take the math + the strip, NOT serene's
  drag-to-close behavior (closing is already owned by `usePanels`/`EdgeTab`).
- **Persisted-clamped-value precedent:** `src/renderer/src/editor/useEditorZoom.ts` +
  `editor-zoom-logic.ts` — a hook that holds a value, persists it to `localStorage` under a
  `*_STORAGE_KEY`, seeds via a pure `readStored*(raw): T` reader, and clamps via a pure
  `clamp*`. This is the in-repo shape to mirror IF we persist widths (see Open question 1).
- **Panel roots (unchanged by this plan):** `src/renderer/src/explorer/Explorer.controller.tsx`,
  `src/renderer/src/rail/ConversationRail.controller.tsx`. Each already fills its wrapper (`h-full`);
  we resize the wrapper in `App.tsx`, not the panel internals.
- **Renderer no-DOM-tree-reaching rule:** never `document.querySelector` a sibling to read/set its
  width. The width state lives in a hook in `App.tsx` and flows down by prop/inline style; the handle
  reports drag deltas up via a callback. (frontend-engineer.md: "register a handle via context / drive
  by props — never reach across the DOM".)

## Done

- The user can drag the seam between the explorer and the editor to widen/narrow the explorer, and
  the seam between the editor and the rail to widen/narrow the rail. The editor takes the remaining
  space (`flex-1`), so it shrinks/grows as the side panels change.
- Each panel is clamped to a min and a max width; dragging past a bound stops at the bound (no
  collapse, no editor starvation). Cursor shows `col-resize` over the handle; the handle has an
  accessible name and is keyboard-focusable (Open question 3 decides whether arrow-key resize ships
  in v1).
- A handle only renders for a panel that is open; when a panel is collapsed (`EdgeTab`), its handle
  is gone.
- Widths persist or reset per Open question 1 (the resolution there sets whether Step 1 seeds from
  `localStorage` or from the CSS defaults each launch).
- Green: `npm run lint`, `npm run test` (incl. the e2e coverage audit), `npm run type-coverage`,
  `npm run build`; and `npm run test:e2e` for the new resize spec.

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[frontend]` Pure width logic + the panel-width hook.
   - `src/renderer/src/layout/panel-width-logic.ts` — pure calculations, no DOM:
     `clampWidth(side-bounds)(value): number`; the per-side bounds + default constants
     (`EXPLORER_MIN/MAX/DEFAULT`, `RAIL_MIN/MAX/DEFAULT` — DEFAULTs mirror the current `--explorer-w
280` / `--rail-w 360`); `nextWidth(startWidth, deltaX, side): number` (applies `direction = side
=== 'left' ? +1 : -1` then clamps); and — only if Open question 1 resolves to "persist" — a
     `readStoredWidth(raw): number` reader and the `*_STORAGE_KEY`s, mirroring `editor-zoom-logic`.
   - `src/renderer/src/layout/usePanelWidths.ts` — owns `explorerWidth` / `railWidth` state, seeds
     from defaults (or `localStorage` per Q1), and exposes a stable
     `beginResize(panel) → { onDelta(deltaX), onCommit() }`-style API (or `resize(panel, deltaX)` +
     `commit(panel)`), persisting on commit if Q1 = persist. Pure math delegates to
     `panel-width-logic`; the hook is the thin action layer (mirrors `useEditorZoom`).
   - `src/renderer/src/layout/__tests__/panel-width-logic.test.ts` and
     `usePanelWidths.test.ts(x)` — clamp at both bounds for both sides; `nextWidth` direction
     (left grows on +deltaX, right grows on −deltaX); seed = default (and round-trips through storage
     if persisting). >30 lines of logic, so it lands with these tests.
   - Delivers the state + math with zero UI wiring yet, so it lands green on its own.

2. `[frontend]` The reusable `ResizeHandle` plain component.
   - `src/renderer/src/components/ResizeHandle.tsx` — a self-contained visual/interactive primitive
     (plain `Name.tsx`, local UI state only): props `side: 'left' | 'right'`, `onResize(deltaX:
number): void`, `onResizeEnd(): void`, and an accessible `label: string`. Internals adapt
     serene's `Drawer` seam: `onPointerDown` captures the pointer + records `startX`; `onPointerMove`
     computes `deltaX = event.clientX - startX` and calls `onResize(deltaX)`; `onPointerUp` releases
     capture and calls `onResizeEnd()`. Styling is tokens-only — a thin strip,
     `cursor-col-resize`, a hover/active accent on a token (e.g. `action-primary`), no arbitrary
     bracket values. Interactive element is a Base UI primitive (not a raw `<div>` acting as a
     control); hover/press feedback via Motion (`whileHover`/`whileTap`), consistent with `EdgeTab`.
     `aria-label={label}`, focusable; `role`/`aria-orientation` as a separator.
   - `src/renderer/src/components/__tests__/ResizeHandle.test.tsx` — pointer-down→move→up fires
     `onResize` with the running delta and then `onResizeEnd`; the label is exposed as the accessible
     name. (Drag math is unit-tested in Step 1's logic; this test covers the event wiring.)
   - Reusable across BOTH seams; carries no width state itself (it reports deltas, the hook owns
     width) — this keeps it a generic primitive in `components/` and respects no-DOM-reaching.

3. `[frontend]` Wire both seams into the app shell + i18n.
   - `src/renderer/src/App.tsx` — call `usePanelWidths()`; drive the explorer wrapper width from
     `explorerWidth` and the rail wrapper width from `railWidth` (inline style, replacing
     `var(--explorer-w)` / `var(--rail-w)`); render a `ResizeHandle side="left"` at the
     explorer↔editor seam (only when `panels.explorerOpen`) and a `ResizeHandle side="right"` at the
     editor↔rail seam (only when `panels.railOpen`), each wired to the matching `resize`/`commit`
     callbacks. Add `userSelect: none` while dragging so a drag doesn't select editor text (handled
     in the handle or a small flag — keep it minimal).
   - `src/renderer/src/locales/en.json` + `es.json` — handle labels (e.g.
     `layout.resizeExplorer` / `layout.resizeRail`), BOTH locales (parity test enforces).
   - No new test file required (App wiring is exercised by the e2e in Step 4); keep the diff under the
     30-line "must touch a test" rule, or if it exceeds it, add a focused `App` layout test asserting
     each handle renders only for its open panel.
   - Leaves `--explorer-w` / `--rail-w` in `App.css` only if still referenced elsewhere; otherwise
     remove the now-dead vars in this step (grep first — Constraint below).

4. `[e2e]` Manifest id + real-app resize spec.
   - `e2e/coverage-manifest.ts` — add a `feature:resizable-panels` id.
   - `e2e/resizable-panels.e2e.ts` (`@e2e feature:resizable-panels`) — launch the built app on a temp
     folder, locate the explorer resize handle by its accessible label, drag it right by N px
     (`mouse.down`/`move`/`up` or `dragTo`), assert the explorer wrapper got wider; drag past the max
     and assert it stops at the clamp; repeat for the rail handle (drag left to widen). If Q1 =
     persist, relaunch and assert the dragged width survived. Manifest id + spec ship in the SAME
     commit (audit rule).

5. `[docs]` Remove this plan file in its own `docs:` commit once all steps ship (done by
   `finish-plan`).

## Constraints

- **No DOM-tree reaching (lint-enforced):** the handle never reads or sets a sibling panel's width
  via `document.querySelector`; it reports deltas upward and the `App`-level hook owns the widths,
  flowing them down by inline style. (frontend-engineer.md / `rendererNoDomTreeReaching`.)
- **Component roles:** `ResizeHandle` is a plain `Name.tsx` (self-contained, local UI state only) —
  not a `*.view.tsx` (it has interaction) and not a controller (no hooks/IPC). `usePanelWidths` is a
  hook; pure math is in `panel-width-logic.ts` (Data/Calc/Action split). No `window.api` involved at
  all — this is pure layout state, so no ports/adapters and no TanStack Query.
- **Tokens only:** widths are numeric px state, but every color/cursor/spacing uses existing tokens
  and the standard scale — no arbitrary bracket values (`w-[417px]` is fine as an _inline style_
  value driven by state, but Tailwind class widths/colors must be token utilities). The drag accent
  reuses an existing token (e.g. `action-primary`); don't invent one.
- **Base UI + Motion:** the handle is a Base UI primitive with Motion hover/press feedback (mirror
  `EdgeTab`); respect reduced-motion. Consult `docs/motion.dev.react.llms.txt` before animating.
- **No new dependencies.** Pointer events + `localStorage` are native; no resize library.
- **Min/max invariants:** explorer and rail each clamp to their own `[MIN, MAX]`; the editor stays
  `flex-1 min-w-0` so it absorbs the remainder and can't be pushed below its own min by a side panel
  at max. Pick MIN/MAX so `explorerMAX + railMAX` still leaves a usable editor at common window
  widths (see Open question 2).
- **Minimal diff / don't break collapse:** panel open/close stays owned by `usePanels` + `EdgeTab`;
  this plan only adds width control to the already-open panels. Do NOT port serene's drag-below-min
  auto-close. If `--explorer-w`/`--rail-w` become unreferenced, remove them in Step 3 (grep the repo
  first); if anything else still reads them, leave them.
- **Both locales** for the handle labels; **e2e manifest id + spec in the same commit.**

## Open questions

- **1. Do chosen widths persist across sessions?** OPEN — must be settled before Step 1 is sized.
  - _Reset each launch:_ `usePanelWidths` seeds from the CSS defaults (280 / 360) every time; no
    `localStorage`, smaller diff, no Step-4 relaunch assertion. Simplest.
  - _Persist:_ mirror `useEditorZoom`/`editor-zoom-logic` exactly — `*_STORAGE_KEY`, a pure
    `readStoredWidth(raw)`, persist on resize-commit, seed from storage. Adds the relaunch assertion
    to Step 4. Recommended for a "VS Code for writers" feel, but it's a product decision — **ask the
    user.** (Note: settings persistence elsewhere uses `localStorage` via `settings.ts`/`useSettings`
    and `useEditorZoom`; either keying scheme fits — global, not per-workspace, unless the user wants
    per-folder widths, which would widen scope.)
- **2. Exact MIN / MAX / DEFAULT px for each panel?** OPEN. DEFAULTs are the current 280 (explorer) /
  360 (rail). Proposed bounds to confirm: explorer `[200, 480]`, rail `[300, 560]` (serene used
  `min 200 / max 600 / default 288` for its drawers). Needs the user's call so the editor stays
  usable at the app's minimum window width — confirm before Step 1.
- **3. Keyboard resize in v1?** OPEN. The handle is focusable with a `separator` role; whether
  Left/Right arrow keys nudge the width by a fixed step in v1 (vs. pointer-only, keyboard deferred)
  is a scope choice. Pointer-only keeps Step 2 smaller. **Default to pointer-only unless the user
  asks for keyboard resize**; if added, cover it in the Step 2 test.
- **4. Should a resize handle hint be discoverable** (e.g. a subtle always-on seam vs. hover-only)?
  Minor visual polish — follow serene (hover/active accent on a thin always-present strip) unless the
  user prefers otherwise. Not blocking.
