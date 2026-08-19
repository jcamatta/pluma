# Plan: Editor viewport — persistent scrollbar + wider zoom-out range

## What & why

Two small, independent editor-viewport improvements, both purely in the renderer:

- **(a) A visible vertical scrollbar** on the right of the manuscript. Wheel scrolling already works
  (the manuscript is a Base UI `ScrollArea` via the shared `Scrollable`), but the Base UI scrollbar
  only shows itself while the area is hovered/scrolling and otherwise fades out — for large files the
  user wants the scrollbar to **stay visible** as a position cue. The thumb is already styled
  (`bg-surface-2`); the change is to keep the scrollbar mounted and visible regardless of
  hover/scroll state, opt-in so existing `Scrollable` callers (tab strip, rail, composer) are
  unaffected.
- **(b) A smaller minimum zoom** so the camera can pull back further than today's floor. The zoom
  floor is a single constant (`MIN_ZOOM = 0.75` in `editor-zoom-logic.ts`); lower it so the manuscript
  can shrink further. No new control — the existing ctrl/cmd-wheel zoom and persisted value already
  drive it; only the clamp floor moves.

Neither part adds an IPC channel, a use case, or a user-facing string. There is no backend or shared
contract work, and no new e2e coverage-manifest id (no new IPC channel a user triggers — the changes
are local CSS state + a `localStorage`-backed clamp). Verification is via unit tests plus the existing
editor e2e specs staying green.

## Anchors (reuse these, don't reinvent)

- Zoom math: `src/renderer/src/editor/editor-zoom-logic.ts` — `MIN_ZOOM`, `MAX_ZOOM`, `ZOOM_STEP`,
  `clampZoom`, `readStoredZoom`. Tests: `src/renderer/src/editor/__tests__/editor-zoom-logic.test.ts`
  (and the hook test `useEditorZoom.test.tsx`, which asserts clamp behaviour at the floor/ceiling).
- Shared scroll container: `src/renderer/src/components/Scrollable.tsx` — Base UI `ScrollArea.Root` /
  `Viewport` / `Scrollbar` / `Thumb`. The `Scrollbar` accepts `keepMounted` (Base UI prop; default
  `false` removes it from the DOM when the area isn't scrollable) and exposes `data-hovering` /
  `data-scrolling` state attributes that govern default visibility. Axis classes:
  `src/renderer/src/components/scrollbar-axis.ts`. Tests:
  `src/renderer/src/components/__tests__/Scrollable.test.tsx`, `scrollbar-axis.test.ts`.
- Where the editor mounts the scroll area: `src/renderer/src/editor/EditorManuscript.tsx` — the
  `<Scrollable className="min-h-0 flex-1" contentClassName="flex min-h-full px-10 py-10"
scrollbarClassName="py-4">` wrapping `<EditorContent>`. Height is bounded by the flex chain
  (`EditorSurface.view.tsx` → container `flex min-h-0 flex-1`), so overflow already occurs.
- Manuscript/scrollbar CSS lives in `src/renderer/src/App.css`; the `.ProseMirror` font-size uses
  `var(--editor-zoom, 1)` (line ~194). No project CSS currently targets the scroll-area scrollbar, so
  its visibility today is Base UI's hover/scroll default.

## Memory constraints folded in

- **Content-sized `Scrollable` height goes on `viewportClassName`, not `Root`** — the editor's
  manuscript is flex-sized (height already bounded), so this trap does not bite here; do **not** move
  any height onto the Root. Keep the existing class placement.
- **Base UI `ScrollArea` + ProseMirror** — PM `scrollIntoView` can't scroll the Base UI viewport
  (handled elsewhere via native `element.scrollIntoView`); this plan does not touch programmatic
  scrolling, so leave that path alone.
- **No hand-rolled SVG / Base UI primitives only** — the scrollbar is the existing Base UI
  `ScrollArea.Scrollbar`/`Thumb`; no new SVG, no raw elements.
- **Design tokens only** — the thumb is already `bg-surface-2`; reuse existing tokens, no arbitrary
  bracket values, no new color/spacing.

## Scope

- IN: an opt-in "persistent scrollbar" mode on `Scrollable` (keep mounted + visible regardless of
  hover/scroll), turned on for the editor manuscript; a lower `MIN_ZOOM`.
- OUT (not this change): a zoom percentage indicator / zoom controls UI; changing `MAX_ZOOM`,
  `ZOOM_STEP`, or `DEFAULT_ZOOM`; horizontal scrollbar changes; restyling the rail/composer/tab-strip
  scrollbars; any backend/IPC work; an editor-scroll e2e (no new channel — covered by the audit not
  requiring one and existing editor specs staying green).

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[frontend]` Lower the minimum zoom. **(part b)**
   - `src/renderer/src/editor/editor-zoom-logic.ts`: lower `MIN_ZOOM` from `0.75` to the agreed floor
     (see Open question Q1 — propose `0.5`). One-line constant change; `clampZoom` / `readStoredZoom`
     already key off it.
   - Update `src/renderer/src/editor/__tests__/editor-zoom-logic.test.ts`: the clamp-below-min case
     asserts the new floor (the existing `clampZoom(0.1)` test now expects the lower value — pick a
     test input strictly below the new floor so it still exercises clamping). Hook-level
     `useEditorZoom.test.tsx` clamp tests already use out-of-range inputs (`setZoom(10)`,
     `readStoredZoom('9')`) keyed off the ceiling, so they keep passing; add/adjust a below-floor case
     if one is asserted against the old `0.75`.
   - Delivers: the manuscript can zoom out further. Lands with the updated logic test (the change is a
     constant + its test, well under budget).

2. `[frontend]` Add a persistent-scrollbar mode to the shared `Scrollable`. **(part a, infra)**
   - `src/renderer/src/components/Scrollable.tsx`: add an opt-in boolean prop (e.g. `persistent`,
     default `false`) that, when set, (i) passes `keepMounted` to `ScrollArea.Scrollbar` so it stays
     in the DOM, and (ii) applies token-only visibility classes that keep the thumb visible
     independent of `data-hovering`/`data-scrolling` (e.g. force `opacity-100`, no fade), instead of
     Base UI's default reveal-on-interaction. Default path is byte-for-byte the current behaviour, so
     the tab strip / rail / composer callers are unchanged.
   - Keep the change pure styling + a prop; no new logic file needed unless a class string grows large
     enough to warrant a `*-logic.ts` helper (mirror `scrollbar-axis.ts` if so — a tiny pure function
     returning the persistent-vs-default class fragment, unit-tested, since the scrollbar only mounts
     under real layout jsdom lacks).
   - Tests: extend `Scrollable.test.tsx` to assert the persistent prop renders children (smoke), and —
     if a class-fragment helper is extracted — cover it in a sibling `*-logic` test the way
     `scrollbar-axis.test.ts` does. Pure-string/prop work; small.
   - Delivers: a reusable always-visible scrollbar mode; not yet wired to the editor.

3. `[frontend]` Turn the persistent scrollbar on for the editor manuscript. **(part a, wire-up)**
   - `src/renderer/src/editor/EditorManuscript.tsx`: pass the new `persistent` prop on the
     `<Scrollable>` wrapping `<EditorContent>`. No other caller changes.
   - Tests: `EditorManuscript.test.tsx` already renders the surface; extend it to assert the
     persistent scrollbar is requested (e.g. the prop reaches `Scrollable` / a stable marker is
     present) without depending on real layout the scrollbar needs to mount.
   - Delivers: large files in the editor show a steady vertical scrollbar on the right. Small diff.

4. `[docs]` Remove this plan file in its own `docs:` commit once steps 1–3 ship (handled by
   `finish-plan`).

## Done

- In the editor, opening/scrolling a file taller than the viewport shows a vertical scrollbar on the
  right that **stays visible** (doesn't fade out when the pointer leaves), and wheel scrolling still
  works. Other scroll areas (rail, composer, tab strip) look and behave exactly as before.
- Ctrl/Cmd + wheel can zoom the manuscript out to the new lower floor (further than today's 75%), the
  value persists across reloads, and it still can't exceed the existing ceiling.
- `npm run lint`, `npm run test` (incl. the e2e coverage audit), `npm run type-coverage`, and
  `npm run build` are green. For UI changes also `npm run test:e2e` green — existing editor specs
  unaffected; no new spec/manifest id is added (no new IPC channel).

## Constraints

- **Frontend conventions:** view/controller/plain split (the only views touched are pure layout —
  `EditorManuscript.tsx` stays a pure props render; `Scrollable.tsx` stays a plain primitive); design
  tokens only (reuse `surface-2`, standard scale — no arbitrary bracket values, no new color); Base UI
  `ScrollArea` (no hand-rolled SVG, no native `overflow-*` to scroll); animation, if any, via Motion
  and reduced-motion-aware — but prefer no animation here (a steady scrollbar shouldn't fade).
- **Minimal diff / YAGNI:** the persistent behaviour is opt-in so no existing `Scrollable` caller
  changes; do not restyle other scrollbars or add zoom UI.
- **No new dependency.** No `as` casts / `@ts-ignore` / `eslint-disable` / non-null `!` — custom CSS
  vars (if needed) typed via `CSSProperties & { '--x': T }`, never a cast.
- **No new user-facing strings** expected — no `t()` keys, so the both-locales rule has nothing to add
  (if a label is somehow introduced, it lands in `en.json` **and** `es.json`).
- **Pure math stays in `*-logic.ts`:** the zoom floor stays a constant in `editor-zoom-logic.ts`
  covered by its existing logic test; any scrollbar class selection that grows non-trivial moves to a
  pure sibling like `scrollbar-axis.ts`.

## Open questions

- **Q1 — new minimum zoom value (open).** Today `MIN_ZOOM = 0.75`. The user wants "a smaller minimum"
  but not a specific number. Proposed `0.5` (manuscript at half size). Needs the human to confirm the
  exact floor before step 1 commits — blocks step 1 only.
- **Q2 — persistent scrollbar always-on vs. editor-only (settled).** Make it an **opt-in prop**,
  enabled only for the editor manuscript (step 3), leaving every other `Scrollable` caller on the
  current fade-on-idle behaviour. This keeps the diff minimal and avoids changing the rail/composer/
  tab-strip look. Revisit globally only if the user later asks.
- **Q3 — animate the scrollbar appearance (settled).** No. A position-cue scrollbar should be steady;
  do not add a Motion fade. (If the persistent thumb ever needs a subtle thicken-on-hover, that is a
  separate, later ask.)
