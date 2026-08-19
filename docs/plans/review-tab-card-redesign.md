# Plan: Compact review-tab cards (navigate-on-click, snippet not full text)

## Summary

The Review tab (the `src/renderer/src/artifacts/` panel) lists every open file's annotations and
proposals as cards. The **proposal card** for an insert (`from === to`, empty `originalText`) currently
dumps the entire inserted block — `replacementText` rendered in full inside a green box — which can be a
whole drafted paragraph or document and makes the panel unreadable. Now that each editor also has its own
inline **suggestions area** (`SuggestionsBar` + grouped `SuggestionsList` popover with one-line
MiniPreviews), the Review tab's job is to be a compact, cross-file index: each card is a small row that
**states what kind of change it is, shows a short single-or-few-line preview, names its file, and carries
its own Accept / Reject (proposal) or Dismiss (annotation)**. Clicking the card body still navigates to
and activates the owning file and reveals the range — that behavior already exists in
`ArtifactsPanel.controller.tsx` and is unchanged. This plan only reshapes **card content and hit
targets**; it adds no new behavior, no IPC, no backend.

## What changes vs what stays

- **Stays (do not touch):** the navigate/activate/reveal flow in `ArtifactsPanel.controller.tsx`
  (`select`, `accept`, `reject`, `dismiss`, the cross-file `open(path)` + pending-reveal), the
  artifact model (`artifact.ts`, `to-artifacts.ts`, `artifact-key.ts`, `useOpenArtifacts.ts`), the
  Review-tab badge (`useReviewTab.ts`), and the `ArtifactAction` / `ArtifactFileLabel` primitives'
  behavior (stop-propagation, basename label). The editor's own `SuggestionsBar`/`SuggestionsList`
  area is **out of scope** — this plan is the Review panel only.
- **Changes:** `ProposalCard.view.tsx` and `AnnotationCard.view.tsx` — their layout and the text they
  render — plus a small shared pure `*-logic.ts` for the snippet/preview calculation, the `t()` keys it
  needs in both locales, and the cards' unit tests. `ArtifactsList.view.tsx` only if a new label has to
  be threaded through (it forwards a `labels` bag today).

## Design decisions (the content + hit-target contract these steps implement)

These are the choices the cards encode. Anything genuinely unsettled is in **Open questions** and blocks
the step that depends on it — those are not silently baked in.

1. **Card kind line.** Every card leads with a compact kind label, reusing the existing chip slot:
   - proposal where `originalText !== ''` → **Rewrite** (today's "Proposed rewrite", relabeled compact);
   - proposal where `originalText === ''` (an insert, `from === to`) → **Insert**;
   - annotation → its existing severity-tinted `label` chip (unchanged).
     The insert-vs-rewrite split mirrors `suggestion-list.ts` (`from === to ? 'insert' : 'rewrite'`); the
     card derives it the same way from `originalText` — **no model change**.

2. **Compact preview, never the full block.** The body shows a short single-line (clamped) preview, not
   the full text:
   - **Rewrite** → `before` struck + `after` greened, each truncated to a snippet, on one clamped line
     (the `MiniPreview` shape the suggestions list already uses).
   - **Insert** → the first ~N characters of `replacementText` greened, clamped to one (or a small fixed
     number of) line(s) with an ellipsis — this is the core fix: an inserted draft never renders in full.
   - **Annotation** → keep the quoted passage + note, but each clamped (the note can also be long). The
     quote/description stay but are line-clamped rather than free-flowing.
     Clamping is CSS line-clamp on the standard token scale; the snippet character budget lives in a pure
     `card-preview-logic.ts` (testable without a DOM) — see **Open questions** for the exact budget/line
     count.

3. **Hit targets.** The whole card body is the navigate target (one `onClick` → `select`), exactly as
   today; the action buttons (`ArtifactAction`) keep their `event.stopPropagation()` so pressing
   Accept / Reject / Dismiss never also navigates. No new affordance, no separate "open" button — the
   body is the open target. The active card keeps its accent ring.

4. **Actions unchanged in meaning, kept on the card.** Proposal: Reject always, Accept only when not
   `conflicted` (conflicted still shows the badge + Reject only). Annotation: Dismiss. These already
   exist; the redesign keeps them on each compact card so the panel stays a one-click review surface.

## Done

- In the Review tab, an **insert** proposal card no longer renders the whole inserted block — it shows a
  short clamped preview, names its file, and carries Reject (+ Accept when not conflicted).
- A **rewrite** proposal card shows a compact one-line before/after snippet; an **annotation** card shows
  a clamped quote + note. Every card's body click still navigates to and activates the owning file and
  reveals the range (existing controller behavior, unbroken), and the active card keeps its ring.
- The conflicted proposal still shows its badge and offers only Reject.
- New user-facing strings exist in **both** `en.json` and `es.json` (parity test green).
- `npm run lint`, `npm run test` (incl. the e2e coverage audit), `npm run type-coverage`, `npm run build`
  green; `npm run test:e2e` green for `e2e/artifacts.e2e.ts` (it asserts the proposal card shows its
  replacement preview — "rug" — and that Accept applies it; the compact preview must keep both true).

## Steps

Each step is one mini-commit: ≤ ~300 weighted `src/` lines, ≤ 15 files, code > 30 lines lands a test.
Only `src/` carries weight; `docs/` is weight 0. Ordered so each lands green on what came before.

1. `[frontend]` **Pure snippet/preview logic + tests.**
   - Add `src/renderer/src/artifacts/card-preview-logic.ts`: pure functions that turn an `Artifact`'s
     text into the clamped snippet(s) the cards render — e.g. `previewKindOf(artifact)` returning
     `'rewrite' | 'insert' | 'annotation'` (derived from `kind` + `originalText === ''`), and a
     `clampText(text, max)` (or `snippet`) calculation for the character budget. No DOM, no React.
   - Add `src/renderer/src/artifacts/__tests__/card-preview-logic.test.ts`: insert vs rewrite
     classification from `originalText`; clamp leaves a short string intact and ellipsizes a long one at
     the budget boundary; empty/whitespace handled.
   - Delivers the only non-trivial logic as a tested pure module so the views stay layout-only. Green
     alone (nothing imports it yet).

2. `[frontend]` **Redesign `ProposalCard.view.tsx` (compact) + i18n + tests.**
   - Rewrite the card body to use `card-preview-logic`: a kind line (**Rewrite** / **Insert**), a clamped
     one-line preview (rewrite = struck `before` + greened `after` snippet; insert = greened
     `replacementText` snippet with line-clamp), the existing `ArtifactFileLabel`, and the existing
     Reject (+ Accept when not conflicted) row. Keep the `motion.div`, `data-testid`, active ring, and
     `onClick`-on-body exactly as they are.
   - Add the new label keys (e.g. `artifacts.rewrite`, `artifacts.insert`) to **`en.json` and `es.json`**;
     thread them through `ProposalCardLabels` and the `ArtifactsList`/controller `labels` bag (the
     controller already resolves labels with `t()` — add the two keys there). Keep `proposedRewrite`
     only if still referenced; otherwise relabel it to `rewrite` consistently.
   - Update `src/renderer/src/artifacts/__tests__/ProposalCard.view.test.tsx`: a ready rewrite shows the
     snippet + both actions; an insert (`originalText: ''`, long `replacementText`) shows a clamped
     preview (assert the full block is **not** rendered) + both actions; conflicted hides Accept and
     shows the badge; a body click selects without the action re-selecting.
   - Tokens-only, Base UI, Motion (existing), `t()`, view stays hook-free. This is the core fix.

3. `[frontend]` **Compact `AnnotationCard.view.tsx` + tests.**
   - Apply the same compaction to the annotation card: keep the severity chip, file label, and Dismiss,
     but line-clamp the quote and the note via `card-preview-logic` so a long note no longer expands the
     card unbounded. Keep the `--annotation-color` severity class wiring, `data-testid`, active ring, and
     body `onClick` unchanged. No new behavior.
   - Update `src/renderer/src/artifacts/__tests__/AnnotationCard.view.test.tsx`: a long quote/note is
     clamped (and still navigable on body click; Dismiss still fires without selecting).
   - Reuses only existing keys (`artifacts.dismiss`), so likely no new i18n — confirm before adding.

4. `[e2e]` **Re-run + (only if needed) realign the artifacts spec — no new manifest id.**
   - `e2e/artifacts.e2e.ts` already covers this feature under the existing `feature:artifacts` /
     `feature:artifacts-cross-file` manifest ids; this is a visual refresh of an existing feature, so
     **add no new manifest id** (adding one without a new spec turns the audit red). Run `test:e2e` for
     this spec; it asserts the proposal card shows its replacement ("rug") and that Accept applies it,
     and matches cards by `data-testid^="artifact-card:"` and visible text — all preserved by design.
     Only if a selector assumption broke (e.g. the replacement text is now truncated below the asserted
     word), make the **minimal** spec edit to match the compact card. Prefer not touching the spec.
   - No `src/` change here — weight 0.

5. `[docs]` **Remove this plan file** in its own `docs:` commit once steps 1–4 ship (performed by
   `finish-plan`).

## Constraints

- **Frontend conventions:** view files (`*.view.tsx`) stay pure/layout-only (no hooks, no
  `window.api`, no side effects); the only logic goes in the pure `card-preview-logic.ts`; controllers
  resolve `t()` labels and pass them down. Design tokens only — no arbitrary bracket values, no
  fractional spacing, no invented token/color/font; use existing `feedback-success/error`,
  `text-muted/secondary`, `action-primary`, `font-editor`, `--annotation-color`. Base UI + Motion as
  already used. `t()` for every string; **both locales** or the parity test fails.
- **Minimal diff / YAGNI / don't invent behavior.** Do not change the artifact model, the
  navigate/activate/reveal controller, `useOpenArtifacts`, the badge, or the editor's own suggestions
  area. The select/accept/reject/dismiss semantics are fixed; only the card's rendered content and the
  clamp budget are new, and the budget is an Open question, not an invented constant.
- **No new dependency.** Truncation/clamping uses CSS (line-clamp/truncate) + a pure string budget — no
  diff/markdown lib (the inline editor already owns the rich diff; the card is a plain snippet).
- **No check-dodging:** no `eslint-disable` / `@ts-ignore` / `as` (except `as const`) / non-null `!`.
  Read any `unknown` with a type guard.
- **Keep the e2e green:** the compact preview must still surface enough of a proposal's replacement text
  for `artifacts.e2e.ts`'s `hasText: 'rug'` / Accept assertions to hold; a single short replacement word
  must not be clipped away.

## Open questions

- **Snippet budget / line count (BLOCKS step 1's exact constants and step 2's insert clamp).** How many
  characters / lines is "compact" for each kind? Proposed default: insert = clamp to ~2 lines via CSS
  `line-clamp-2` with a generous char budget so short replacements (e.g. "rug") are never clipped;
  rewrite = one line (`truncate`) for `before` and `after` snippets; annotation quote = 1 line, note =
  2 lines. Confirm the exact numbers (and whether to clamp by CSS lines, character budget, or both)
  before fixing them — _open_.
- **Relabel vs keep `proposedRewrite`.** The card now distinguishes **Rewrite** vs **Insert**, so the
  single `artifacts.proposedRewrite` key is replaced by `artifacts.rewrite` + `artifacts.insert`.
  Confirm we may drop/replace `proposedRewrite` (and update its references) rather than keep it as a
  third synonym — _open_.
- **Show a click affordance?** Decision above is "the whole body is the navigate target, no separate
  open button." Confirm we want no explicit "open in editor" icon/cue on the card (relying on hover +
  the existing active-ring feedback), or whether a subtle affordance is wanted — _open_.
- **Insert preview source.** An insert's preview uses `replacementText` (the same source the editor's
  MiniPreview greens). Confirm that's the right field for the card snippet and we don't want, e.g., a
  surrounding-context preview from the document — _open_.
