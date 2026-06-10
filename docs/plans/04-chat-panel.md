# Plan 04 — Chat panel (the right-hand `ConversationRail`)

Status: **active.** Scoped slice of Plan 03 (§4.4) pulled out so we can build the chat panel
piece by piece. The explorer and the editor column already ship; this plan adds the **right
column**: the design's `ConversationRail` — a single conversation (your message → live activity
steps → compact artifact chips → the editor's reply) with the composer pinned at the bottom, and a
chats list to switch between runs.

**Design contract (non-negotiable):** the rail is defined in `.references/pluma-design/app.jsx`
(`ConversationRail`, `ConversationTurn`, `ChatListRow`, `TurnArtifacts`, `ArtifactToggle`, `LogRow`,
`ThreadDot`, `Empty`, `EdgeTab(side="right")`, plus the pinned composer). We match it **exactly** —
layout, anatomy, spacing, radii, animations, copy, behavior — **with the one standing exception:
the design tokens** (we keep our `App.css` `oklch` palette and reference the design's _structure_
through our token names). Rewrite the prototype's inline `style={}`/`let`/`onMouseEnter` DOM
mutation to our standards (Tailwind + token vars, hover via CSS, `const`-only) while keeping the
rendered result identical.

What we do **not** ship from the prototype: the `panels`-experience `Rail` (Artifacts/Status tabs,
`ThreadBubble`/`ThreadList`/`ThreadDetail`, `ArtifactsList`). The locked tweaks render the
`conversation` experience, where the rail **is** the chat. Port only `ConversationRail` and its
children.

---

## Progress (updated 2026-06-10)

Pick up the next unchecked item in §3. What has landed so far:

- **F2 — DONE.** The thread/run model is the pure reducer in
  [activity-log.ts](../../src/renderer/src/rail/activity-log.ts) (folds the AG-UI stream into an
  `AgentActivity = { status, startedAt, log[], summary }`) plus its thin subscribing shell
  [useAgentActivityLog.ts](../../src/renderer/src/rail/useAgentActivityLog.ts). Per-step copy is
  injected as `labels` so the pure module holds no strings. Unit-tested. **Lives under `rail/`, not
  `agent/`:** its output shape is the rail's render model and only `rail/` consumes it. `agent/` stays
  the reusable agent _framework_ (`useAgent`, `useFrontendTool`, `useToolBridge`, the `Agent` adapter,
  `tools/`) that any slice uses; the activity fold is rail-specific display logic.
- **F3 (conversation half) — DONE.** Ported the conversation-experience turn anatomy as pure views:
  [ThreadDot.view.tsx](../../src/renderer/src/rail/ThreadDot.view.tsx),
  [LogRow.view.tsx](../../src/renderer/src/rail/LogRow.view.tsx), and
  [ConversationTurn.view.tsx](../../src/renderer/src/rail/ConversationTurn.view.tsx) (user bubble →
  collapsible activity timeline → in-turn Stop → streamed reply). Inline styles rewritten to Tailwind +
  our tokens; exact sub-scale pixel geometry goes through `style`. The design's `surface-inverse-*`
  user-bubble tokens we don't have → uses the accent pairing (`bg-action-primary`/`text-on-accent`) the
  composer's Send button already uses, per the design-tokens exception. Snapshot/props tested.
  `TurnArtifacts`/`ChatListRow` remain deferred (F5 / Q5).
- **F4 — DONE.** [ConversationRail.controller.tsx](../../src/renderer/src/rail/ConversationRail.controller.tsx)
  now runs a real turn: `useAgent` + `useAgentActivityLog`, submit → `agent.addMessage` +
  `agent.runAgent()`, **Stop → `agent.abortRun()`**, and the activity feed renders live. Owns the
  expand-while-working / collapse-when-finished state as a _derived_ value (a nullable user override,
  no effect — the `set-state-in-effect` rule). Tested against a fake agent driving canned AG-UI events.
- **F6 (en) — DONE.** Added the rail's activity copy to `en.json` (`worked`, `step_one`/`step_other`,
  `calling`, `done`, `runError`). `es.json` still deferred — it does not exist for _any_ namespace yet,
  so an es-only-for-the-rail file would be inconsistent; it is a whole-app concern, not rail-specific.
- **F7 (providers + mount) — DONE.** [App.tsx](../../src/renderer/src/App.tsx) wraps the shell in
  `AgentToolsProvider → AgentProvider` (one live agent + `useToolBridge`) and the rail is wired to it.
  The editor does not yet register tools via `useFrontendTool`, so the shared-editor lift (Q3) is still
  open; wrapping both columns now is forward-compatible for when it does.

What this delivers (manual `npm run dev`): typing in the composer runs the agent, the user message
renders as a bubble, the live activity steps stream into the collapsible timeline, the reply streams in
as the turn summary, and **Stop** aborts the run. Lint / test / type-coverage / build all green (306
tests). **Not yet done:** the e2e manifest entry + real-app spec for the rail (see §3 step, below) — held
until the rail feature is complete (it needs an agent e2e fixture; a live-SDK run is non-deterministic).

### Earlier (updated 2026-06-09):

- **B1 + B4 — DONE.** Shared `agent:tool-call` / `agent:tool-result` contracts and their preload typing
  are in [ipc-event-contract/agent.ts](../../src/shared/ipc/ipc-event-contract/agent.ts) and
  [ipc-contract/agent.ts](../../src/shared/ipc/ipc-contract/agent.ts) (`AgentToolCall`,
  `AgentToolResult`, `AgentToolOutput`, `AgentToolResultMessage`); the renderer's
  [tools/types.ts](../../src/renderer/src/agent/tools/types.ts) re-exports them.
- **B2 + B3 — DONE.** [build-options.ts](../../src/main/adapters/agent/claude/logic/build-options.ts)
  offers the run's frontend tools via a per-run MCP server + the stream-holding `PreToolUse` hook; the
  suspend handler and pending map live in
  [tool-bridge.ts](../../src/main/adapters/agent/claude/runtime/tool-bridge.ts) (with `rejectAll` for
  abort/teardown) and [build-tool-server.ts](../../src/main/adapters/agent/claude/runtime/build-tool-server.ts).
  **Q1 is answered:** no Zod converter was added — main converts JSON Schema → Zod itself in
  [json-schema-to-zod.ts](../../src/main/adapters/agent/claude/logic/json-schema-to-zod.ts).
- **F1 — DONE.** [useToolBridge.ts](../../src/renderer/src/agent/useToolBridge.ts) subscribes to
  `agent:tool-call`, dispatches to `registry.byName`, and answers on `agent:tool-result` (unknown tool
  / rejecting handler → error result, never throws so the suspended run can't hang). Wired into
  [AgentProvider.tsx](../../src/renderer/src/agent/AgentProvider.tsx); unit-tested.

**Next: B5 (the gate)** — the round-trip into a _live editor_ — and then **F5 (artifact chips)**, which
B5 unblocks. The conversation/activity/composer/stop half of the rail (F2–F4, F6-en, F7) is now built
and shipping; what remains is the artifact half (B5 → F5), the shared editor instance (Q3), `es.json`
(F6), the design-fidelity pass, and the rail's e2e manifest entry + real-app spec (held until the
feature is complete, since it needs an agent e2e fixture). Do not start F5 until B5 is green.

---

## 0. What "done" looks like

`npm run lint && npm run test && npm run type-coverage && npm run build` all green, then a manual
`npm run dev`:

1. The right column shows the `ConversationRail` (chats list when no chat is open; the conversation
   view when one is). Edge tab on the right when collapsed; `⌘`-faithful, pixel-faithful in light
   **and** dark.
2. Type a message in the rail composer → the agent runs. **Live activity steps stream into the
   conversation** (one `LogRow` per tool call / thinking / text), derived from the AG-UI event
   stream — not a scripted timeline.
3. When the model calls `propose_edit` / `create_annotation`, the tool **executes against the live
   editor** (the D1 round-trip) and the produced artifacts appear as compact chips in the turn; the
   chip checkbox toggles whether the decoration paints in the manuscript, and the chip locates
   (scrolls to) its range.
4. The reply text streams in as the turn's summary; the run lands as a row in the chats list with a
   relative timestamp and artifact count.
5. Abort works (the in-turn **Stop** button cancels the run).

---

## 1. The gap (verified 2026-06-09)

### Already built (do not rebuild)

- **Renderer agent core:** `Agent` (AbstractAgent over IPC, in `agent/adapters/Agent.ts`),
  `route-agent-event`, `to-run-input`, `AgentProvider` (injects the tools snapshot into each run),
  `AgentContext`, `AgentToolsContext`/`AgentToolsProvider`, `useFrontendTool`, `useAgent` (returns
  `{ agent }`, re-renders on `messages`/run-status changes).
- **Frontend tools:** all five handlers + `tools/specs.ts` + `tools/types.ts` and their tests
  (`get_current_document`, `get_current_selection`, `get_ranges`, `create_annotation`,
  `propose_edit`).
- **Backend agent run:** `agent:run` / `agent:abort` IPC + the Claude AG-UI runtime streaming
  `agent:event` (`BaseEvent`). The shared agent wire contract carries `tools: readonly Tool[]`
  already.
- **Shell pieces:** `App.tsx` (explorer + editor column + right edge tab for the explorer only),
  the editor, settings dialog, `EdgeTab` component, i18n `en.json`.

### NOT built — this plan's work

- **Proving the round-trip end to end (B5, the gate).** The round-trip machinery is now built on both
  sides (see Progress below): the model is offered the renderer's tools, a call suspends in main and
  reaches `useToolBridge`, and the result returns inside the run. What is **not** done is the proof
  that it works against a _live editor_: there is no integration test driving a tool call into a real
  headless editor, and `propose_edit` has not been seen to land an inline diff in `npm run dev`. This
  needs the shared editor instance (Q3) first. Until this gate is green, **do not wire the rail's
  artifact chips** — they have nothing real to show.
- **The chat panel UI** — no `ConversationRail` (or any of its children) exists in the renderer.
  `App.tsx` has no rail column, no right-side rail state.
- **The thread/run model** — there is no renderer hook that reduces one run's AG-UI event stream
  into the `{ prompt, status, log[], summary, working, artifacts }` shape the rail renders. This is
  the heart of the **frontend** work.
- **i18n for the rail** — the design's chat copy (`chats`, `newChat`, `composerPlaceholder`,
  `worked`, `step`/`steps`, `stop`, `selectAll`/`deselectAll`, `inEditor`, `noChats`,
  `newChatEmpty`, `openReview`, …) is **not** in `en.json`; `es.json` does not exist.

---

## 2. Split: backend vs. frontend

Two tracks. The **backend track is a hard gate for the artifact half** of the UI — but the
conversation/activity/composer half of the rail can be built and tested against a fake agent in
parallel, because it only consumes the AG-UI event stream that already flows. Sequence so the gate
is proven before wiring chips to real decorations.

### 2.A — BACKEND (`src/main`, `src/shared`, `src/preload`)

This is the D1 round-trip from Plan 02 §1 (resolved) / Plan 03 §3, never built. It makes a frontend
tool call reach the renderer and its result return inside the same run.

**B1. Two new IPC channels (shared contract).** Declared the same generic way folder/file/agent
channels already are.

- **`agent:tool-call`** — event, main → renderer. Payload
  `AgentToolCall = { runId: string; toolCallId: string; toolName: string; args: unknown }`. Add it
  next to `agent:event` in [ipc-event-contract/agent.ts](../../src/shared/ipc/ipc-event-contract/agent.ts).
  `args` stays `unknown` (validated renderer-side — no `as`).
- **`agent:tool-result`** — invoke, renderer → main. Payload
  `AgentToolResult = { runId: string; toolCallId: string; output: AgentToolOutput }`, resolving
  `null`. Add it next to `agent:run` in [ipc-contract/agent.ts](../../src/shared/ipc/ipc-contract/agent.ts).
  The wire can't import the renderer's `tools/types.ts`, so define the shared
  `AgentToolCall`/`AgentToolResult`/`AgentToolOutput` wire types in the shared contract and have the
  renderer's `tools/types.ts` align/re-export from them (single source on the wire).

**B2. Generate SDK tools from `input.tools` (the adapter).** In
[build-options.ts](../../src/main/adapters/agent/claude/logic/build-options.ts), replace `tools: []`:
map each `input.tools` entry (AG-UI `Tool`, JSON-Schema `parameters`) to a
`tool(name, description, schema, handler)`, wrap them in one `createSdkMcpServer`, pass via
`options.mcpServers`. Keep the dummy `PreToolUse` hook the SDK needs to hold the stream open.

- **JSON-Schema → Zod sub-decision.** `tool()` wants a Zod shape; our specs are JSON Schema.
  **Confirm against installed deps first** — if no converter is present, that is a "new dependency →
  ask" decision (flag it; do the conversion in main, never add Zod to the renderer). _(Open
  question Q1.)_

**B3. The suspend handler + pending map (the adapter).** Each generated tool's handler:

```
async (args) => {
  emit AgentToolCall { runId, toolCallId, toolName, args } on agent:tool-call
  const output = await pending[toolCallId]   // resolved by the agent:tool-result invoke handler
  return { content: [{ type: 'text', text: serialize(output) }] }
}
```

Keyed by `toolCallId`; the `agent:tool-result` handler resolves the pending promise. The existing
[tool-result-events.ts](../../src/main/adapters/agent/claude/logic/tool-result-events.ts) already
turns the SDK's echoed result into an AG-UI `TOOL_CALL_RESULT` event — that half stays. **Abort /
teardown must reject every outstanding pending promise** (wire into `agent:abort` and run cleanup).

**B4. Preload typing.** Expose the two channels on `window.api` (the generic `invoke`/`on` surface
the renderer already uses), typed against the shared contract.

**Backend done = the gate (B5).** A test drives a fake `agent:tool-call` through to a real headless
editor, asserts a proposal lands in plugin state and a result is submitted; then `npm run dev` shows
a `propose_edit` inline diff in the manuscript. **Do not wire the rail's artifact chips until this
round-trips.**

### 2.B — FRONTEND (`src/renderer`)

**F1. `useToolBridge` (renderer adapter half of B1).** One effect, lives in `AgentProvider` (where
`window.api` is allowed): subscribe `agent:tool-call` → `registry.byName(toolName)` →
`await entry.handler(args)` → `invoke('agent:tool-result', …)`. Validate `args` against the spec;
unknown tool name → an `error` output, **never throw**. (Depends on B1/B4; testable with a fake
`window.api`.)

**F2. The thread/run model — `useThreads` (or per-run reducer).** A renderer hook that folds the
AG-UI event stream into the rail's data model: one **thread** per run with
`{ id, prompt, status: 'working'|'done'|'error', startedAt, log: LogEntry[], summary, working }`,
where `log` entries come from `TOOL_CALL_START`/`TOOL_CALL_RESULT` (→ `calling`/`success`/`failed`),
text deltas (→ `thinking`/`info`), and `RUN_*` events, and `summary` accumulates
`TEXT_MESSAGE_CONTENT`. This is the central new frontend piece and replaces the prototype's scripted
`thread.log`. _(Open question Q2: exact per-event copy.)_ Drive it off `agent.messages` +
`agent.subscribe` (the same source `useAgent` exposes). Pure reducer = fully unit-testable.

**F3. Leaf/presentational views (pure `.view.tsx`, props only, strings via `t`).** Port:
`LogRow`, `ThreadDot`, `Empty`, `ArtifactToggle`, `TurnArtifacts`, `ChatListRow`, `ConversationTurn`,
`ConversationRail`, plus `EdgeTab(side="right")` (extend/reuse the existing `EdgeTab`). The
`relTime` helper ports verbatim. Snapshot/props tests. Rewrite inline styles → Tailwind + tokens.

**F4. `ConversationRail.controller.tsx`.** Owns the rail's local state (chats-list ⇄ chat view,
composer value, textarea ref, auto-scroll-to-bottom effect), reads threads from F2, runs a turn via
`agent.addMessage({ id, role:'user', content }); agent.runAgent()`, and wires **Stop** →
`agent.abortRun()`. Renders `ConversationRail.view`.

**F5. Artifact chips ↔ editor (depends on the gate, B5).** `TurnArtifacts` derives its items from the
artifacts a turn produced (annotation/proposal ids created by the tool handlers, which already live
in Plan 01's editor plugin state). Wire the checkbox to the artifact-visibility state and the
locate/arrow action to an editor scroll-to-range command. **Until §4.6's shared artifact-visibility
state exists, scope this to: chips render + toggle paint + locate.** (Full artifact cards live in the
`InlinePopover`, which is Plan 03 §4.5, not here.)

**F6. i18n.** Add the rail's keys to `en.json` and create `es.json` for them. No hardcoded strings in
views.

**F7. Mount in `App.tsx`.** Add the right column: `<ConversationRail/>` when `railOpen`, the right
`EdgeTab` when not. Wrap the agent subtree in `AgentToolsProvider` → `AgentProvider` so the registry

- `useToolBridge` are live, and so the editor's tools (`useFrontendTool`) and the rail share one
  agent. The editor instance must be reachable by the tool handlers — lift it into an `EditorProvider`
  if not already (coordinate with the editor column; Plan 03 §4.6 / open question Q3).

---

## 3. Sequencing (each step ends green)

1. ~~**B1 + B4** — shared channels + preload typing.~~ **DONE.**
2. ~~**B2 + B3** — generate SDK tools, suspend handler, pending map, abort cleanup.~~ **DONE.**
3. ~~**F1** — `useToolBridge` in `AgentProvider`.~~ **DONE.**
4. **B5 (GATE)** — prove a `propose_edit` round-trips into the live editor. _Do not proceed to chips
   until green._ Blocked on Q3 (shared editor instance). **← next.**
5. ~~**F2** — `useThreads`/activity reducer + tests.~~ **DONE** (`activity-log.ts` + `useAgentActivityLog`).
6. ~~**F3** — leaf views + snapshot tests.~~ **DONE** for the conversation half (`ThreadDot`, `LogRow`,
   `ConversationTurn`); `TurnArtifacts`/`ChatListRow` deferred to F5/Q5.
7. **F6** — ~~en keys~~ **DONE**; `es.json` still deferred (whole-app concern, no es namespace exists yet).
8. ~~**F4** — `ConversationRail.controller` (composer + run + stop).~~ **DONE.** Auto-scroll-to-bottom
   not yet added (single turn fits; revisit when the chats list / long transcripts land).
9. ~~**F7** — mount in `App.tsx` (rail column + right edge tab + providers).~~ **DONE.** Shared editor
   (Q3) still open — the editor registers no tools yet, so nothing depends on it.
10. **F5** — artifact chips wired to real editor decorations (needs the gate + shared visibility
    state).
11. **Design-fidelity pass** — component-by-component against `app.jsx` (light/dark, en/es, hover/
    active/focus, empty states, the running spinner/`pulseDot` glyphs, the inline-diff transitions).
12. **e2e** — add `rail` + `agent.run`/`agent.abort`/`agent.event` to `e2e/coverage-manifest.ts` with a
    real-app spec (needs an agent e2e fixture, since a live-SDK run is non-deterministic). Held until
    the rail feature is complete so it lands as one coherent change.

---

## 4. Constraints

All of AGENTS' rules apply. The ones that bite here:

- `*.view.tsx` = pure, props only, no hooks beyond render, **no `window.api`**, strings via `t`.
- Only controllers (via hooks) and `**/adapters/**` touch `window.api` — `useToolBridge` lives in
  the provider/adapter layer, never a view.
- No `let`, no `as` (except `as const`), no non-null `!`, no `throw`/`console`, no eslint/ts escape
  hatches. Parse AG-UI events via the `EventType` enum + discriminated union (`switch (event.type)`),
  never cast.
- Tokens are ours: reference the design's structure through `var(--…)` / Tailwind classes backed by
  our tokens. Never paste the prototype's hex/`rgba` literals or inline `style={}`.
- Definition of done includes `npm run test:e2e` for UI work (per AGENTS) — a new rail channel + the
  rail UI need their e2e manifest entry + real-app spec.

---

## 5. Open questions (answer before the gated steps)

- [x] **Q1 — JSON-Schema→Zod (B2): RESOLVED.** No converter was added; main converts the schemas
      itself in [json-schema-to-zod.ts](../../src/main/adapters/agent/claude/logic/json-schema-to-zod.ts).
      No new dependency.
- [ ] **Q2 — Activity-log copy (F2):** the prototype's step text is scripted. What real text do we
      show per AG-UI event (tool start / tool result / thinking / text / run finished/errored)?
      (Affects F2/F3.)
- [ ] **Q3 — Shared editor instance (F7):** add an `EditorProvider` so the tool handlers and the
      manuscript share one `Editor`? (Blocks F5/F7; coordinate with the editor column.)
- [ ] **Q4 — Artifact-visibility state (F5):** the chip checkboxes toggle whether a decoration paints
      in the manuscript. Where does that visibility state live — App-shell-owned (`activeKeys`, per
      Plan 03 §4.6) or derived from editor plugin state? (Blocks F5.)
- [ ] **Q5 — Multiple threads:** is the chats list backed only by the in-session runs (lost on
      reload), or do we persist threads? Default for this plan: **in-session only** (YAGNI).
