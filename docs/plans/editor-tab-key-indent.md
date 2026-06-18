# Plan: Tab key inserts indentation in the editor (not focus traversal)

## What & why

Today, pressing **Tab** while the manuscript editor is focused does nothing inside the document — the
browser default fires and moves focus to the next interactive element, escaping the editor. Writers
expect Tab to indent. This change adds a TipTap keyboard-shortcut extension that **captures Tab (and
Shift+Tab) inside the editor and prevents the default focus traversal**, inserting an indentation at
the caret instead. It composes with the existing `ListKeymap` (Tab already sinks/lifts list items) and
the slash-menu suggestion (which forwards keys while open) so neither regresses.

No backend, no IPC, no shared contract: this is a renderer-only editor extension plus one e2e spec.

## Anchors (reuse these, don't reinvent)

- Extension set + order: `src/renderer/src/editor/extensions/index.ts` — `editorExtensions: AnyExtension[]`.
  `ListKeymap` is registered here and already owns Tab/Shift-Tab **inside list items** (sink/lift).
  The new extension is added to this array.
- Smallest extension pattern to mirror: `src/renderer/src/editor/extensions/placeholder.ts` and the
  `Extension.create({...})` shape in `src/renderer/src/editor/extensions/annotations.ts`. The new
  extension uses `Extension.create({ name, addKeyboardShortcuts() {...} })`.
- Editor construction: `src/renderer/src/editor/useManuscriptEditor.ts` (app) and the headless test
  harness `src/renderer/src/editor/extensions/__tests__/editor-test-harness.ts` (`withEditor(content, run)`,
  `createTestEditor`) — both build from `editorExtensions`, so the new keymap is exercised by both.
- Slash menu key forwarding: `src/renderer/src/editor/extensions/slash-command.ts` — the
  `@tiptap/suggestion` `onKeyDown` handler returns `true` to consume a key **only** for its own keys
  (ArrowUp/Down/Enter/Escape). Tab is **not** in its `keyActions`, so today Tab is not consumed while the
  menu is open. **Open question Q4** decides whether the new Tab handler should defer while the menu is open.
- No app-level Tab/keydown handler exists. `grep` for `Tab`/`keydown`/`addKeyboardShortcuts` across
  `src/renderer` finds only editor-file **tab strip** UI (`editor-tabs-logic.ts`, `EditorTabStrip.view.tsx`)
  and `AnnotationCard.controller.tsx`'s Escape handler — none intercept the Tab key for focus. So the
  current "Tab escapes the editor" behavior is purely the **browser focus default**; returning `true`
  from a TipTap `addKeyboardShortcuts` Tab binding makes ProseMirror `preventDefault`, which is the entire
  fix for the focus-escape.
- e2e reference: `e2e/editor.e2e.ts` (drives the real app: pick temp folder, open a real `.md`, focus
  `.ProseMirror:visible`, type, poll the autosaved file on disk). The manifest is `e2e/coverage-manifest.ts`
  (`feature:editor` already shipped).

## How TipTap resolves the Tab keymap (so the slice is correct)

- TipTap merges every extension's `addKeyboardShortcuts` into one ProseMirror keymap plugin. For a given
  key, handlers run in **extension order/priority**; the **first to return `true` wins** and stops the
  chain (and triggers `preventDefault`). A handler returning `false` falls through to the next.
- `ListKeymap` binds Tab/Shift-Tab but its handler returns `false` when the cursor is **not** in a list
  item, so it falls through. The new extension's Tab handler must therefore:
  - return `false` when the caret is somewhere `ListKeymap` (or another extension) should own Tab, so the
    list sink/lift keeps working;
  - otherwise perform the indent insertion and return `true` (which prevents focus traversal).
- Placing the new extension's relative priority so list behavior is preserved is a slice concern handled
  in Step 2's test (a list-item Tab test asserts sink, not a literal tab insert).

## Done

- With a manuscript focused, **Tab** inserts an indentation at the caret and **focus stays in the editor**
  (no traversal to the next control). **Shift+Tab** outdents/removes one indentation level (see Q2).
- Inside a list item, Tab/Shift+Tab still sink/lift the item (ListKeymap unchanged).
- The slash menu, when open, is not broken by the Tab handler (per Q4's resolution).
- `npm run lint`, `npm run test`, `npm run type-coverage`, `npm run build` green; `npm run test:e2e`
  green with the new editor-indent e2e spec.

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

> Steps 1–2 are **blocked** until **Q1 (what Tab inserts)** and **Q2 (Shift+Tab behavior)** are SETTLED —
> the inserted content is the core undecided behavior; do not implement against a guess.

1. `[frontend]` Pure indent calculation. **(blocked on Q1/Q2)**
   - `src/renderer/src/editor/extensions/tab-indent-logic.ts` + `__tests__/tab-indent-logic.test.ts`.
   - A pure module that, given the relevant editor state inputs (e.g. whether the selection is empty,
     and — per Q3 — the current line's leading indentation), returns the indent string to insert on Tab
     and the outdent operation on Shift+Tab. Keeping the "what to insert / how much to remove" math here
     (Data/Calc) makes it unit-testable without a DOM and keeps the extension (Step 2) thin.
   - Tests cover: Tab in plain paragraph yields the configured indent unit (Q1); Shift+Tab removes exactly
     one unit, and is a no-op when there is no leading indentation to remove (Q2).

2. `[frontend]` The Tab keymap extension + registration. **(blocked on Q1/Q2; depends on Step 1)**
   - `src/renderer/src/editor/extensions/tab-indent.ts` + `__tests__/tab-indent.test.ts` (uses the
     `withEditor` harness).
   - `Extension.create({ name: 'tabIndent', addKeyboardShortcuts() { return { Tab: ..., 'Shift-Tab': ... } } })`.
     The handlers call the Step-1 logic, dispatch the insertion/outdent through the editor commands, and
     **return `true` only when they handle it** (so focus traversal is prevented) / **`false`** to let
     `ListKeymap` (list items) and the slash menu (Q4) keep their behavior.
   - Register in `src/renderer/src/editor/extensions/index.ts`. Ordering/priority chosen so list-item Tab
     still sinks (the test asserts this) and Tab in a paragraph inserts the indent.
   - Tests (real headless editor): Tab in a paragraph inserts the indent and the doc changes; Tab in a
     bullet-list item sinks the item (ListKeymap still wins) and does **not** insert a literal indent;
     Shift+Tab outdents per Q2.

3. `[e2e]` Real-app spec. **(depends on Steps 1–2)**
   - `e2e/editor-tab-indent.e2e.ts`, claiming the existing `feature:editor` id (Tab-in-editor is part of
     the already-shipped editor feature — **no new manifest id**, no new IPC channel). Pattern: copy the
     open-and-focus scaffolding from `e2e/editor.e2e.ts` (`stubFolderPicker` → open temp folder → open a
     real `.md` → focus `.ProseMirror:visible`).
   - Asserts: after pressing **Tab** in the focused editor, the editor still holds focus (the manuscript,
     not a sibling control, is the active element) **and** the document content reflects the inserted
     indentation; pressing **Shift+Tab** reverses it (per Q2). Drives the real built app — no `window.api`
     mocking.

4. `[docs]` Remove this plan file in its own `docs:` commit once Steps 1–3 ship (performed by `finish-plan`).

## Constraints

- **Renderer-only, editor-scoped.** No backend, no `src/shared` contract, no new IPC channel, no new
  manifest id (the e2e claims the shipped `feature:editor`). No new dependency — Tab handling is built on
  the already-present `@tiptap/core` `addKeyboardShortcuts` and existing commands.
- **Compose, don't clobber.** `ListKeymap` must keep owning Tab/Shift+Tab inside list items; the new
  handler returns `false` in those cases. Don't reorder/remove existing extensions beyond inserting the
  new one at the chosen position.
- **No escape hatches** (`eslint-disable` / `@ts-ignore` / `as` except `as const` / non-null `!`). Read
  any `unknown` editor/transaction meta via a type-guard, mirroring `annotations.ts`.
- **Pure logic split.** The "what to insert / how much to remove" math lives in `*-logic.ts` (Data/Calc);
  the extension stays a thin Action that dispatches commands.
- **i18n:** this feature is keyboard-only with no new user-facing strings; if a setting/label is ever
  added it lands in both `en.json` and `es.json` — but Q1 currently implies **no** new strings.
- **Minimal diff / YAGNI.** Implement exactly the settled Tab/Shift+Tab behavior; don't add a
  configurable-indent setting, a toolbar control, or per-block-type rules unless an open question settles
  that they're required.

## Open questions

- **Q1 — What does Tab insert? (OPEN, blocks Steps 1–2.)** A literal tab character (`\t`), a fixed number
  of spaces (e.g. 2 or 4), or a paragraph-level indent (margin/indent attribute on the block)? Markdown is
  the on-disk format (`@tiptap/markdown`), so the choice must round-trip through serialize→reparse without
  surprising the writer (e.g. leading spaces inside a paragraph may be collapsed by the markdown
  serializer). The simplest faithful option and its markdown round-trip must be confirmed before Step 1.
  **Do not pick a default silently — this is the core undecided behavior.**
- **Q2 — Shift+Tab (outdent): in scope, and exact semantics? (OPEN, blocks Steps 1–2.)** Should Shift+Tab
  remove exactly one indent unit at the caret, be a no-op when there's nothing to remove, and is it in v1
  at all? (If deferred, Step 1/2 ship Tab only and the e2e drops the reverse assertion.)
- **Q3 — Scope of indentation: caret-only insert vs. line/block re-indent? (OPEN.)** Insert at the caret
  only, or normalize the whole current line/block's leading indentation (which is what most editors do and
  what makes Shift+Tab well-defined)? This shapes the Step-1 logic signature.
- **Q4 — Tab while the slash menu is open. (OPEN.)** The slash suggestion does not currently consume Tab
  (`slash-command.ts` `keyActions` lacks it), so the new Tab handler would fire and insert an indent into
  the active `/query`. Options: (a) the new handler defers (returns `false`) when the slash menu is open,
  leaving today's behavior; (b) Tab selects the highlighted slash item (common UX) — which would mean
  adding Tab to the suggestion bridge, a small extra change. Pick (a) unless the team wants (b).
- **Q5 — Accessibility / focus-trap. (OPEN.)** Capturing Tab removes the keyboard-only path to _leave_ the
  editor by tabbing, which is an a11y concern (keyboard users can get trapped). Is an explicit escape
  affordance needed (e.g. Escape blurs the editor, or a documented shortcut to move focus out), or is the
  existing Escape behavior / clicking elsewhere sufficient? Resolve before calling the feature done; may
  add a tiny follow-up to the extension (Escape → blur) but only if required.
- **Q6 — Code blocks. (OPEN, likely trivial.)** Inside a `codeBlock`, Tab indenting code is usually
  desirable and may already be reasonable with a literal tab; confirm the Q1 choice behaves acceptably in
  code blocks (it may simply fall through to the same insert).
