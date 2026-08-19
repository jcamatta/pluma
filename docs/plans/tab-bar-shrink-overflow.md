# Plan: Adaptive editor tab bar — shrink-to-fit with an always-visible close button

## What & why

Today the open-file tab strip (`EditorTabStrip.view.tsx`) lays each tab out at its natural content width
and lets the whole row scroll horizontally inside a `Scrollable` once the tabs outgrow the panel. As more
files open the row keeps growing and the user must scroll sideways to reach — and close — tabs that have
slid off the right edge.

Make the strip **adaptive instead of growing**: tabs share the available width, shrinking toward a
min-width (truncating their title with an ellipsis) up to a per-tab max-width budget. Each tab **always
keeps its close `×` visible** so any file can be closed without scrolling. Horizontal scroll remains only
as a true overflow fallback — when even at min-width the tabs can't all fit, the strip scrolls rather than
clipping a tab's close button.

This is a **frontend-only, presentation-layer** change. No IPC, no use cases, no shared contract, no
backend. No change to which files are open or how they're closed — only how the strip sizes and truncates
its tabs.

## Anchors (the real code this touches — reuse, don't reinvent)

- `src/renderer/src/editor/EditorTabStrip.view.tsx` — the strip. A `Scrollable` (horizontal) wrapping a
  `Tabs.List` of `motion.div` tab wrappers, each containing a `Tabs.Tab` (`FileText` icon + `tab.name` +
  optional pending badge) and a sibling `IconButton` close `×` absolutely positioned over the tab's right
  edge (`absolute right-2`; the tab reserves room with `pr-9`). Selection arrives as `data-active`; no
  state here. **This is the only file whose markup/classes change.**
- `src/renderer/src/editor/__tests__/EditorTabStrip.view.test.tsx` — its view test. Renders the strip
  inside a `Tabs.Root`; asserts tab rendering, active marking, badge, activate-on-click, close-without-
  activate, middle-click close, settings. New behavior lands assertions here.
- `src/renderer/src/editor/editor-tabs-logic.ts` — `buildEditorTabs` → `EditorTab { path, name,
pendingCount }`. Pure data-over-data. **No change** (the tab model already carries everything; truncation
  is CSS, not data — see Open question OQ4).
- `src/renderer/src/editor/EditorStack.tsx` — owns `Tabs.Root`, passes `tabs` + label callbacks into the
  strip. **No change.**
- `src/renderer/src/components/IconButton.tsx` — the close `×` button. Reused unchanged; it stays a fixed-
  size flex sibling so it never shrinks.
- `src/renderer/src/components/Scrollable.tsx` — horizontal scroll container; kept as the overflow
  fallback. **No change.**
- `src/renderer/src/components/EdgeTab.tsx` — listed as an anchor for context only; it is the collapsed
  side-panel tab, unrelated to the editor strip. **No change.**
- `src/renderer/src/App.css` — design tokens (`--line`, `--hover`, `--color-*`). Sizing uses standard
  Tailwind width/spacing utilities; no new token needed (see Constraints).

## Design: distribute width, shrink the title only, pin the close button

The strip becomes a flex row whose tabs **share the available width** and shrink the _title_ — never the
icon, badge, or close button:

- **Tab wrapper sizing.** Each per-tab `motion.div` becomes a flex item that:
  - may shrink below content (`min-w-0`) so the title can truncate,
  - has a **min-width** floor — a tab never shrinks past it, so the icon + a few title chars + the close
    `×` always stay on screen, and
  - has a **max-width** cap — a single tab (or a couple of tabs) never sprawls across the whole strip;
    beyond the cap the tab stops growing and the row simply doesn't fill, matching a browser tab strip.
  - With few tabs open, tabs sit at their natural width (bounded by the max); as more open, they shrink
    evenly toward the min. (Whether tabs _grow_ to fill leftover space or only ever shrink from natural
    width is OQ2.)
- **Title truncation.** The `tab.name` moves into its own `min-w-0 truncate` span (the existing
  `overflow-hidden text-ellipsis whitespace-nowrap` pattern, already used in `ExplorerRows.view.tsx` and
  via Tailwind's `truncate`). The `FileText` icon, the pending badge, and the close button stay
  `flex-none` so only the title gives up width. The truncated tab gets a **native `title={tab.name}`
  tooltip** so the full name is still discoverable (same pattern as `ArtifactFileLabel.view.tsx`).
- **Close button always visible.** The close `×` stays a fixed-size element that never shrinks. Two
  equivalent layouts are possible; pick one in OQ3:
  - keep it absolutely positioned over the right edge with the tab reserving room (`pr-9` today) — the
    reserved room is fixed, so it survives shrinking; or
  - make it an in-flow `flex-none` sibling after the truncating title span.
    Either way, because the tab's **min-width ≥ icon + min title + close-button width**, the `×` can never be
    clipped or pushed off — closing any file never requires scrolling.
- **Overflow fallback.** The outer `Scrollable` (horizontal) stays. When the count is high enough that even
  all-at-min-width exceeds the panel, the row overflows and the strip scrolls — but every tab in view
  still shows its close `×`. So scroll is the _last_ resort (genuinely too many files), not the _default_
  (a handful of long names).

### Width thresholds (proposed — exact numbers are open, see OQ1)

Use **standard Tailwind width steps only** (the `w-*`/`min-w-*`/`max-w-*` scale, multiples of `0.25rem`);
no arbitrary bracket values, no fractional steps (per the frontend conventions). Proposed starting points,
to be confirmed by screenshotting the real app at a few file counts:

- **min-width ≈ `min-w-28` (7rem / 112px)** — fits the `FileText` icon, ~4–6 truncated title chars + the
  ellipsis, and the close `×`. The floor below which a tab never shrinks.
- **max-width ≈ `max-w-56` (14rem / 224px)** — the cap a single/under-filled tab never exceeds.
- **truncation:** title span is `min-w-0 truncate` (ellipsis on overflow); full name in `title=`.

These are deliberately flagged as **proposals**; OQ1 settles them against a real screenshot pass.

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[frontend]` Adaptive sizing + always-visible close in the strip.
   - `src/renderer/src/editor/EditorTabStrip.view.tsx`: make the `Tabs.List` row distribute width; give each
     per-tab `motion.div` `min-w-0` + the chosen **min-width** and **max-width** utilities; move `tab.name`
     into a `min-w-0 truncate` span with a `title={tab.name}` tooltip; keep the `FileText` icon, pending
     badge, and close `IconButton` `flex-none` so only the title shrinks. Keep `data-active` underline,
     middle-click close, the pending badge, and the settings gear exactly as-is. Keep the `Scrollable` as
     the overflow fallback.
   - `src/renderer/src/editor/__tests__/EditorTabStrip.view.test.tsx`: extend with assertions that hold in
     jsdom (which has no real layout): the title span carries the truncation classes + a `title` tooltip
     equal to the full name; the close button renders for **every** tab (e.g. with 4–6 tabs, one
     `Close <name>` button per tab is in the document) and is not inside the `Tabs.Tab` button; the
     existing close/activate/middle-click/badge/settings behaviors still pass. (Pixel min/max sizing can't
     be asserted in jsdom — it's verified by the real-app screenshot in step 2; assert the _class
     contract_, not computed widths.)
   - This is a single small view + its test — well within one mini-commit; the data model and labels are
     unchanged, so no i18n or logic edits ride along.

2. `[frontend]` Confirm sizing in the real app and settle the thresholds (no production-code change unless a
   number is wrong).
   - Run the built app, open it with 2, 5, and 10+ files (mix of short and very long names). Screenshot the
     strip at each. Verify: short counts sit at natural width (≤ max), high counts shrink to the min and
     truncate with an ellipsis, **every** visible tab shows its `×`, and the strip only scrolls once tabs
     are all at min-width and still overflow.
   - If a threshold from OQ1 is wrong, adjust the `min-w-*`/`max-w-*` utility in
     `EditorTabStrip.view.tsx` (still a standard scale step) and re-screenshot. Record the final numbers in
     this plan's OQ1 (mark SETTLED) before finishing.
   - No new e2e spec is warranted: this ships **no new IPC channel and no new user operation** — it
     restyles an existing, already-covered strip, so there is no manifest id to add (adding one without a
     channel would turn the audit red). Adaptive _pixel_ layout isn't faithfully assertable through the
     Playwright/jsdom-free DOM without brittle width math; the screenshot pass in this step is the
     evidence. (If the reviewer wants a guard, the only stable e2e-able fact is "with N files open, N close
     buttons are present and clickable" — see OQ5.)

3. `[docs]` Remove this plan file in its own `docs:` commit once the strip ships and OQ1 is settled.

## Done

- Opening many files makes the editor tabs **shrink and truncate** toward a min-width instead of growing
  the row; a single/under-filled tab never exceeds the max-width.
- **Every** tab — at any file count — shows its close `×`; a long title truncates with an ellipsis and
  exposes the full name via the native `title` tooltip.
- The strip scrolls horizontally **only** when all tabs are at min-width and still overflow the panel;
  never as the default for a handful of long names.
- `data-active` accent underline, middle-click close, the pending-suggestion badge, and the settings gear
  are unchanged.
- `npm run lint`, `npm run test`, `npm run type-coverage`, `npm run build` green; the real-app screenshot
  pass (step 2) shows the three behaviors above. OQ1 numbers recorded as SETTLED.

## Constraints

- **Frontend-only, presentation layer.** No `src/shared`, no `src/main`, no IPC, no use case, no new
  dependency. `EditorTabStrip.view.tsx` stays a pure **view** (props only, no hooks/`window.api`/side
  effects); the data model (`editor-tabs-logic.ts`) and labels are untouched.
- **Design tokens + standard scale only.** Colors stay on existing tokens (`--line`, `--hover`,
  `text-text-muted`, `border-action-primary`, …). Widths/spacing use **standard Tailwind steps**
  (`min-w-*`, `max-w-*`, multiples of `0.25rem`) — **no arbitrary bracket values** (`w-[112px]`,
  `text-[13px]`) and **no fractional steps** (`px-3.5`). A needed-but-missing value is a signal to **ask**
  (OQ1), not to hardcode.
- **No hand-rolled SVG**; the close `×` and file icon stay lucide-react (`X`, `FileText`) via `IconButton`.
- **`Scrollable` stays the only scroll mechanism** for the overflow fallback — no native
  `overflow-x-auto`/`scroll` on a div to scroll it (clip-only `overflow-hidden` is fine).
- **Animation via Motion only**; the existing `AnimatePresence` + `layout`/`whileTap` stay. Truncation and
  sizing are static `className`, not Motion props (don't mix Tailwind `transition-*` with Motion).
- **Both locales** only if a string is added. This change adds **no** user-facing string (the `title`
  tooltip reuses `tab.name`, the close label reuses the existing `editor.tabs.close` key), so `en.json` /
  `es.json` are untouched — confirm no new key sneaks in.
- **Minimal diff / YAGNI.** Change only the strip's sizing/truncation markup and its test. Don't refactor
  `buildEditorTabs`, `EditorStack`, or `IconButton`; don't reformat unrelated lines.

## Open questions

- **OQ1 — exact min/max width + truncation thresholds (BLOCKS step 1's final numbers; settle via step 2).**
  Proposed: **min `min-w-28` (7rem)**, **max `max-w-56` (14rem)**, title `truncate` + `title=` tooltip. The
  real numbers must be confirmed by screenshotting 2 / 5 / 10+ open files in the built app and may move to
  an adjacent standard step (`min-w-24`/`min-w-32`, `max-w-48`/`max-w-64`). Record the final values here as
  SETTLED before step 3. _Do not invent a non-scale value to hit a pixel target — ask if the scale can't
  express the desired size._
- **OQ2 — grow-to-fill vs shrink-only.** Should tabs **grow** to fill leftover width when few are open
  (each `flex-1`, evenly filling the strip), or only ever **shrink from natural width** toward the min
  (natural width up to the max, no growing)? Browser tabs grow-to-fill; an IDE editor strip usually does
  _not_ (tabs sit at content width until space runs out). Default proposal: **shrink-only** (content width,
  bounded by max, shrinking toward min as needed) — matches the "VS Code for writers" framing. Confirm with
  the user.
- **OQ3 — close-button layout: absolute-overlay (keep `pr-9` reserved room) vs in-flow `flex-none`
  sibling.** Both keep the `×` always visible. Absolute-overlay is the smallest diff (today's approach,
  just ensure the reserved room is inside the min-width floor); in-flow is cleaner but reflows the title
  width. Default proposal: **keep absolute-overlay** (minimal diff). Confirm.
- **OQ4 — truncation in CSS vs in the model.** Truncation is proposed as pure CSS (`truncate` + `title`),
  leaving `editor-tabs-logic.ts` untouched. Is there any reason to compute a shortened name in the model
  instead (e.g. middle-ellipsis that preserves the file extension, like `my-long-…-draft.md`)? Default:
  **CSS end-ellipsis** (no model change). If middle-ellipsis-preserving-extension is desired, that becomes
  a `[shared]`/logic step with its own test — flag before starting.
- **OQ5 — e2e guard?** This restyles an existing strip and adds no IPC channel/operation, so no manifest id
  is added (adding one without a channel reds the audit). The only stable, non-pixel e2e fact is "with N
  files open, N close buttons are present and clickable without scrolling." Add such a spec, or rely on the
  step-1 view test + step-2 screenshot? Default proposal: **no new e2e** (view test + screenshot suffice).
  Confirm with the user.
