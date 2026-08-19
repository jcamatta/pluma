# Plan: Bubble menu over the editor's text selection

## What & why

When the writer selects text in the manuscript, a small floating toolbar (a "bubble menu") appears above
the selection offering quick actions on that passage. It mirrors the editor's existing floating-UI feel
(the slash menu, the annotation card) and gives the writer fast access to the highest-value actions
without leaving the keyboard/selection.

The **action set is deliberately minimal and is an OPEN QUESTION** (see below) — this plan builds the
**bubble-menu shell** (a per-editor selection bridge → reactive hook → pure positioned view, mounted in
the manuscript next to the slash/annotation controllers) plus the **inline formatting actions only**
(Bold / Italic, which the schema already supports via `toggleBold`/`toggleItalic`), because those are
unambiguously editor-local and invent no new product behavior. The two richer candidates the user gestured
at — **"send selection to the AI"** and **"create a note/annotation"** — touch other subsystems (the chat
composer seam; the agent-only annotation tool) and are gated behind the open questions; the shell is built
so adding an action later is a one-row change to a catalog.

## How this fits the existing code (anchors — reuse, don't reinvent)

The slash menu and the annotation card are the two worked floating-UI patterns; the bubble menu is the
annotation card's shape (driven by editor state + a measured screen rect) crossed with the slash menu's
catalog/bridge split. **No `@tiptap/extension-bubble-menu` dependency exists** (`package.json` has
`@tiptap/core`, `@tiptap/suggestion`, `@tiptap/extensions`, but not the bubble-menu package) — and we do
NOT add it. We reuse the annotation card's transaction-subscribe + `coordsAtPos` + viewport-clamp + Motion
approach, which needs no new dep.

- **Floating panel via editor state, no plugin needed:** `src/renderer/src/editor/AnnotationCard.controller.tsx`
  subscribes to the editor's `transaction` event through `useSyncExternalStore`, derives an open/anchor
  value from editor state (`coordsAtPos`), clamps it (`annotation-card-logic.ts` `clampCardPosition`), and
  renders a `motion.div` inside `AnimatePresence` with an `Outside` outside-click wrapper. The bubble menu
  is the same machine, keyed off **selection non-emptiness** instead of an active-annotation id.
- **Catalog + pure view + bridge split:** `src/renderer/src/editor/slash/` —
  `slash-command-catalog.ts` (plain Data: `id` + `labelKey` + `keywords`), `apply-slash-command.ts`
  (the `id → editor.chain()` map, the only logic), `SlashMenu.view.tsx` (pure, props-only, Base UI
  `Button` + Motion + `cn` + tokens), `useSlashMenu.ts` (`useSyncExternalStore` → translated view props),
  `SlashMenu.controller.tsx` (`AnimatePresence` wrapper). The bubble menu copies this division.
- **Geometry is pure + unit-tested:** `slash/slash-menu-position-logic.ts` and
  `editor/annotation-card-logic.ts` are DOM-free pure functions the controller feeds plain numbers into.
  The bubble menu gets its own `bubble-menu-position-logic.ts` (anchor above the selection's bounding rect,
  flip below near the top edge, clamp horizontally).
- **Mount point:** `src/renderer/src/editor/EditorManuscript.tsx` already renders
  `<SlashMenuController editor={editor} />` and `<AnnotationCardController editor={editor} />` inside the
  `EditorContext.Provider`; the bubble-menu controller mounts here too. Per-editor instances mean only the
  active editor's bubble menu shows (same as the slash/annotation controllers).
- **Formatting commands already exist:** `slash/apply-slash-command.ts` shows the `editor.chain().focus()…`
  pattern; Bold/Italic/Underline/Strike extensions are registered (`editor/extensions/index.ts`), so
  `editor.chain().focus().toggleBold().run()` and `…toggleItalic().run()` are available with no schema work.
  `editor.isActive('bold')` gives the pressed state for the toolbar button.
- **i18n:** keys live in `src/renderer/src/i18n/locales/en.json` + `es.json` under `editor.*`
  (e.g. `editor.slash.*`, `editor.annotationCard.*`); add `editor.bubbleMenu.*` to BOTH.
- **e2e:** `e2e/editor-slash-command.e2e.ts` is the pattern (real app, temp folder, open file, drive the
  `.ProseMirror` surface, assert the floating UI). The bubble menu rides the existing `editor` feature
  claim — **no new IPC channel, no new manifest feature id** (it's editor-local UI). The spec selects text
  in the surface, asserts the toolbar appears, clicks Bold, asserts the mark applied.

## Scope

- **IN (this plan):** the bubble-menu shell (selection bridge + position logic + hook + view + controller,
  mounted in the manuscript) and the **Bold / Italic** inline-formatting actions; appears on non-empty
  selection, hides on collapsed selection / blur / Esc; tokens + Base UI + Motion + `t()` + both locales;
  one real-app e2e on the existing `editor` claim.
- **OUT (deferred behind open questions / other subsystems):**
  - **"Send selection to AI"** — the composer seam (`rail/ComposerFocusContext.ts`) today exposes only
    `focus`/`isFocused`; it has **no text-insert API**. Routing a quoted selection into the chat composer
    means extending that seam (`ComposerHandle.insert(text)`) and owning the composer's value — a cross-
    cutting change that should be its own plan once the product behavior is confirmed (OQ-1).
  - **"Create a note/annotation"** — annotations are currently **agent-created** (a backend tool writes
    them; the renderer only reads/renders them via `editor/extensions/annotations.ts` +
    `AnnotationCard.*`). A writer-initiated note is **net-new product behavior** (no renderer "add
    annotation" command exists) and needs its own data/contract design (OQ-2).
  - Underline/Strike/heading/link or any action beyond Bold/Italic (add later via the catalog) (OQ-3).
  - Keyboard navigation _within_ the toolbar (the buttons are mouse/[Tab] reachable; an arrow-key roving
    focus is a later refinement) (OQ-4).

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[frontend]` **Position logic (pure geometry).**
   - `src/renderer/src/editor/bubble/bubble-menu-position-logic.ts`: `bubbleMenuPlacement(anchor, viewport)`
     where `anchor` is the selection's bounding screen rect (`{ top, bottom, left, right }`) and `viewport`
     is `{ width, height }`. Returns `{ left, top, bottom, transformOrigin }`: centered horizontally over
     the selection, anchored ABOVE the selection by default, flips BELOW when there isn't room above, and
     clamps `left` to stay on screen. DOM-free, mirrors `slash-menu-position-logic.ts` / `annotation-card-logic.ts`.
   - `src/renderer/src/editor/bubble/__tests__/bubble-menu-position-logic.test.ts`: above/below flip,
     horizontal clamp at both edges, centering math.

2. `[frontend]` **Action catalog (plain Data).**
   - `src/renderer/src/editor/bubble/bubble-menu-catalog.ts`: `BubbleActionId = 'bold' | 'italic'`;
     `bubbleActions: readonly { id; labelKey; }[]` — Data only, label resolved in the hook (matches
     `slash-command-catalog.ts`). Keep it a list so adding an action is a one-line change.
   - `src/renderer/src/editor/bubble/apply-bubble-action.ts`: `applyBubbleAction({ editor, id })` mapping
     `bold → editor.chain().focus().toggleBold().run()`, `italic → …toggleItalic().run()` (mirrors
     `apply-slash-command.ts`'s `id → chain` map; the only logic in the action layer).
   - `src/renderer/src/editor/bubble/__tests__/apply-bubble-action.test.ts`: each id toggles the right mark
     on a selection (using the editor test harness at
     `editor/extensions/__tests__/editor-test-harness.ts`).

3. `[frontend]` **Selection → reactive snapshot hook.**
   - `src/renderer/src/editor/bubble/useBubbleMenu.ts`: subscribe to the editor's `transaction` (and
     `selectionUpdate`/`blur`) via `useSyncExternalStore` (annotation-card pattern); when the selection is
     **non-empty and the editor is focused**, derive the selection's bounding rect from
     `editor.view.coordsAtPos(from)`/`coordsAtPos(to)`, run `bubbleMenuPlacement`, and return the view
     props: translated `{ id, label, active }[]` (active via `editor.isActive(id)`), the placement, and an
     `onAction(id)` that calls `applyBubbleAction`. Returns `null` when the selection is empty/blurred so
     the controller renders nothing.
   - `src/renderer/src/editor/bubble/__tests__/useBubbleMenu.test.tsx`: returns null on empty selection;
     returns actions + placement on a non-empty selection; `active` reflects `isActive`.

4. `[frontend]` **Pure view + controller, mounted in the manuscript, with locale keys.**
   - `src/renderer/src/editor/bubble/BubbleMenu.view.tsx`: a `motion.div` toolbar (role `toolbar`,
     `aria-label` from `editor.bubbleMenu.title`) of Base UI `Button`s — one per action, lucide icon
     (`Bold`, `Italic` from `lucide-react`; **no hand-rolled SVG**), `aria-pressed={active}`, tokens-only
     styling (mirror `SlashMenu.view.tsx`'s panel chrome: `bg-surface-2/3`, `border-(--line2)`,
     `shadow-lg`, `rounded-lg`), Motion mount/exit + `whileTap`. Pure props (placement + actions +
     callbacks + labels); no hooks, no state.
   - `src/renderer/src/editor/bubble/BubbleMenu.controller.tsx`: reads `useBubbleMenu(editor)`, wraps in
     `AnimatePresence`, renders the view positioned `fixed`; Esc-to-dismiss (clears via
     `editor.commands.focus` collapse / blur, matching annotation-card's keydown effect). Renders nothing
     when the hook returns null.
   - Mount `<BubbleMenuController editor={editor} />` in
     `src/renderer/src/editor/EditorManuscript.tsx` beside the slash/annotation controllers.
   - `src/renderer/src/i18n/locales/en.json` + `es.json`: add `editor.bubbleMenu.{ title, bold, italic }`
     to BOTH (locale-parity test).
   - Tests: `bubble/__tests__/BubbleMenu.view.test.tsx` (renders both buttons, pressed state, fires
     `onAction`); `bubble/__tests__/BubbleMenu.controller.test.tsx` (renders nothing when hook null; renders
     toolbar when not).

5. `[e2e]` **Real-app spec on the existing `editor` claim.**
   - `e2e/bubble-menu.e2e.ts` (pattern: `editor-slash-command.e2e.ts`; header `// @e2e feature:editor` — no
     new manifest id, it's editor-local UI on an existing channel): open a temp folder + file, type a
     sentence, select a word in `.ProseMirror`, assert the `toolbar` (by `aria-label`) becomes visible, click
     Bold, assert the selected text is now `<strong>`, click into empty space, assert the toolbar hides.
   - No `coverage-manifest.ts` change (rides `feature:editor`).

6. `[docs]` Remove this plan file in its own `docs:` commit once all steps ship (`finish-plan` performs it).

## Constraints

- **No new dependency.** Do NOT add `@tiptap/extension-bubble-menu` — build on the existing
  transaction-subscribe + `coordsAtPos` pattern (annotation card) so the menu is driven by editor state, not
  a TipTap plugin. If a reviewer prefers the official extension, that's a dep request to raise, not assume.
- **Frontend conventions:** view/controller/plain split (view pure & props-only; controller owns the hook +
  `AnimatePresence`; geometry/catalog/apply are plain unit-tested modules). Tokens-only, Base UI `Button`,
  Motion (respect reduced motion as the annotation card does), `t()` for every string, BOTH locales.
- **No hand-rolled SVG** — lucide-react icons only (`Bold`, `Italic`).
- **Per-editor, active-only:** the controller mounts inside each editor's `EditorContext`; only the active
  editor is visible, so only its bubble menu shows (same as slash/annotation). No module-level singleton.
- **No DOM-tree reaching / `window.api`:** this is pure renderer editor UI; it drives the passed `editor`
  instance only — no `querySelector`, no `window.api`. (Future "send to AI" must use the
  `ComposerFocusContext` seam, not the DOM — see OQ-1.)
- **Minimal diff / YAGNI.** Build the shell + Bold/Italic only; do not pre-build the deferred actions.
- **e2e:** rides the existing `feature:editor` claim — do NOT add a manifest id (no new IPC channel /
  user-facing operation). Adding an unbacked id turns the audit red.

## Open questions

- **OQ-1 (BLOCKS any "send selection to AI" action) — open.** Confirm the product behavior: should the
  bubble menu offer "Ask AI about this" / "Send to chat"? If yes, what exactly happens — does it insert the
  quoted passage into the chat composer (requires extending `ComposerFocusContext` with an `insert(text)`
  handle and the composer owning that text), pre-fill a prompt template, or start a run? This is a separate
  cross-subsystem plan; not built here until confirmed.
- **OQ-2 (BLOCKS any "create a note/annotation" action) — open.** Annotations are currently agent-created
  (backend tool); the renderer only renders them. A writer-initiated note from the bubble menu is net-new
  product behavior needing its own data/contract (where the note is stored, whether it persists, its
  author/severity model). Confirm whether this is wanted before designing it.
- **OQ-3 — open.** Final v1 action set. This plan ships **Bold + Italic** (schema-supported, no new
  behavior). Confirm whether to also include Underline / Strike / a heading toggle / a link action in v1 —
  each is a one-row catalog addition but should be an explicit product choice, not assumed.
- **OQ-4 — open.** Toolbar keyboard model: v1 makes buttons Tab/click reachable and Esc-dismissable. Confirm
  whether arrow-key roving focus within the toolbar is required for v1 or a later refinement.
- **OQ-5 — open.** Interaction with the slash menu and the annotation card: all three are selection/caret-
  anchored floating UIs in the same manuscript. Confirm the bubble menu should suppress itself while the
  slash menu or an annotation card is open (expected: yes — only show on a genuine non-empty text selection,
  which the slash trigger and annotation click do not produce, but verify no visual overlap in the e2e).
