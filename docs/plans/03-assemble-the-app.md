# Plan 03 — Assemble the app: bridge the tools, build the shell, match the design exactly

Status: **active.** This is the "put the pieces together" plan. Plan 01 (editor) and Plan 02 (agent

- frontend tools, renderer half) are done. The backend file/folder use cases + watcher are done. What
  is left is the seams between them and the UI shell.

**Design contract (non-negotiable):** the final design lives in `.references/pluma-design/`
(`index.html` = tokens + global CSS, `app.jsx` = every component, `icons.jsx` = the icon set). We
follow it **perfectly — no differences**, with **one explicit exception: the design tokens.** We keep
the tokens already defined in our `src/renderer/src/App.css` (the `oklch` palette + Tailwind
`@theme inline` mappings) — these are the **only** thing that differs from the prototype. Everything
else — layout, component anatomy, spacing, radii, animations, copy, behavior — matches the design
exactly. Concretely: where the prototype hardcodes a color/spacing/easing, we render the same structure
but **through our token names** (`var(--color-accent)`, `--surface-3`, Tailwind classes backed by our
tokens), so the design's _shape_ is faithful while the _palette_ is ours. Our other deviations are
purely _architectural_ (real IPC, real TipTap editor, ports/adapters, lint rules), never _visual_ beyond
the token palette.

The prototype has a "tweaks" prototyping layer with three knobs; the **shipped** configuration is the
locked default in `app.jsx`:

```js
TWEAK_DEFAULTS = { experience: 'conversation', barPlacement: 'editor', composerStyle: 'minimal' }
```

So we build exactly **one** layout (no tweaks panel, no `panels`/`rail`/`chat` variants):

- **Left:** `Explorer` (file tree, create/rename/delete, collapsible, edge tab when closed).
- **Center:** editor column = `TopBar` (file tabs + `ArtifactsControl` + settings gear) → `Manuscript`
  (the live TipTap editor) → the floating agent **`Dock`** (idle FAB ⇄ composer ⇄ running status pill).
- **Right:** `ConversationRail` (chats list ⇄ a single chat: user msg → live activity steps → compact
  artifact chips → reply, with the composer pinned at the bottom). Edge tab when closed.
- **Modals/overlays:** `SettingsModal` (theme + language), `InlinePopover` (note/proposal anchored to
  a clicked decoration in the manuscript).

Everything `panels`-only (`Rail` with Artifacts/Status tabs, `DecorationBar` rail variant, `ChatDock`)
is **out of scope** — it's a prototype branch we never ship. Port only what the locked tweaks render.

---

## 0. What "done" looks like

`npm run lint && npm run test && npm run type-coverage && npm run build` all green, then `npm run dev`:

1. App opens to the three-column shell, pixel-faithful to `.references/pluma-design` in light **and**
   dark, in English **and** Spanish.
2. Left explorer lists the real picked folder; create/rename/delete a file/folder hits the real
   main-process use cases and the OS watcher reflects external changes.
3. Click a file → it opens as a tab and loads into the TipTap manuscript.
4. Type a request in the dock/rail composer → the agent runs; live steps stream into the rail; when
   the model calls `propose_edit`/`create_annotation`, **the tool actually executes against the live
   editor** (the D1 round-trip) and an inline proposal/annotation appears in the manuscript that you
   can accept/reject from the inline popover and from the rail's compact artifact chips.
5. The reply streams in; the thread lands in the chats list.

---

## 1. The gap (verified 2026-06-07)

### Already built (do not rebuild)

- **Backend:** file create/delete/write, folder create/delete/list/pick/watch use cases + IPC
  handlers; the Claude AG-UI runtime agent (`agent:run`/`agent:abort` + `agent:event` stream).
- **Shared IPC:** a **generic** typed contract — `window.api.invoke(channel, input)` and
  `window.api.on(channel, cb)` over `IpcContractDefinition`/`IpcEventContractDefinition`, **not** the
  bespoke `runAgent`/`onAgentEvent` methods Plan 02 assumed. Any new channel is added the same way.
- **Renderer editor:** TipTap editor + extensions (ranges, annotations, proposals, proposal
  decorations, placeholder), zoom, `Editor.controller`/`Editor.view`.
- **Renderer agent:** `Agent` (AbstractAgent over IPC), `route-agent-event`, `to-run-input`,
  `AgentProvider`, `AgentContext`, `AgentToolsContext`/`AgentToolsProvider`, `useFrontendTool`,
  `useAgent`, and all five tool handlers + specs + tests.

### NOT built — this plan's work

- **D1 round-trip (the big one).** `build-options.ts` still hardcodes `tools: []`; **there are no
  tool-call / tool-result IPC channels and no `useToolBridge`.** Today the model is offered no tools
  and nothing executes against the editor. This is the heart of "wire the backend↔frontend tool
  bridge." See §3 — it is a gate; nothing visual matters until a `propose_edit` round-trips.
- **The entire UI shell.** `App.tsx` renders only `<EditorController/>`. No Explorer, no rail, no
  TopBar/tabs, no Dock, no SettingsModal, no InlinePopover, no layout, no i18n surface, no theme
  switch. The design's components don't exist yet as components.
- **Structural CSS gaps (NOT the palette).** `App.css`'s token palette is **kept as-is** (the one
  intended deviation from the design). But it's missing the _structural_ pieces the design needs,
  expressed in our tokens: line/hover tokens (`--line*`, `--hover`), a defined `--surface-inverse-1`
  (mapped in `@theme` but undefined in `:root`/dark), the layout/motion tokens (`--rail-w`,
  `--explorer-w`, `--ease`/`--ease-emph`), some keyframes (`diffIn`/`acceptIn`/`annotIn` equivalents),
  the `.scrollbar` styling, and extra decoration states. Add these _additively_ (§5) — never change an
  existing palette value.
- **File/editor wiring.** Editor loads empty `''`; not connected to the explorer selection, to file
  read/write, or to the agent tools.

---

## 2. Sequencing (do in this order; each step ends green)

1. **Structural CSS (§5).** **Keep the existing token palette.** _Additively_ add the missing
   structural tokens (line/hover/inverse-surface, in our palette via `color-mix`), layout/motion tokens
   (`--rail-w`/`--explorer-w`/`--ease`/`--ease-emph`), the missing keyframes, `.scrollbar`, and extra
   decoration states — all in our tokens. Extend `@theme inline` for the new tokens. _No palette change;
   this is the structural foundation everything else renders against._
2. **D1 backend round-trip (§3).** New tool-call + tool-result IPC channels; `build-options`/runtime
   generate SDK tools from `input.tools` whose handlers suspend on the renderer. _(GATE: prove a
   `propose_edit` executes against the editor before building rail UI on top of it.)_
3. **`useToolBridge` (§3.4).** Renderer adapter half: `onAgentToolCall → registry.byName → handler →
submitAgentToolResult`. Mount it in `AgentProvider`.
4. **i18n surface (§6).** Port the design's `DICT` (en/es) into the existing `i18n` locales; theme +
   language state with `data-theme` + persistence.
5. **Leaf/presentational components (§4).** Port the design components as `.view.tsx` (pure, props
   only, strings via `t`): `Kbd`, `Empty`, icons, `LabelChip`/`StatusChip`/`TinyBtn`, `NoteCard`,
   `ProposalCard`, `LogRow`, `ThreadDot`, etc. Snapshot/props tests.
6. **Explorer (§4.1)** controller + view, wired to real folder/file IPC use cases + the watcher.
7. **Editor column (§4.2):** `TopBar` (tabs + `ArtifactsControl` + gear), wire `Manuscript` =
   existing editor to the selected file (read on open, write on change), register the editor tools via
   `useFrontendTool`.
8. **Agent Dock (§4.3):** idle FAB ⇄ composer ⇄ running pill, ⌘K/Esc, drives `agent.runAgent()`.
9. **ConversationRail (§4.4):** chats list ⇄ chat turn (activity timeline from AG-UI events, compact
   artifact chips that paint/scroll), composer.
10. **InlinePopover + SettingsModal (§4.5).**
11. **App shell (§4.6):** assemble the three columns + edge tabs + overlays in `App.tsx`, owning the
    shared state (selected file, open tabs, theme, lang, panel open/close, artifact visibility).
12. **Full pass against the design (§7):** side-by-side every component; fix every pixel diff.

---

## 3. D1 — the backend↔frontend tool round-trip (the gate)

Plan 02 §1 resolved D1: **register SDK tools whose handler suspends via the renderer.** That backend
work was never done. Build it now. (Read Plan 02 §1's "Resolved D1" + §D2 first — this implements it.)

### 3.1 Two new IPC channels (shared contract)

Add to `src/shared/ipc`, the same generic way folder/file channels are declared:

- **`agent:tool-call`** (event, main → renderer) carrying
  `AgentToolCall = { runId: string; toolCallId: string; toolName: string; args: unknown }`.
  Goes in `ipc-event-contract/` next to `agent:event`. `args` is `unknown` (validated renderer-side).
- **`agent:tool-result`** (invoke, renderer → main) carrying
  `AgentToolResult = { runId: string; toolCallId: string; output: AgentToolOutput }`, resolving `null`.
  Goes in `ipc-contract/` next to `agent:run`. `AgentToolOutput` is the renderer's existing tool output
  union (`src/renderer/src/agent/tools/types.ts`) — but a **wire** type can't import from renderer.
  Define the shared `AgentToolCall`/`AgentToolResult`/`AgentToolOutput` wire types in the shared
  contract and have the renderer's `types.ts` re-export/align with them (single source on the wire).

### 3.2 Generate SDK tools from `input.tools` (main)

In the Claude adapter, replace `tools: []`:

- Map each `input.tools` entry (AG-UI `Tool`, JSON-Schema `parameters`) to a `tool(name, description,
schema, handler)` and wrap all in one `createSdkMcpServer`, passed via `options.mcpServers`.
- **JSON Schema → Zod:** per Plan 02 §D2.3, the SDK `tool()` wants a Zod shape but our specs are JSON
  Schema. Recommend converting JSON-Schema→Zod in main (keeps the renderer dependency-free). **Confirm
  against installed deps before coding**; if no converter is installed, that's a "new dependency →
  ask" decision (flag it). Do **not** add Zod to the renderer.
- Keep the dummy `PreToolUse` hook the SDK requires to hold the stream open for the suspend.

### 3.3 The suspend handler + pending map (main)

Each generated tool's handler:

```
async (args) => {
  emit AgentToolCall { runId, toolCallId, toolName, args } on agent:tool-call
  const output = await pending[toolCallId]   // resolved by the agent:tool-result invoke handler
  return { content: [{ type: 'text', text: serialize(output) }] }
}
```

Keyed by `toolCallId`; the `agent:tool-result` IPC handler resolves the pending promise. The existing
`tool-result-events.ts` already turns the SDK's echoed result into an AG-UI `TOOL_CALL_RESULT` event —
that half stays. Abort/teardown must reject any outstanding pending promises.

### 3.4 `useToolBridge` (renderer adapter)

One effect, lives in `AgentProvider` (where `window.api` is allowed). Subscribe `agent:tool-call`,
`registry.byName(toolName)`, `await entry.handler(args)`, `window.api.invoke('agent:tool-result', …)`.
Unknown tool name → an `error` output (never throw). Validate `args` against the spec; no `as`.

### 3.5 Prove it (the gate)

A test driving a fake `agent:tool-call` through the bridge into a real headless editor and asserting a
proposal lands in plugin state + a result is submitted. Then a manual `npm run dev`: a `propose_edit`
shows an inline diff in the manuscript. **Do not start the rail UI until this round-trips.**

---

## 4. UI components (port from `app.jsx`, exact)

Architecture rules (AGENTS): `*.view.tsx` = pure, props only, no hooks beyond render, no `window.api`,
strings via `t`. Controllers/`adapters/` own hooks + IPC. No `let`, no `as` (except `as const`), no
non-null `!`, no `throw`/`console`, no eslint/ts escape hatches. The prototype uses inline `style={}`
objects, `let`, ternary-as-statement, and direct DOM mutation in `onMouseEnter` — **rewrite these to
our standards** (Tailwind classes + token vars, hover via CSS, `const`-only) while keeping the **visual
result identical**. "No differences" is about what renders, not about copying prototype code style.

Map of design component → our file (suffix `.view`/`.controller` per the convention):

### 4.1 Explorer — `explorer/Explorer.{controller,view}.tsx`

Design: `Explorer`, `TreeNode`, `NameInput`, `RowActions`/`ActionBtn`, `EdgeTab(side="left")`.
Pure tree helpers (`mapTree`/`insertInto`/`removeNode`/`findNode`/`flattenFiles`) port verbatim (de-`let`
`_nodeSeq`). The controller binds create/rename/delete to the **real** folder/file IPC use cases and
subscribes to `folder:changed` (the watcher) to reconcile the tree. The prototype's in-memory `INITIAL_TREE`
becomes the listing of the picked folder.

### 4.2 Editor column — `editor/TopBar.{view}.tsx`, `editor/ArtifactsControl.{controller,view}.tsx`

- `TopBar`: file tabs (open/close/select), settings gear, and the `ArtifactsControl` slot (the locked
  `barPlacement:"editor"` shows the Artifacts button, not the `DecorationBar` strip).
- `ArtifactsControl`: the popover (Show all / Hide all + a checkbox per artifact toggling whether it
  paints in the manuscript). Bind to the artifact-visibility state (§4.6).
- `Manuscript` = the **existing TipTap editor**, not the prototype's static `DOC`. Wire `EditorController`
  to: load the selected file's markdown on open, persist on change (`file:write`), register the five
  editor tools via `useFrontendTool`, and surface ranges/annotations/proposals through the Plan 01
  extensions. The prototype's `.annot`/`.inline-diff`/`.ed-sel` visuals are already our
  `.annotation-*`/`.proposal-*`/`.selection-active` classes — match the design's _structure_ through
  them, in our palette (reconcile in §5/§7).

### 4.3 Agent Dock — `agent/Dock.{controller,view}.tsx`

Design: `Dock` (idle FAB ⇄ `composing` textarea ⇄ `running` `StatusStrip`), `Kbd`. ⌘K opens, Esc
cancels (port the `keydown` effect into the controller). `onSubmit` → `agent.addMessage(userMsg);
agent.runAgent()`. The running pill's status text comes from the live AG-UI events (reuse the rail's
status derivation). The `onChat` button is a prototype affordance to expand to `ChatDock`, which we do
**not** ship — in the locked `conversation` experience the rail _is_ the chat, so the dock stays the
minimal composer/pill and "chat" just focuses the rail composer.

### 4.4 ConversationRail — `agent/ConversationRail.{controller,view}.tsx`

Design: `ConversationRail`, `ConversationTurn`, `ChatListRow`, `TurnArtifacts`, `ArtifactToggle`,
`LogRow`, `ThreadDot`, `Empty`, `EdgeTab(side="right")`, plus the pinned composer. Two views: chats
**list** ⇄ a single **chat**. A "thread" = one agent run; its `log` (activity timeline) and `summary`
(reply) are **derived from the AG-UI event stream** (TEXT*MESSAGE*_, TOOL*CALL*_, RUN\_\*), not the
prototype's scripted timeline. `TurnArtifacts` chips toggle/scroll editor decorations (bind to §4.6
visibility + an editor scroll-to-range command from Plan 01). Compact artifact chips replace the
prototype's full cards here (full cards live in the `InlinePopover`).

### 4.5 Overlays — `agent/InlinePopover.{view}.tsx`, `settings/SettingsModal.{controller,view}.tsx`

- `InlinePopover`: `NoteCard` + (optional) `ProposalCard`, anchored to a clicked decoration. Accept/
  dismiss/undo a proposal, mark-solved a note — bind to the Plan 01 proposal/annotation commands.
- `SettingsModal`: theme (light/dark `Segmented`) + language (en/es). Esc to close. Drives `data-theme`
  - persisted `lang`/`theme`.

### 4.6 App shell — `App.tsx`

Owns the cross-cutting state the prototype's `App()` holds, trimmed to the shipped feature set: open
tabs + selected file, explorer/rail open, theme, lang, artifact visibility (`activeKeys`) + active/fresh
markers, popover anchor, settings open. Compose: `<Explorer/>` | editor column (`<TopBar/>` →
`<Manuscript/>` → `<Dock/>`) | `<ConversationRail/>`, with the two `EdgeTab`s and the two overlays.
Wrap the agent subtree in `AgentToolsProvider` → `AgentProvider` (so `useToolBridge` + the registry are
live). Lift the `Editor` instance so the tool handlers and the manuscript share one editor (an
`EditorProvider`, per Plan 02 §4.6's open question — resolve it here).

---

## 5. Tokens & global CSS — keep our tokens; add the design's structure on top

**Tokens are the one exception (per the design contract): we keep `App.css` as-is.** Do **not** replace
the `oklch` palette with the prototype's terracotta hex. The token _names_ in `App.css`
(`--surface-1/2/3`, `--surface-inverse-1`, `--text-*`, `--color-accent`, `--color-destructive`,
`--color-success`, `--color-warning`, `--overlay`, `--border`, the Tailwind `@theme inline` mappings,
the light/dark/system blocks) are the contract every component renders against. Components reference the
design's _structure_ but our _palette_.

What this section still has to do — **add the structural CSS the design needs, expressed in our tokens**:

- **Reconcile the design's hardcoded values to token names.** Wherever a prototype style is a literal
  (`#c94f2d`, `rgba(17,16,14,.09)`, `rgba(201,79,45,.16)`…), it maps to the corresponding token:
  `--color-accent`, `--border`/a line token, `color-mix(in srgb, var(--color-accent) 16%, transparent)`,
  etc. **We are missing some token names the prototype leans on** — `--line`/`--line2`/`--line3`,
  `--hover`, and `--surface-inverse-1` (already mapped in `@theme` but **not defined** in `:root`/dark).
  **Decision:** add these as new tokens _in our palette_ (derive from our existing colors via
  `color-mix` on `--text-primary`, matching the prototype's intent of "line = faint ink on surface"),
  so the design's borders/hover/inverse surfaces have a home without importing its hex. Define them in
  both light and dark blocks. This keeps "tokens are ours" true while giving the structure what it needs.
- **Add the layout/motion tokens** the prototype uses that are pure structure (not palette):
  `--ease`/`--ease-emph` (easing curves), `--rail-w:360px`, `--explorer-w:280px`. These are design
  structure, not color — port them verbatim.
- **Fonts:** the prototype uses Source Sans 3 / Source Serif 4. Our `App.css` already declares
  `--font-ui-family`/`--font-editor-family` with those names — **keep ours**. Confirm the font files are
  actually available to the packaged app (the prototype loads them from Google Fonts CDN; an Electron
  build should vendor them). If not vendored, that's a font-asset decision → confirm (see §8).
- **Animations/decorations:** port the design's keyframes/classes, but recolor through our tokens. We
  already have `rise-in`, `pop-in`, `pulse-dot`, `spin` (note our kebab-case vs the prototype's
  `riseIn`/`popIn` — **keep our names**, update components to use them). Add the missing ones the design
  needs: `diffIn`, `acceptIn`, `annotIn` (→ our naming). The editor decoration look already exists as
  `.ProseMirror .annotation-*` / `.proposal-*` / `.selection-active` in our `App.css` — **these are our
  equivalents of the prototype's `.annot`/`.inline-diff`/`.ed-sel`/`.accepted-text`.** Reconcile by
  reusing/extending our existing classes (add `.fresh`/`.solved`/`.has-prop`/`.is-active` states), not
  by importing the prototype's class names. The `.scrollbar` styling exists in the prototype but not
  ours — add it, themed via our tokens (light + dark thumb).
- **Tailwind `@theme inline`:** extend the existing block for any new token added above (line/hover/
  inverse-surface). Components use Tailwind utility classes backed by our tokens, **never** the
  prototype's inline `style={}` literals.

> Net: §5 changes `App.css` only _additively_ (new structural/line/motion tokens + missing keyframes +
> scrollbar + extra decoration states), and **never changes an existing palette value.**

---

## 6. i18n

The design ships a complete `DICT` (en + es) and a `t(k)` helper. Port every key into the existing
`src/renderer/src/i18n/locales/{en,es}.json` (es is new) and route components through the existing i18n
`t`. Language is a setting (`SettingsModal`), persisted, defaulting to `en`. No hardcoded UI strings in
views — lint-relevant and a design requirement (the design is bilingual).

---

## 7. Final design-fidelity pass

Before "done", go component-by-component against `app.jsx` + `index.html`:

- Every spacing, radius, font-size, weight, letter-spacing, color, shadow, and animation matches.
- Light **and** dark, English **and** Spanish.
- Hover/active/focus states (the prototype encodes many in JS `onMouseEnter`; ours are CSS — verify
  parity).
- Empty states, the edge tabs, the ⌘K affordance, the running/working glyphs, the artifact
  chips/checkboxes, the inline diff and accepted-rewrite transitions.
  Use a screenshot diff against the rendered prototype (`index.html`) where practical.

---

## 8. Open questions (answer before starting the gated steps)

- [ ] **D1 / new dep:** is a JSON-Schema→Zod converter already installed, or do we add one (main-only)?
      If neither, confirm adding the dependency. (Blocks §3.2.)
- [ ] **Fonts:** are Source Sans 3 / Source Serif 4 vendored, or do we add the font files? (Blocks §5.)
- [ ] **Editor instance sharing:** add an `EditorProvider` (recommended) so tools + manuscript share
      one `Editor`. (Blocks §4.2/§4.6.)
- [ ] **Thread/run model:** confirm where a "thread" (one run + its derived log/summary/artifacts) is
      assembled from AG-UI events — a renderer hook reducing the event stream per run. (Blocks §4.4.)
- [ ] **Activity log copy:** the prototype's step text is scripted; what real text do we show per
      AG-UI event type (tool start/result, text, run finished)? (Affects §4.4.)
- [ ] Anything in `panels`/`chat`/`rail` tweak branches we actually want to keep? (Default: no — ship
      only the locked `conversation`/`editor`/`minimal` layout.)

```

```
