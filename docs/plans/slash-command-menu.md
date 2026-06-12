# Slash command menu

A Notion-style slash menu for the manuscript editor. Typing `/` at the start of an empty block (or
after whitespace) opens a floating popup listing the block types the editor supports. Typing after the
`/` filters the list; ArrowUp/ArrowDown move the selection; Enter (or click) applies the chosen block to
the current line and removes the `/query` text; Esc (or losing the trigger) closes the menu.

This is a renderer-only feature: no IPC, no backend. It is built on the official first-party
**`@tiptap/suggestion`** utility (the same one that powers `@mentions`), wired into a new editor extension,
with the popup rendered in our own React tree (Base UI + Motion) rather than the example's `tippy.js`.

## Approach: the official utility + a reactive bridge

`@tiptap/suggestion` owns the hard ProseMirror plumbing — detecting the `/` trigger (only at a word
boundary, so `and/or` won't fire), tracking the `query` and `range` across edits, IME/composition/deletion
edge cases, the caret `clientRect`, and forwarding key events. It does **not** decide how the menu looks or
who owns the keyboard; it hands those to us through a `render()` lifecycle (`onStart`/`onUpdate`/
`onKeyDown`/`onExit`).

The catch: that lifecycle is **imperative**, while our codebase renders reactively (view/controller/hook,
no module-level mutable state). So the key design piece is a thin **reactive bridge**:

- **`@tiptap/suggestion` keeps focus in the editor** (so typing keeps filtering) and forwards
  Arrow/Enter/Esc to `render().onKeyDown`. We forward those to the bridge — we do **not** use Base UI
  `Menu`, which would steal focus and has no controlled highlighted-index.
- **A per-editor reactive store (the "bridge")** adapts the imperative lifecycle to React. It is created in
  the extension's `addStorage()` (so it is **per-editor instance state, not a module-level `let`**) and
  holds `{ active, items, clientRect, query, index, command }`. Suggestion's `onStart`/`onUpdate` push
  props in; `onKeyDown` calls `move(±1)` / `select()` / `close()`; `onExit` calls `close()`. The store
  exposes `subscribe` + `getSnapshot` for `useSyncExternalStore`.
- **The popup is a pure view** (Base UI `Popover` + `Button` rows + Motion, design tokens only). It reads
  `items` + `activeIndex` + `position` from props and calls `onSelect`/`onHover` — it owns no state and no
  keyboard. The highlight index lives in the bridge, so the view stays hook-free.
- **Positioning comes from Suggestion's `clientRect`** (the caret rect), turned into the popup anchor — no
  `coordsAtPos`, no decoration needed for placement.

So the data/keyboard/focus model is identical to the custom approach we discussed; `@tiptap/suggestion`
simply deletes the bug-prone detection/tracking code and replaces it with configuration plus this bridge.

## Done

When shipped, a writer can:

- Type `/` on an empty line (or after a space) and see a floating menu of block types appear at the caret.
- Keep typing to filter (e.g. `/head` narrows to the headings); see a "no results" state when nothing matches.
- Move the highlight with Arrow keys and confirm with Enter, or click a row, to convert the current block
  to that type — the `/query` text is removed in the same step.
- Dismiss with Esc, by deleting the `/`, or by moving the selection away.

Supported block types (only what the editor renders today): **Text** (paragraph), **Heading 1–3**,
**Bulleted list**, **Numbered list**, **Quote**, **Code block**, **Divider** (horizontal rule).

Green checks required: `npm run lint`, `npm run test` (incl. the e2e audit), `npm run type-coverage`,
`npm run build`, and `npm run test:e2e` (this is user-facing UI). Every new pure calc, the bridge, the
extension, the view, and the hook land with their own tests; a real-app `*.e2e.ts` spec drives the built app.

## Steps

Each step is one small, independently green commit. The feature lives under `src/renderer/src/editor/` —
new pure/data/view files in a `slash/` subfolder, the extension alongside the other extensions.

### 1. Add the `@tiptap/suggestion` dependency

- `package.json` + `package-lock.json` — add `@tiptap/suggestion` pinned to the installed TipTap line
  (`^3.26.0`). Weight 0 (outside `src/`). No code uses it yet; lint/build/test stay green with an unused dep.

Isolated so the new dependency is a single reviewable commit, separate from the code that consumes it.

### 2. Command catalog (data) + filter (calculation) (+ tests)

- `src/renderer/src/editor/slash/slash-command-catalog.ts` — exports `slashCommands`, the ordered list of
  `SlashCommandItem` records (the co-located type). Each item is **plain Data**: `id`
  (`'text' | 'heading1' | … | 'divider'`), `labelKey` (i18n key), `hint` (the shortcut shown on the right,
  e.g. `#`, `##`, `-`, `1.`), `keywords` (for filtering), and `icon` (a string id, not a component — the
  view maps it to a lucide icon, keeping this file free of JSX/behavior).
- `src/renderer/src/editor/slash/filter-slash-commands.ts` — pure `filterSlashCommands(items, query)`:
  case-insensitive match of the query against label keywords; empty query returns all; preserves catalog
  order. This is the function Suggestion's `items` callback delegates to. No editor, no DOM.
- `src/renderer/src/editor/slash/__tests__/filter-slash-commands.test.ts`.

### 3. Apply-command action (+ tests)

- `src/renderer/src/editor/slash/apply-slash-command.ts` — `applySlashCommand(editor, id, range)`: in one
  chain, deletes the trigger `range` (supplied by Suggestion) and runs the block command for that id
  (`setParagraph`, `toggleHeading({level})`, `toggleBulletList`, `toggleOrderedList`, `toggleBlockquote`,
  `toggleCodeBlock`, `setHorizontalRule`). The id→command mapping is the only logic; the action is a thin
  wrapper over the editor chain. This is what Suggestion's `command` option calls.
- `src/renderer/src/editor/slash/__tests__/apply-slash-command.test.ts` — uses the existing `withEditor`
  headless harness to assert each id converts the block (e.g. `heading1` yields an `h1`, `divider` inserts
  an `hr`) and that the `/query` text is gone.

### 4. The reactive bridge + position calculation (+ tests)

- `src/renderer/src/editor/slash/slash-menu-bridge.ts` — `createSlashBridge()` returns an encapsulated
  external store instance (the `useSyncExternalStore` shape): `subscribe(cb)`, `getSnapshot()` returning the
  immutable `{ active, items, clientRect, query, index, command }`, and the transition methods
  `openFrom(props)` / `update(props)` / `move(delta)` (clamped to item bounds) / `select(index?)` (invokes
  the stored `command` for the chosen item) / `close()`. State changes are pure `prev → next` replacements
  behind these methods — no module-level mutable binding.
- `src/renderer/src/editor/slash/slash-menu-position-logic.ts` — pure `slashMenuPosition(rect)` turning the
  caret `clientRect` into the popup `{ x, y }`; tested without a DOM.
- `src/renderer/src/editor/slash/__tests__/slash-menu-bridge.test.ts` and
  `__tests__/slash-menu-position-logic.test.ts` — drive the store directly: open/update sets items and
  active; `move` wraps within bounds; `select` calls the stored command with the highlighted item; `close`
  resets; subscribers fire.

Isolating the bridge keeps the trickiest new concept (the imperative→reactive adapter) in its own small,
fully unit-tested commit, separate from the TipTap wiring.

### 5. Slash-command extension (Suggestion config) + registration (+ tests)

- `src/renderer/src/editor/extensions/slash-command.ts` — an `Extension.create` that:
  - `addStorage()` → `{ bridge: createSlashBridge() }` (per-editor instance).
  - `addProseMirrorPlugins()` → `[Suggestion({ editor: this.editor, char: '/', allowSpaces: false, …,
items, command, render })]`:
    - `items: ({ query }) => filterSlashCommands(slashCommands, query)` (step 2).
    - `command: ({ editor, range, props }) => applySlashCommand(editor, props.id, range)` (step 3).
    - `render: () => ({ onStart, onUpdate, onKeyDown, onExit })` — each callback forwards to
      `this.editor.storage.slashCommand.bridge` (`openFrom`/`update`; `onKeyDown` → `move`/`select`/`close`
      returning `true` to swallow the key; `onExit` → `close`). No `tippy`/`ReactRenderer` — rendering is the
      React layer's job (step 7).
  - Exports `SlashCommandExtension` and a typed `getSlashBridge(editor)` accessor for the hook.
- Register `SlashCommandExtension` in `src/renderer/src/editor/extensions/index.ts` (one line) so the
  headless harness and the app both load it.
- `src/renderer/src/editor/extensions/__tests__/slash-command.test.ts` — headless: typing `/` opens the
  bridge with items and index 0; `/head` filters; Enter via the forwarded keydown applies the block and
  closes; `/` mid-word does not open.

`@tiptap/suggestion` removes the hand-written trigger/query/range/IME code, so this step stays comfortably
inside the commit budget.

### 6. Popup view + icons + i18n (+ tests)

- `src/renderer/src/editor/slash/slash-command-icon.tsx` — maps an item `icon` id to its lucide component
  (`Type`, `Heading1`…, `List`, `ListOrdered`, `Quote`, `Code`, `Minus`). Pure view helper.
- `src/renderer/src/editor/slash/SlashMenu.view.tsx` — a **view** (`*.view.tsx`, no hooks, no `window.api`):
  props = `items` (already filtered, each with translated `label` + `hint` + `icon`), `activeIndex`,
  `onSelect(index)`, `onHover(index)`, and the floating `position`. Renders a Base UI `Popover` (manual
  `open`, virtual anchor from `position`) containing Base UI `Button` rows — keyboard stays in the editor,
  so the popup is presentation only. Active row, hover, mount/exit animated with Motion; surface/text/border
  **design tokens** only; a "no results" row when `items` is empty.
- `src/renderer/src/i18n/locales/en.json` — add `editor.slash.*` (one label per block type, plus
  `title` and `empty`). Weight 0; lands with the view that consumes it.
- `src/renderer/src/editor/slash/__tests__/SlashMenu.view.test.tsx` — render with props, assert rows,
  labels, hints, active state, and the empty state.

### 7. Hook + controller wiring (+ tests)

- `src/renderer/src/editor/slash/useSlashMenu.ts` — `useSyncExternalStore(bridge.subscribe,
bridge.getSnapshot)` over `getSlashBridge(editor)`; translates the catalog `labelKey`s, applies
  `slashMenuPosition(snapshot.clientRect)`, and returns the view props plus `onSelect(index)` →
  `bridge.select(index)` and `onHover(index)` → `bridge.move`. One read hook; no `window.api`.
- `src/renderer/src/editor/slash/SlashMenu.controller.tsx` — wires `useSlashMenu` to `SlashMenu.view`,
  rendering nothing when the snapshot is inactive.
- `src/renderer/src/editor/EditorManuscript.tsx` — mount `<SlashMenuController editor={editor} />` inside
  the existing `EditorContext.Provider` so it shares the editor instance.
- `src/renderer/src/editor/slash/__tests__/useSlashMenu.test.tsx` (+ a controller render test) — assert the
  hook exposes translated/filtered items from a driven bridge and that `onSelect` invokes the command.

### 8. Real-app e2e (+ manifest decision)

- `e2e/editor-slash-command.e2e.ts` — claims `@e2e feature:editor`; drives the built app: open a folder
  (stubbed picker), open/create a file, type `/`, assert the menu appears, type `head`, press Enter (or
  click Heading 1), and assert the line became an `h1` and the `/` text is gone. Real `window.api`, real
  editor — nothing mocked.
- **No manifest change**: the slash menu lives inside the already-shipped `editor` feature and adds no IPC
  channel, so it introduces no new `FEATURES`/`OPERATIONS` id (see Open questions).

### 9. Remove the plan

A standalone `docs:` commit deleting this file once every step is shipped and green (performed by
`finish-plan`).

## Constraints

- **One new dependency, approved.** `@tiptap/suggestion@^3.26.0` (first-party, same vendor/version line as
  the existing `@tiptap/*` packages). We deliberately do **not** add the example's `tippy.js` or use
  `ReactRenderer` — the popup renders in our own React tree via the reactive bridge, so the dependency count
  stays at one.
- **Layering / component split.** Data is plain records; filtering, the id→command mapping, and positioning
  are calculations with their own tests; the editor mutation and the Suggestion lifecycle are actions at the
  edge. The view is hook-free and token-only; the controller owns the hook; the highlight index and menu
  state live in the bridge, not the React layer.
- **No module-level mutable state.** The bridge is a per-editor instance created in `addStorage()` and
  consumed through `useSyncExternalStore` — never a module-level `let`/counter.
- **Keyboard/focus.** `@tiptap/suggestion` keeps focus in the editor and forwards keys to our bridge; Base
  UI `Menu` is intentionally avoided (it traps focus, no controlled highlighted-index).
- **Design system.** Base UI primitives for the popup and rows, Motion for all animation, design tokens only
  (no arbitrary/hex values), every string through `t()`.
- **e2e audit.** This is user-facing UI, so a real-app spec ships in the same plan; `npm run test:e2e` must
  be green before the PR.

## Open questions

- **Dependency — SETTLED:** add `@tiptap/suggestion` (the official utility) rather than hand-rolling the
  ProseMirror plugin.
- **Rendering — SETTLED:** render the popup in our own React tree (Base UI `Popover` + Motion) via the
  reactive bridge; do not pull in `tippy.js` / `ReactRenderer` from the official example.
- **Keyboard ownership — SETTLED:** Suggestion forwards Arrow/Enter/Esc to the bridge; no Base UI `Menu`.
- **Block-type set — SETTLED:** include only types the editor supports today (Text, Heading 1–3, Bulleted
  list, Numbered list, Quote, Code block, Divider). The reference screenshot's Heading 4 / To-do / Toggle /
  Page have no node in our schema (heading levels are `[1,2,3]`, no task list / toggle / page) — excluded
  per YAGNI. Revisit if/when those nodes are added.
- **Trigger rule — SETTLED:** Suggestion's default word-boundary trigger with `allowSpaces: false` — opens on
  `/` at block start or after whitespace, closes on a space in the query. Matches the screenshot without
  firing mid-word (e.g. `and/or`).
- **Manifest granularity — proposed:** keep the slash menu under the existing coarse `editor` feature rather
  than introducing a finer `editor.slash` id, since the manifest is "one id per screen/region" and this adds
  no IPC channel. Confirm you're happy with that, or say the word and step 8 adds a dedicated feature id.
