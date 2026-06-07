# Plan 01 — Port the TipTap editor + extensions into the renderer (hexagonal)

Status: **DONE.** Deps installed; editor + extensions ported under `src/renderer/src/editor/`;
all four gates (lint, test, type-coverage, build) green; not committed (per instruction). The
frontend conventions established here were written back into `.agents/AGENTS.md`.
Scope: **frontend / renderer only.** Do not touch `src/main`, `src/preload`, or backend tests.
Source of truth for the code being ported: `.references/write-write/src/renderer/src/editor/**`.
Out of scope here: frontend tools, the AG-UI agent, `useAgent` — those are Plan 02.

The goal: reproduce the reference editor + its four ProseMirror extensions, but reshaped
into pluma's renderer hexagonal layout (`components/ ` view+controller, `hooks/`, pure
`logic`/`data`), fully testable, with everything green under
`npm run lint && npm run test && npm run type-coverage && npm run build`.

---

## 0. BLOCKER — dependencies to approve first

The reference editor is 100% TipTap/ProseMirror. **None of it is installed in pluma**, and
[.agents/AGENTS.md:12](../../.agents/AGENTS.md) forbids adding deps without approval. Before
any code is written, get a yes/no on installing these **runtime** deps (pin to the reference's
versions for parity):

```
@tiptap/react            ^3.23.6
@tiptap/core             ^3.23.6   (peer of react; explicit for type imports)
@tiptap/pm               ^3.23.6   (ProseMirror bundle: state, view, model)
@tiptap/extensions       ^3.23.6   (UndoRedo + Placeholder)
@tiptap/markdown         ^3.23.6
@tiptap/extension-blockquote      ^3.23.6
@tiptap/extension-bold            ^3.23.6
@tiptap/extension-code            ^3.23.6
@tiptap/extension-code-block      ^3.23.6
@tiptap/extension-document        ^3.23.6
@tiptap/extension-dropcursor      ^3.23.6
@tiptap/extension-gapcursor       ^3.23.6
@tiptap/extension-hard-break      ^3.23.6
@tiptap/extension-heading         ^3.23.6
@tiptap/extension-horizontal-rule ^3.23.6
@tiptap/extension-italic          ^3.23.6
@tiptap/extension-list            ^3.23.6
@tiptap/extension-paragraph       ^3.23.6
@tiptap/extension-strike          ^3.23.6
@tiptap/extension-text            ^3.23.6
@tiptap/extension-typography      ^3.23.6
@tiptap/extension-underline       ^3.23.6
diff                              ^9.0.0   (word-level diff for proposal decorations)
```

`@tiptap/suggestion` from the reference is **not** needed (it's only used by mention/slash
UI we are not porting). `react` / `react-dom` are already present.

> **DECIDED: dependencies approved — install them.**

Resolved decisions:

- **Id strategy — DECIDED: counter in plugin state** (not UUID, not a const-ref hack). Ids stay
  short and sequential (`r_1`, `a_1`, `p_1`) because the agent echoes them back. See §4.1.
- **`satisfies` — DECIDED: keep, do not ban** (it's a checked assertion, can't lie). See §4.5.
- **Editor CSS — DECIDED: already in App.css, add nothing.** See §5.
- **Scrollable — still open.** Reference ships a custom `Scrollable.tsx`. Options: (a) port it
  verbatim, (b) Base UI `Scroll Area` (installed, preferred by AGENTS). **Recommendation: (b)**;
  plan assumes (b). Confirm or say port-custom. _(low-stakes; can decide during 3.6.)_

---

## 1. Target layout

All paths under `src/renderer/src/`. Reference file → destination:

| Reference file                     | Destination                                               | Kind            | Change from reference                                                                    |
| ---------------------------------- | --------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| `editor/extensions/ranges.ts`      | `editor/extensions/ranges.ts`                             | logic+data      | de-`let` the id counter (§4.1)                                                           |
| `editor/extensions/annotations.ts` | `editor/extensions/annotations.ts`                        | logic           | de-`let` counter; **inline** `AnnotationSeverity` (was imported from shared/agent/tools) |
| `editor/extensions/proposals.ts`   | `editor/extensions/proposals.ts`                          | logic           | de-`let` counter                                                                         |
| `editor/extensions/placeholder.ts` | `editor/extensions/placeholder.ts`                        | logic           | route strings through `t` (§4.2)                                                         |
| `editor/extensions/index.ts`       | `editor/extensions/index.ts`                              | barrel          | drop nothing; same list                                                                  |
| `editor/useManuscriptEditor.ts`    | `editor/useManuscriptEditor.ts`                           | hook            | stays in `editor/`                                                                       |
| `editor/useEditorZoom.ts`          | `editor/useEditorZoom.ts` + `editor/editor-zoom-logic.ts` | hook + pure     | extract pure fns; de-`let` (§4.3)                                                        |
| `editor/Editor.tsx`                | `editor/Editor.view.tsx` + `editor/Editor.controller.tsx` | view+controller | **split** (§3.4–3.5); drop `useFrontendTools` (Plan 02)                                  |
| `components/Scrollable.tsx`        | (Base UI Scroll Area, see §3.6)                           | plain           | replace or port                                                                          |

New folders to create: `src/renderer/src/editor/extensions/`, `src/renderer/src/hooks/`,
`src/renderer/src/components/`, and `__tests__/` beside each.

> **DECIDED (folder structure): feature-first, everything under `editor/`.** No top-level
> `hooks/` or `components/`. The editor's hooks (`useManuscriptEditor`, `useEditorZoom`),
> components (`Editor.view.tsx`, `Editor.controller.tsx`), pure logic (`editor-zoom-logic.ts`),
> and extensions all live inside `editor/`. Rationale: mirrors the backend's feature-first
> grouping (`application/folder/...`); a top-level `hooks/`/`components/` becomes a junk drawer
> once a second feature (agent dock, file tree) lands; and the view/controller **role** is
> encoded in the filename suffix (which is what the eslint rules key off), so role folders add
> nothing. Genuinely cross-feature pieces (a generic `Scrollable`, design-system wrappers) are
> the only things that go in a future top-level `components/`.

---

## 2. Hard constraints (lint will fail otherwise)

Re-derived from [.agents/AGENTS.md](../../.agents/AGENTS.md) and
[eslint/architecture.mjs](../../eslint/architecture.mjs) / `eslint/style.mjs` / `eslint/limits.mjs`:

1. **No `let`, no `var`, no reassignment, no module-level mutable state.** The reference's
   three `let xIdCounter = 0` counters and the `let` accumulators in `useEditorZoom` and
   `tool-get-ranges` all violate this. Must be rewritten (§4).
2. **No `as` (except `as const`), no `!`, no `@ts-*`, no `eslint-disable`.** The reference uses
   `as RangeEvent | undefined` / `as AnnotationCommand | undefined` on `transaction.getMeta(...)`.
   Those casts must go — wrap meta access in a typed reader (§4.4).
3. **One export per file** (named only; no default exports — `import-x/no-default-export`). The
   reference's `Editor.tsx` is `export default`. The split files use **named** exports.
4. **One file-header comment**, no inline comments. Keep the reference's block comments only as
   the single header line; delete mid-code comments (the bias-mapping comments in
   `ranges`/`annotations` become part of the header or a short note — keep them terse).
5. **View rules** ([architecture.mjs:36](../../eslint/architecture.mjs)): `*.view.tsx` may not
   call any `use*` hook and may not touch `window.api`. `Editor.view.tsx` therefore takes the
   `editor` and zoom values purely as props.
6. **Size limits** (`limits.mjs`): `max-lines` 250/file, `max-lines-per-function` 75,
   `max-statements` 12, `max-params` 2, `complexity` 8, `max-depth` 3. `proposals.ts` is 248
   lines — under 250 but tight; do **not** add to it. `proposalDecorations` and the zoom
   wheel handler are the functions closest to the statement/complexity caps — keep their shape.
7. **Styling**: only the approved tokens / Tailwind scale; no arbitrary `[...]` values, no
   fractional steps. The reference's `px-10 py-10`, `py-5`, `flex h-full min-h-0` are all on
   the scale and fine. `style={{ '--editor-zoom': zoom }}` is a CSS var, allowed.
8. **Localization**: user-visible strings via `t`. Only `placeholder.ts` has them.
9. **Tests in `__tests__/` beside the code.** Renderer tests run in the `jsdom` vitest project
   (`vitest.config.ts`), pattern `src/renderer/**/*.{test,spec}.{ts,tsx}`. Coverage gate 80%.

---

## 3. Step-by-step

### 3.1 Install deps (after approval)

`npm install <the §0 runtime list>`. Then `npm run typecheck:web` once to confirm types resolve
before writing anything.

### 3.2 Port the pure extensions

Copy `ranges.ts`, `annotations.ts`, `proposals.ts`, `placeholder.ts`, `index.ts` into
`editor/extensions/`. Apply the §4 rewrites. These are pure (no React, no IPC) so they port
almost verbatim apart from the `let`/`as` fixes.

- `annotations.ts`: replace the `import type { AnnotationSeverity } from '../../../../shared/agent/tools'`
  with a **local** definition at the top of the file:
  ```ts
  export type AnnotationSeverity = 'info' | 'warning' | 'error'
  ```
  (Plan 02 will re-export / reconcile this with the tool args; for now the editor owns it.)
- `index.ts`: identical extension array. Keep `Markdown` last and `Typography` before it, as in
  the reference (order matters for input rules).

### 3.3 Port the hooks

- `hooks/useManuscriptEditor.ts`: verbatim (it's already clean), just the new import path
  `../editor/extensions`.
- `hooks/useEditorZoom.ts`: apply §4.3.

### 3.4 `components/Editor.view.tsx` (pure)

Props-only. Signature:

```ts
type EditorViewProps = {
  readonly editor: TiptapEditor
  readonly zoom: number
  readonly containerRef: React.RefObject<HTMLDivElement | null>
}
```

Body = the reference's JSX **minus** `useEditorZoom`, `useMemo(providerValue)`, and
`useFrontendTools` (all of those are hooks → forbidden in a view). The `EditorContext.Provider`
value `{ editor }` is computed inline from the prop (object literal in JSX is fine; the
`useMemo` was only a render-churn optimization and a view cannot call it). Export **named**
`EditorView`.

### 3.5 `components/Editor.controller.tsx` (wires hooks → view)

```ts
export function EditorController(): React.JSX.Element | null {
  const editor = useManuscriptEditor()           // Editor | null
  const { containerRef, zoom } = useEditorZoom()
  if (!editor) return null
  return <EditorView editor={editor} zoom={zoom} containerRef={containerRef} />
}
```

This is where the `editor === null` guard lives (the reference's `useManuscriptEditor` can
return null on first render). No `useFrontendTools` call — that's Plan 02; leave a one-line
header note that tools attach here later.

### 3.6 Scroll container

**Recommended (Base UI):** create `components/Editor.view.tsx` using `ScrollArea` from
`@base-ui/react` (already a dep) in place of the reference `Scrollable`. Fetch
`https://base-ui.com/react/components/scroll-area.md` before wiring it (per AGENTS rule) to get
the current `ScrollArea.Root/Viewport/Scrollbar/Thumb` API. Match the reference's three class
slots: outer `min-h-0 flex-1`, content `flex min-h-full px-10 py-10`, scrollbar `py-5`.

**Alternative (port custom):** copy `.references/.../components/Scrollable.tsx` into
`components/Scrollable.tsx` as a plain component, de-`let` if needed, and use it as the
reference does. Only do this if Base UI's ScrollArea proves awkward for the zoom container.

### 3.7 Mount it

Render `<EditorController />` from `App.tsx` (replacing the placeholder `t('appTitle')` body, or
alongside it). Keep `App.tsx` a thin shell. Add the `appTitle`-style keys you introduce to
`i18n/locales/en.json`.

---

## 4. The specific rewrites (this is the fiddly part — be exact)

### 4.1 De-`let` the three id counters — **DECIDED: the counter lives in plugin state**

Both earlier options were rejected by the user, correctly:

- `crypto.randomUUID()` defeats the _purpose_ of the id. The id is **echoed back by the agent**
  (it calls `get_ranges` → gets `r_1` → calls `propose_edit({ rangeId: 'r_1' })`). Short,
  sequential, hard-to-mistype ids matter; a UUID is easy to copy wrong.
- The `const refObject` counter is an **eslint-passing hack** for a module-level mutable — exactly
  the smell we want to _forbid_, not adopt.

**Correct design: the "next id" is part of the ProseMirror plugin's `const` state**, threaded
through `apply()` like every other piece of state. No module-level mutable, no `let`, ids stay
`r_1`/`a_1`/`p_1`, and id allocation becomes a pure function of (previous state → new state).

Shape (ranges shown; annotations/proposals identical with `a_`/`p_`):

```ts
type RangesState = {
  readonly ranges: readonly TrackedRange[]
  readonly nextId: number // monotonic; only ever increments via apply()
}

// id is minted *inside* apply when a 'range_add_request' meta arrives, so the counter
// advances exactly with committed state — never out of band.
```

Key change from the reference: the public `setRange`/`createAnnotation`/`createProposal`
functions can no longer mint the id themselves (they have no access to a mutable counter). Two
ways to thread it, pick per extension:

- **(preferred) Mint in `apply`.** The command dispatches a meta _without_ an id
  (`{ type: 'range_add_request', range: {from,to,originalText} }`). `apply` reads `state.nextId`,
  builds the `TrackedRange` with `id: \`r\_${state.nextId}\``, and returns
`{ ranges: [...], nextId: state.nextId + 1 }`. The caller that needs the new id reads it back
from the freshly-applied state (`rangesPluginKey.getState(editor.state)`after dispatch) — the
last range, or match on`from/to`. This keeps id allocation _purely_ a function of state.
- **(alt) Mint in the command from current state.** `setRange` reads
  `rangesPluginKey.getState(editor.state).nextId`, builds the id, dispatches a meta carrying both
  the built range _and_ `nextId+1` so `apply` stores the advanced counter. Slightly more
  coupling but lets `setRange` return the id synchronously without re-reading.

> Use the **preferred (mint-in-apply)** form. It makes the counter unforgeable from outside and
> testable as `apply(state, event) → state'`. Tests assert ids increment `r_1, r_2, …` and that
> `nextId` advances by exactly one per add. This is the "put the rangeId in plugin state" the
> user proposed, done properly.

This also subsumes §4.4's concern for the _event_ shape — the add-request meta is part of the
same typed command union the meta-reader narrows.

### 4.2 `placeholder.ts` localization

The resolver returns hardcoded English (`'Heading 1'`, `'Quote'`, `'Code'`, and the easter-egg
default). The resolver runs **outside React** (called by ProseMirror), so it can't use the `t`
**hook**. Use the i18n singleton directly:

```ts
import { i18n } from '../../i18n'
// ...
return i18n.t('editor.placeholder.heading', { level: node.attrs.level })
```

Add keys to `en.json`:

```json
"editor": {
  "placeholder": {
    "heading": "Heading {{level}}",
    "quote": "Quote",
    "code": "Code",
    "default": "You can address me as… The Fool."
  }
}
```

(Keep the easter-egg string — it's the reference's voice; translators can change it.)

### 4.3 `useEditorZoom.ts` de-`let`

Two `let` sites:

- The `handleWheel` accumulator logic uses refs already (`wheelDeltaRef`, `wheelDirectionRef`) —
  those are fine (mutating `.current` is allowed). Check for any bare `let` inside; the
  reference body uses `const delta`, `const direction`, `const steps` — all already `const`.
  **Likely no change needed** beyond confirming. The `setZoomState((currentZoom) => {...})`
  updater is fine.
- If lint still flags something, the only candidate is none — re-read after porting and fix
  only what lint reports. Do **not** pre-emptively refactor clean code (minimal-diff rule).

### 4.4 Remove the `as` on `transaction.getMeta`

Reference does `transaction.getMeta(rangesPluginKey) as RangeEvent | undefined`. `getMeta`
returns `unknown`, so a cast is the obvious move — but `as` is banned. Replace with a typed,
runtime-narrowing reader per extension, e.g.:

```ts
function readRangeEvent(transaction: Transaction): RangeEvent | undefined {
  const meta = transaction.getMeta(rangesPluginKey)
  if (meta === undefined || meta === null) return undefined
  if (typeof meta !== 'object') return undefined
  if (!('type' in meta)) return undefined
  // meta.type is 'range_added' | 'range_removed' — narrow on it
  return isRangeEvent(meta) ? meta : undefined
}
```

Write a small `isRangeEvent` / `isAnnotationCommand` / `isProposalCommand` type guard (a pure
calculation, easily unit-tested) that checks the `type` discriminant against the known literals.
This both kills the cast **and** is the kind of pure logic AGENTS wants tested. Keep each guard
small (under the complexity cap).

> If a guard pushes a file over `max-lines` 250 (proposals.ts is at 248), put the guard in a
> sibling file `editor/extensions/proposals-meta.ts` (one export) and import it. Same for
> annotations if needed. ranges.ts has headroom.

### 4.5 `setMeta(...) satisfies XEvent` — **DECIDED: keep `satisfies`, do not ban it**

The reference uses `} satisfies RangeEvent)`. `satisfies` is a **checked** assertion: the compiler
verifies the value really is the type and the value keeps its narrow type — it _cannot_ be used to
lie. That is categorically different from `as` (an unchecked override). It already meets the
project bar ("rules that force good code"): it forces the meta payload to conform. Banning it would
push code toward a _weaker_ explicit annotation, not a stronger one. **Confirmed not banned** in
`eslint/style.mjs` (only `TSAsExpression` and `TSTypeAssertion` are). Keep it as-is.

---

## 5. CSS (App.css) — **DECIDED: already done, add nothing**

`src/renderer/src/App.css` already contains the **complete** editor stylesheet:

- `.ProseMirror { font-size: calc(1.5rem * var(--editor-zoom, 1)); … }` — the zoom var consumer.
- `.ProseMirror .is-editor-empty:first-child::before { content: attr(data-placeholder); … }` —
  placeholder, already token-colored (`var(--text-muted)`). Matches the reference extension's
  `dataAttribute: 'placeholder'` + `emptyEditorClass: 'is-editor-empty'` config exactly.
- All block styles (h1–h3, p, ul/ol, blockquote, code, pre, hr, li markers).
- The full decoration set already token-mapped: `.annotation-info/-warning/-error`,
  `.proposal-insert/-delete/-conflicted`, `.selection-active`, plus the `accept-in` animation.

So there is **nothing to add in this plan**. Do **not** duplicate or re-add any of these. The
only thing to verify: the extensions emit the exact class names App.css expects
(`annotation-info`, `proposal-insert`, `is-editor-empty`, `data-placeholder`) — they do, since
both came from the same reference. If a class name diverges after the rewrites, fix the
_extension_ to match App.css, don't touch the CSS.

---

## 6. Tests to write (the "testable" requirement + 80% gate)

Put each beside its code in `__tests__/`.

1. **`editor/extensions/__tests__/ranges.test.ts`** — pure logic. Build a real editor via a
   small helper (`new Editor({ extensions: editorExtensions, content })` from `@tiptap/core`
   works headless in jsdom). Assert: `setRange` returns a hydrated range with `status:'ok'` when
   text matches; after an edit that changes the span, `getRange` reports `status:'error'` with
   the drift message; `delRange` removes it; `isSameRangeContent` dedup works.
2. **`annotations.test.ts`** — `createAnnotation` adds; `setActiveAnnotation` toggles `activeId`;
   `delAnnotation` clears active if it was active; decoration only present for the active one.
3. **`proposals.test.ts`** — `createProposal` rejects overlaps (`ok:false`); `acceptProposal`
   replaces text when current matches; marks `conflicted` when text drifted; `rejectProposal`
   removes. Plus `proposalDecorations` shape for an insert/delete diff.
4. **Meta guards** (`isRangeEvent` etc.) — table of valid/invalid inputs → boolean.
5. **`hooks/__tests__/useEditorZoom.test.ts`** — `renderHook`; assert default zoom from empty
   localStorage, `setZoom` clamps to [0.75,1.75] and persists, `resetZoom` returns to 1. (Mock
   `window.localStorage` via jsdom; dispatch a `wheel` with `ctrlKey` on the container ref to
   exercise the accumulator, or test the pure `clampZoom`/`normalizeWheelDelta` if you extract
   them — extracting them is cleaner and bumps coverage.)
6. **`components/__tests__/Editor.view.test.tsx`** — render `EditorView` with a real editor +
   stub `containerRef` + `zoom`; assert the `EditorContent` mounts and the `--editor-zoom` style
   is applied. Pure-props render, no providers.
7. **`components/__tests__/Editor.controller.test.tsx`** — render `EditorController`; assert it
   renders nothing while editor is null then the view once ready (or just that it mounts without
   throwing, since `useEditor` is async-ish). Keep light.

Extraction tip: pull `clampZoom`, `normalizeWheelDelta`, `readStoredZoom` out of the hook into a
tiny `hooks/editor-zoom-logic.ts` (pure) so they're unit-tested directly and the hook stays thin.
This both raises branch coverage and matches the "extract logic from actions" rule.

---

## 7. Definition of done (run these, report green)

```
npm run lint
npm run test
npm run type-coverage
npm run build
```

All four must pass ([.agents/AGENTS.md:9](../../.agents/AGENTS.md)). Common failure modes to
expect and their fixes:

- **type-coverage < 95%** — usually the `getMeta` `unknown` handling. The §4.4 guards fix it; if
  a stray `unknown` remains, narrow it, don't cast.
- **lint `no-restricted-syntax` in `Editor.view.tsx`** — you left a hook or `window.api` in the
  view. Move it to the controller.
- **`import-x/no-default-export`** — you kept `export default` from the reference `Editor.tsx`.
- **renderer test can't find `crypto.randomUUID`** — ensure the jsdom env exposes it (Node ≥ 19
  globalThis.crypto does; pluma is on Node 22). If a test needs it deterministic, inject the id
  factory as a parameter in the _test only_, or assert prefix+uniqueness.

---

## 8. Commit

One conventional commit, scope `editor`, e.g.
`feat(editor): port tiptap manuscript editor and extensions to the renderer`. Commit straight to
`main`, no Co-authored-by ([git-workflow] memory + AGENTS §Commits).

---

## 9. Open questions to confirm before starting (leave answers inline)

- [ ] §0 deps approved? (TipTap stack + `diff`)
- [ ] Scrollable: **Base UI ScrollArea** (recommended) or port custom? →
- [ ] Editor CSS: add placeholder + `--editor-zoom` now, defer annotation/proposal colors? →
- [ ] Id strategy: `crypto.randomUUID` (recommended) ok, accepting id format change? →
