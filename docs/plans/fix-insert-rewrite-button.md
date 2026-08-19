# Plan: Fix the floating accept/reject pill over AI-inserted text

## What & why

The floating accept/reject "pill" that rides over an AI **insert** proposal is broken in four ways. The
pill is the small badge with a type label plus Check/X buttons that ProseMirror renders as a widget
decoration above an active proposal (`src/renderer/src/editor/extensions/proposal-decorations.ts`). For a
**replace** ("rewrite") proposal — `from !== to` — it floats over the struck red span and works fine. For a
pure **insert** — `from === to` — it is embedded as an absolute overlay inside the green draft block, and
that path is buggy. The reject button works correctly; everything else around the insert pill does not.

This is a bug-fix plan. Each step lands the targeted fix together with a regression test, ordered so each
commit is green on its own.

## Root cause(s) (cited)

All four symptoms trace to the **insert** branch of the decoration builder and the CSS that positions its
embedded pill.

1. **Pill sits too far ABOVE the text.**
   `proposal-decorations.ts` puts the insert pill inside an overlay wrap (`pillElement(input, true)`,
   `'suggestion-pill-overlay'`) that `App.css` anchors to the draft block's **top-left** (`.suggestion-pill-overlay { position:absolute; top:0; left:0 }`, App.css ~464). The pill itself is then floated `bottom:100%` (App.css ~470), so it sits a full pill-height + `0.25rem` **above** the block's top edge. The block also reserves `margin-top:1.75rem` of headroom (`.proposal-draft.proposal-insert`, App.css ~408). The pill ends up floating in that 1.75rem gap, visually detached from the inserted prose instead of next to it. (For a rewrite the pill floats over the in-flow struck span, which reads correctly — the difference is the insert's top-anchored overlay.)

2. **Labelled "Rewrite/Reescritura" for an INSERT.**
   `pillElement` chooses the label purely from `proposal.from === proposal.to`
   (`proposal-decorations.ts` ~147: `const typeLabel = proposal.from === proposal.to ? labels.insert : labels.rewrite`). Most insert paths produce `from === to` and label correctly, but the **empty-document "start" insert** in `tool-insert-text.ts` (`insertAtPoint`, ~52: `if (isEmptyDoc(editor)) return { from: 0, to: editor.state.doc.content.size }`) deliberately produces a non-empty range `from=0, to=content.size` so it can replace the stray empty paragraph. That insert is then mislabelled **Rewrite**. The label must reflect the proposal's **intent** (insert vs replace), not the incidental shape of its span. There is no field carrying that intent today — both insert and replace proposals are stored identically (`Proposal` in `proposals.ts` ~19).

3. **Clicking the pill / preview shifts the text.**
   `draftDecoration` folds the `active` flag into the widget **key** (`proposal-decorations.ts` ~81-84: `key: active ? \`${proposal.id}:active\` : proposal.id`). Toggling active therefore changes the key, so ProseMirror **destroys and rebuilds** the widget DOM rather than reusing it — which replays the block's entry animation (`.proposal-draft { animation: accept-in 0.18s }`, App.css ~399, a `translateY(0.125rem)`) and, on the active state, the `apply-flash`/ring. The rebuild + replayed transform reads as the document shifting on every click. The comment at ~78-80 claims this key change is required so the active class and embedded pill land; in fact the widget is rebuilt by `decorations()`on every transaction anyway (the plugin recomputes the full`DecorationSet`), so the `active` segment in the key is the unnecessary cause of the remount/flicker.

4. **Accept flow is buggy (reject is fine).**
   Reject is a single `setMeta` remove (`rejectProposal`, `proposals.ts` ~112) and is robust. Accept
   (`acceptProposal`, ~118) runs `editor.chain().insertContentAt({ from, to }, insertionContent(...))`. For
   an insert, `from === to`, so the parsed nodes are inserted at a point — but the **embedded pill lives
   inside the draft widget, which is a child of the same block region**, and the accept handler dispatches
   from a `mousedown` inside that about-to-be-destroyed widget. Combined with the key-driven remount of #3
   and the empty-doc replace-range case of #2, the accept path produces an inconsistent result (stray empty
   block on empty-doc start, or a visible jump as the widget is torn down mid-dispatch) where reject — which
   touches no document content — does not. The fix is to give the insert path a stable widget identity (#3)
   and a correct intent-driven span/label (#2) so accept applies exactly the drafted nodes.

The single structural fix underneath #2 and #4 is: **carry the proposal's kind explicitly** (`'insert' | 'replace'`) instead of inferring it from the span, so the label, the decoration layout, and accept all agree regardless of whether the span happens to be empty.

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[frontend]` **Carry proposal kind explicitly; drive the pill label from it.**
   - `src/renderer/src/editor/extensions/proposals.ts`: add `kind: 'insert' | 'replace'` to the `Proposal`
     type and to `CreateProposalInput['proposal']` (so the creating tool states intent). `reduceProposal`'s
     `add` carries `kind` through unchanged; `mapProposal` preserves it. Keep `from`/`to` as the live span.
   - `src/renderer/src/agent/tools/tool-insert-text.ts` and `tool-propose-edit.ts`: pass `kind: 'insert'`
     from both insert handlers (including the empty-doc start case) and `kind: 'replace'` from
     `proposeEdit`. No other behaviour change.
   - `src/renderer/src/editor/extensions/proposal-decorations.ts`: select the pill label and the
     insert-vs-replace decoration layout from `proposal.kind`, not `proposal.from === proposal.to`
     (`pillElement` ~147, `proposalDecorations` ~188). A `replace` whose span has collapsed still reads as a
     rewrite; the empty-doc `insert` (span `0..size`) now reads as **Insert**.
   - Tests: extend `extensions/__tests__/proposal-decorations.test.ts` — a `kind:'insert'` proposal whose
     span is non-empty (the empty-doc start shape) labels **Insert**; a `kind:'replace'` labels **Rewrite**.
     Update `proposals.test.ts` / the test harness helpers that build proposals to supply `kind`. This is the
     regression test for symptom (2). (Files: 2 source + 2 tool + decorations + 2 test files; under budget.)

2. `[frontend]` **Stable insert-pill identity — stop the click-shift and fix accept.**
   - `proposal-decorations.ts`: drop the `active` flag from the widget `key` in `draftDecoration` (~81-84) so
     toggling active **reuses** the cached widget DOM instead of remounting it (removing the replayed
     `accept-in` transform — symptom 3). Build the embedded insert pill so it appears/disappears within the
     already-reserved headroom without a key change (the `decorations()` recompute still re-runs the builder
     each transaction, so the active class + embedded pill still update on the reused node). Confirm
     `acceptProposal` (`proposals.ts`) applies exactly the drafted nodes for a `kind:'insert'` at an empty
     doc — no stray empty paragraph — leaning on the explicit `kind` from step 1 (symptom 4).
   - Tests: in `proposal-decorations.test.ts`, assert the insert draft widget DOM node is **the same element**
     before and after `setActiveProposal` toggles (mirrors the existing "reused across transactions" test at
     ~149); in `proposals.test.ts`, assert accepting a `kind:'insert'` empty-doc start proposal yields exactly
     the drafted content with no trailing empty block. Regression tests for symptoms (3) and (4).

3. `[frontend]` **Re-anchor the insert pill next to the text, not far above it.**
   - `src/renderer/src/App.css`: adjust `.suggestion-pill-overlay` / `.proposal-draft.proposal-insert` so the
     embedded pill sits **beside / at the top edge of** the inserted block (snug to the prose) rather than
     floating a full pill-height into the 1.75rem reserved gap. Keep the reserved headroom equal to the pill's
     own height so activation still never shifts the document (the existing no-shift invariant the comments at
     App.css ~406-410 and ~461-468 protect). Tokens/`rem` only; no arbitrary values; respect the existing
     reduced-motion block (~539). This is CSS-only (weight 0) and pairs with step 2's stable DOM.
   - No unit test (pure positioning); covered by the e2e in step 4 plus manual screenshot validation in the
     real app (the bar/pill only renders against a real ProseMirror layout).

4. `[e2e]` **Real-app regression spec for the insert pill.**
   - Add an `e2e/*.e2e.ts` spec (pattern: an existing editor/agent spec) that drives the real app to stage an
     **insert** proposal, activates it, and asserts: the pill label reads the **Insert** text (not Rewrite);
     clicking the green preview to toggle active does **not** move the inserted block (compare its bounding
     box before/after); **Accept** applies exactly the drafted text and removes the proposal; **Reject** on a
     second insert removes it without applying. Claim the matching `e2e/coverage-manifest.ts` id **in the same
     commit** if a new manifest id is required (see Open questions); otherwise tag the existing
     proposal/insert feature id. Heed the editor-e2e strict-mode trap (scope to the visible editor) and the
     live-stream settle race if the proposal is staged via a real agent run.

5. `[docs]` Remove this plan file in its own `docs:` commit once steps 1–4 ship (performed by `finish-plan`).

## Done

- An AI **insert** proposal's pill reads **Insert / Insertar** (never Rewrite/Reescritura), including the
  empty-document start insert.
- The pill sits **next to / at the top edge of** the inserted text, not floating far above it.
- Toggling the proposal active/inactive (clicking the preview or pill) does **not** shift the document.
- **Accept** applies exactly the drafted nodes (no stray empty block); **Reject** continues to remove
  without applying. Both insert and replace proposals behave consistently.
- `npm run lint`, `npm run test` (incl. the e2e coverage audit), `npm run type-coverage`, `npm run build`
  green; `npm run test:e2e` green. The new regression unit tests + e2e spec are green.

## Constraints

- **Renderer conventions** (frontend-engineer body): view/controller/plain split, design tokens only (no
  arbitrary bracket/fractional values), Base UI + Motion, `t()` for any new user-facing string. The pill is
  built imperatively in `proposal-decorations.ts` (runs outside React) — keep its labels coming from the
  i18n singleton as today; do **not** introduce a React tree inside the widget.
- **No new locale keys expected** — `editor.suggestionPill.insert/rewrite` already exist in both `en.json`
  and `es.json` (verified). Only add keys to **both** locales if step 4 needs a new e2e-facing label.
- **No `as` casts / `@ts-ignore` / `eslint-disable` / non-null `!`** — `getMeta`/plugin reads use type
  guards (as the existing `isProposalCommand` does). Adding `kind` to the `Proposal` type keeps it strongly
  typed end to end; no escape hatch.
- **Minimal diff / YAGNI.** Touch only the insert-pill path: the decoration builder, the `Proposal` kind
  field, the two creating tools, the App.css insert-pill rules, and the tests. Do not refactor the rewrite
  path, the SuggestionsBar/List header manager (`SuggestionsBar.*`, `SuggestionsList*`), or the annotation
  surface — they are unrelated to this bug.
- **No new dependency.**
- **Preserve the no-shift invariant**: the reserved headroom must stay equal to the pill height so
  activating an insert never reflows the document (the property steps 2 and 3 must not regress).

## Open questions

- **OPEN — manifest id for step 4.** Does a proposal/insert e2e feature id already exist in
  `e2e/coverage-manifest.ts` that this spec can claim, or must a new id (e.g. `feature:proposal-insert-pill`)
  be added with the spec in the same commit? Resolve by reading the manifest before writing step 4; the
  rule is one id ⇄ one spec, added together — never add an id without its spec.
- **OPEN — does any non-empty-span proposal legitimately need to read as an Insert besides the empty-doc
  start case?** Step 1 makes `kind` the single source of truth, so this is handled structurally; flagged only
  so the reviewer confirms no caller relies on the old `from === to` inference elsewhere (grep showed only
  the two tools and the decoration builder use it).
- **SETTLED — why reject works but accept doesn't.** Reject is a content-free `setMeta` remove; accept mutates
  the doc through a widget that the key-driven remount (symptom 3) tears down mid-dispatch and, for the
  empty-doc insert, replaces a stray range (symptom 2). Steps 1–2 remove both causes.
