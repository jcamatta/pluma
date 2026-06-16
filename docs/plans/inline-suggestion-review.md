# Inline suggestion review

Move the writing agent's review surface — **annotations, proposals (rewrites), and inserts** — out of
the right rail's "Review" tab and **inline into the editor**, on by default. The user sees every
suggestion as colored diff in the prose and accepts/rejects them in place, managed from a new
two-row editor header (file tabs + a suggestions sub-topbar). The rail goes back to **chat only**.

This is a **presentation move, not a data re-architecture**: the suggestion data already lives in
ProseMirror plugin state inside the editor (`extensions/proposals.ts`, `extensions/annotations.ts`).
The `artifacts/` directory is only a read-only rail view of that state. No backend, IPC, or
agent-tool changes — **frontend + e2e only**.

## Scope: additive in this PR; old review surface removed in a follow-up PR

This PR is **purely additive**. The inline review is built **alongside** the existing rail "Review"
tab and `src/renderer/src/artifacts/` — **both surfaces coexist**, reading the same plugin state.
Nothing is deleted here. A **separate follow-up PR** removes the rail Review tab, deletes
`src/renderer/src/artifacts/`, and drops the old artifact card CSS / i18n keys.

Consequences:

- **No "salvage by deleting".** Pure helpers the inline UI needs (merge+sort by doc position, jump
  scrolling) are written as **new modules under `editor/`**, mirroring the logic in
  `artifacts/to-artifacts.ts` / `artifacts/scroll-target.ts`. `artifacts/` is left untouched so it
  keeps working. The temporary duplication is intentional and is deleted with `artifacts/` in PR 2.
- **Existing e2e stays green.** The rail Review tab still exists, so current specs pass. The new
  feature gets its own isolated e2e spec; the `artifacts` manifest id is kept (removed in PR 2).

## Dependency: PR #58 (`feat/agent-text-authoring`) — MERGED

#58 is merged. **Before step 1, rebase this branch onto latest `main`** (which now contains #58). The
plan targets the post-#58 shape:

- `propose_edit` params are `{ passage, text }`; `insert_at` / `insert_after` exist;
- `acceptProposal` applies **real ProseMirror block nodes** (a parsed `content: JSONContent`);
- `proposal-decorations.ts` is the **block/span red-green** preview via `DOMSerializer` (no
  `diffWords`).

Consequences this plan relies on:

- An **insert** is a proposal with `from === to` (zero-width) and empty `originalText`. The display
  type (rewrite / insert / note) is **derived** from the existing data — no new field for it.
- "Hide all → clean page" is nearly free: a proposal's new content lives only in the decoration (the
  doc still holds the original passage, or nothing for an insert), so hiding = drop the decoration.

## Done

When shipped, with at least one file open and an agent run that produced suggestions:

- The editor shows **all** of the file's suggestions inline at once (rewrites struck-red + green,
  inserts as a green block with a "new line" tag, annotations as an amber highlight), **on by
  default**.
- A per-editor **Hide all / Show all** toggle renders the manuscript clean (no color, inserts gone)
  and back.
- Clicking a rewrite/insert reveals an **accept/reject pill** and a 2px accent **active ring** (on
  click, never on hover); clicking it again toggles off. Accept applies the edit as real nodes;
  reject removes the suggestion.
- Clicking an annotation opens a **floating card** (anchored to the passage, clamped to viewport,
  closes on outside-click/Esc) with the note and a **"Got it"** button that marks it read
  (`pending → read`, shown as a dotted muted underline). No "Ask to revise" this pass.
- The editor header has **two rows**: file tabs (each with a `(N)` pending-count badge) + Settings,
  and a **suggestions sub-topbar** (shown only when the file has suggestions) with the count /
  "All reviewed" state, the Hide/Show toggle, and a **List** popover.
- The **List popover** groups suggestions (Rewrites · Inserts · Notes), previews each in one line,
  jumps to one on row-click (centering it in the viewport), and offers per-row and per-group
  accept / reject / mark-read for pending items.
- The rail Review tab and `src/renderer/src/artifacts/` **still exist** (untouched; removed in PR 2).
- Green: `npm run lint`, `npm run test`, `npm run type-coverage`, `npm run build`, `npm run test:e2e`,
  and the e2e coverage audit (new `inline-suggestion-review` id present with its spec; existing
  `artifacts` id and its spec kept and still passing).

## Steps

Each step is one small, independently green commit. All steps are additive (nothing deleted this
PR). Tags drive the worker agent.

### 1. `[frontend]` Annotation `read` status

- **Change** `src/renderer/src/editor/extensions/annotations.ts`: add `status: 'pending' | 'read'`
  to `Annotation` (new annotations default `pending`); add a `markAnnotationRead({ editor, id })`
  command (a `read` reducer command). Keep ids/mapping as-is.
- **Change** `src/renderer/src/App.css`: add the **read** annotation recipe (dotted `--text-muted`
  underline, text → `--text-secondary`) alongside the existing severity classes.
- **Tests**: `extensions/__tests__/annotations.test.ts` — new annotations are `pending`; `markRead`
  flips to `read`; mapping/remove still hold.
- Delivers the lifecycle the card and list need; no UI yet.

### 2a. `[frontend]` Per-editor visibility + render-all decorations

- **Add** `src/renderer/src/editor/extensions/suggestions-ui.ts`: a small plugin/extension holding
  per-editor UI state read by the decoration builders — `visible: boolean` (default `true`), with a
  `setSuggestionsVisible` command. (The cross-type `activeId` arrives in step 2b.) Register it in
  `extensions/index.ts`.
- **Change** `extensions/proposals.ts` and `extensions/annotations.ts`: their `decorations()` now read
  `suggestions-ui` `visible` and render **all** suggestions when visible (remove the active-only
  `DecorationSet.empty` gating), or nothing when hidden. The plugins keep their own `activeId` for now
  (unchanged in this step) so the existing `getActiveProposalId` / `getActiveAnnotationId` readers in
  `artifacts/` stay green.
- **Change** `extensions/proposal-decorations.ts`: build decorations for **a** proposal (already
  per-proposal post-#58); annotations build one `Decoration.inline` per annotation with its severity
  - read class.
- **Tests**: extend `proposals.test.ts`, `annotations.test.ts`, `proposal-decorations.test.ts`, new
  `suggestions-ui.test.ts` — N suggestions ⇒ N decoration groups; `visible=false` ⇒ empty.
- Delivers all suggestions rendering at once with a working show/hide; no active/pill/card chrome yet.

### 2b. `[frontend]` Single cross-type active id

- **Change** `extensions/suggestions-ui.ts`: add `activeId: string | null` (the single active
  suggestion **across both types**) with a `setActiveSuggestion` command.
- **Change** `extensions/proposals.ts` and `extensions/annotations.ts`: their `decorations()` read the
  active suggestion from `suggestions-ui` (so a proposal and an annotation can't both be active) and
  tag it with an extra `--active` class (ring styled in step 3). **Back-compat:** keep the existing
  `getActiveProposalId` / `getActiveAnnotationId` (and `setActiveProposal` / `setActiveAnnotation`) as
  thin shims that read/write `suggestions-ui.activeId`, so the still-living `artifacts/` readers
  (`useOpenArtifacts.ts`, `ArtifactsPanel.controller.tsx`) keep compiling and passing untouched.
- **Tests**: extend `suggestions-ui.test.ts` / `proposals.test.ts` / `annotations.test.ts` — setting
  active on one type clears the other; the legacy getters delegate correctly.
- Delivers the cross-type active invariant without breaking the old surface.

### 3. `[frontend]` Active ring + click-to-reveal accept/reject pill

- **Change** the proposal decoration path to attach, for the **active** rewrite/insert, a pill
  **widget** (accept ✓ / reject ✗ + a small type label) floated above the suggestion, and the 2px
  `--action-primary` ring on the active container. Clicking a suggestion dispatches
  `setActiveSuggestion` (toggling off if already active); the pill is gated on **active**, not
  `:hover`. Accept → `acceptProposal`; reject → `rejectProposal`.
- **Change** `src/renderer/src/App.css`: pill container (`surface-3`, `--shadow-1`, `bottom:100%`),
  ring, accept/reject hover colors, `applyFlash` on accept, `prefers-reduced-motion` guard.
- **i18n** `en.json` + `es.json`: pill labels (Rewrite / Insert, Accept, Reject).
- **Tests**: decoration tests assert the pill/ring appear only for the active edit and call
  accept/reject.
- **Conflicted state**: a `conflicted` proposal (set by `acceptProposal` on text drift) renders with a
  muted/disabled pill and a conflicted class rather than a normal accept affordance — match the label
  the old artifacts surface used.
- Delivers in-prose accept/reject for edits.

### 4. `[frontend]` Annotation floating card

- **Add** `src/renderer/src/editor/AnnotationCard.view.tsx` (pure) + `AnnotationCard.controller.tsx`:
  a Base UI floating card positioned from the clicked annotation's screen rect (via the view's
  `coordsAtPos`), clamped to the viewport, closing on outside-click/Esc. Header (warning
  `MessageSquareText` + "Note"), bold label, quoted passage, note body, mono `create_annotation`, and
  a **"Got it" / "Read"** button (`markAnnotationRead`). **No "Ask to revise"** (omit the button).
- **Wire** the click: clicking an annotation decoration sets it active and opens the card (a
  `handleClickOn`/widget hook mapping clicked pos → annotation id, surfaced through the editor
  controller).
- **i18n** both locales: card title, Got it / Read.
- **Tests**: `AnnotationCard.view.test.tsx` (renders fields, Got-it fires, no Ask-to-revise),
  controller test (open/close/Esc, mark-read).
- Delivers click-to-read annotations inline.

### 5. `[frontend]` Suggestion aggregation hook + tab count badges

- **Add** `src/renderer/src/editor/suggestion-list.ts` (new plain module, mirroring
  `artifacts/to-artifacts.ts`) — merge an editor's annotations + proposals, sort by doc position,
  classify `rewrite | insert | note` (insert = proposal with `from === to`), count pending.
- **Add** `src/renderer/src/editor/useEditorSuggestions.ts` — a `useSyncExternalStore` subscription
  over a single editor (pattern mirrored from `useOpenArtifacts.ts`) returning that module's output
  live. `artifacts/` is left untouched; this is a parallel copy removed with it in PR 2.
- **Change** `EditorTabStrip.view.tsx` + `editor-tabs-logic.ts`: render a `(N)` pending-count badge
  next to each tab's filename, N = that file's pending suggestions. The badge derives its per-file
  count by running the same pure `suggestion-list.ts` module over **each** open editor (read via
  `ActiveEditorContext.editors`); the single-editor `useEditorSuggestions` hook drives the active
  file's sub-topbar/list. One pure module, two callers — not two implementations.
- **i18n** both locales: an aria-label for the badge (e.g. `"{{count}} pending suggestions"`) so it is
  accessible and e2e-selectable. The visible badge is numeric.
- **Tests**: `useEditorSuggestions.test.ts` (merge/sort/classify/count), `EditorTabStrip.view.test.tsx`
  (badge shows N with its aria-label, hidden at 0).
- Delivers per-file counts; foundation for the sub-topbar and list.

### 6. `[frontend]` Suggestions sub-topbar (header row 2)

- **Add** `src/renderer/src/editor/SuggestionsBar.view.tsx` (pure) and wire it into
  `Editor.controller.tsx` above the manuscript (so each editor owns its own row 2; only the active
  editor's manuscript — and thus its bar — is visible). Renders **only when the file has
  suggestions**: `Sparkles` + "Suggestions · N to review" (or green `Check` + "All reviewed"), a
  **Hide all / Show all** button (`Eye`/`EyeOff` → `setSuggestionsVisible`), and a **List** button
  (`ListChecks` + `ChevronDown`). Tinted background per the design recipe; Motion press states.
- **i18n** both locales: "Suggestions", "{{count}} to review", "All reviewed", "Hide all", "Show all",
  "List".
- **Tests**: `SuggestionsBar.view.test.tsx` (count vs all-reviewed; toggle label; hidden when no
  suggestions), controller test wiring the visibility command.
- Delivers the manager bar (List button inert until step 7).

### 7a. `[frontend]` List popover (grouped, read-only previews + jump)

- **Add** `src/renderer/src/editor/suggestion-scroll.ts` (new plain module mirroring
  `artifacts/scroll-target.ts`) for the reveal, `SuggestionsList.view.tsx` (pure) + a `MiniPreview`
  helper + controller wiring from the List button: a **right-aligned** Base UI popover grouped
  **Rewrites · Inserts · Notes**, each row a one-line `MiniPreview` (resolved rows dimmed);
  **row-click jumps** — force `visible`, set the row active, and reveal the suggestion via
  **native `element.scrollIntoView({ block: 'center' })` reached through `view.domAtPos`** (the
  proven `artifacts/scroll-target.ts` reveal; **never** PM's `view`/`commands.scrollIntoView`, which
  can't drive the Base UI ScrollArea viewport).
- **i18n** both locales: group titles, status labels (applied / read / dismissed).
- **Tests**: `SuggestionsList.view.test.tsx` (grouping/order, jump callback fires), controller test for
  jump scrolling.
- Delivers navigation to any suggestion from a grouped list.

### 7b. `[frontend]` List per-row + per-group bulk actions

- **Change** `SuggestionsList.view.tsx` + controller: per-row accept/reject (edits) or mark-read
  (notes); per-group **"Accept all" / "Mark all read"** acting on that group's pending items.
- **i18n** both locales: Accept all, Mark all read, Accept, Reject, Got it.
- **Conflicted**: a conflicted edit row offers no plain "Accept all"; surface it as conflicted (match
  step 3).
- **Tests**: extend `SuggestionsList.view.test.tsx` (bulk actions fire on pending only; conflicted
  excluded from Accept all).
- Delivers the full inline review manager. The new inline surface is now complete and coexists with
  the (still-present) rail Review tab.

### 8. `[e2e]` Real-app inline review spec + coverage manifest

- **Add** `e2e/inline-suggestion-review.e2e.ts`: drive the built app in isolation, produce
  suggestions (live agent run or the established real-run harness used by `agent-text-authoring.e2e.ts`),
  and assert inline decorations render, accept/reject applies/removes, the annotation card marks read,
  and the sub-topbar/list reflect counts.
- **Change** `e2e/coverage-manifest.ts`: **add** `feature:inline-suggestion-review`. Leave the
  existing `artifacts` id and its spec in place (both surfaces still ship; removed in PR 2).
- Delivers the audit-passing real-app proof while existing specs stay green.

### 9. `docs:` Remove this plan

- Delete `docs/plans/inline-suggestion-review.md` in its own `docs:` commit (performed by
  `finish-plan`).

## Constraints

- **Frontend-only.** `src/renderer` + `e2e` only. No `src/main`, no `src/shared`, no agent-tool or
  IPC contract changes.
- **Additive only.** Nothing is deleted this PR; the inline UI coexists with the rail Review tab and
  `artifacts/`. Do not import from `artifacts/` into the new editor code — mirror the needed pure
  logic into new `editor/` modules so PR 2's deletion of `artifacts/` can't break the inline UI.
- **Rebase onto latest `main` first** (it contains the merged #58). Design targets the post-#58
  `proposals.ts` / `proposal-decorations.ts`.
- **Decoration state lives in plugin state.** `visible` and the cross-type `activeId` must be in
  ProseMirror plugin state (toggled via `setMeta` commands) so decorations recompute — not React
  props. UI-only state (popover open, card open/anchor) stays in React controllers.
- **One active suggestion across both types.** Activating a proposal clears any active annotation and
  vice versa — enforced by the single `suggestions-ui.activeId`.
- **Ephemeral.** Suggestions live only in editor memory; closing/reopening a file loses them. Add no
  persistence.
- **Pill gating.** The accept/reject pill is gated on **active**, never `:hover` (explicit design
  decision).
- **Jump scrolling.** Reveal via **native `element.scrollIntoView({ block: 'center' })`** on the DOM
  node reached through `view.domAtPos` (the proven `artifacts/scroll-target.ts` path). **Never** PM's
  `view.scrollIntoView` / `editor.commands.scrollIntoView` — those can't drive the Base UI ScrollArea
  viewport.
- **Conventions.** view/controller/plain split; design tokens from `App.css` (color recipes in the
  handoff "Design Tokens" section, no hardcoded hex); Base UI for popover/card; Motion for animation
  (respect `prefers-reduced-motion`); `lucide-react` icons only (no hand-rolled SVG); every
  user-facing key in **both** `en.json` and `es.json`; size limits per commit.
- **No new dependencies.** Reuse Base UI, Motion, lucide, existing ProseMirror APIs.

## Follow-up (separate PR, not this one)

A second PR removes the now-redundant old surface: delete the rail Review tab + `TabButton` /
`tab`/`review` props in `rail/ConversationRail.view.tsx`, stop mounting `ArtifactsPanelController`,
delete `rail/useReviewTab.ts`, delete the entire `src/renderer/src/artifacts/` directory, drop the
artifact card CSS and `artifacts.*` / `rail.review` i18n keys, and remove the `artifacts` e2e id +
spec. The temporary `editor/` copies of the merge/scroll helpers become the sole versions.

## Open questions

- **SETTLED — count scope:** per open file; each editor owns its suggestions, sub-topbar, and tab
  badge. The visible sub-topbar reflects the active file.
- **SETTLED — Ask to revise:** not shipped this pass (button omitted).
- **SETTLED — persistence:** ephemeral; lost on file close.
- **SETTLED — insert vs rewrite:** derived from proposal shape (`from === to` ⇒ insert); annotations
  gain a `status` field, proposals do not.
- **Open — e2e run source:** whether the inline-review e2e drives a live Claude run or the existing
  real-run harness used by `agent-text-authoring.e2e.ts`. Resolve in step 8 against how that spec is
  built post-#58.
