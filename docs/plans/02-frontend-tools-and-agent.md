# Plan 02 — Frontend tools, AG-UI agent (AbstractAgent), and `useAgent`

Status: **draft to read after Plan 01 is done.** Depends on Plan 01 (the editor + extensions
must exist, because every frontend tool operates on the editor).
Scope: **primarily renderer**, but this feature **cannot be done renderer-only** — it needs a
small, well-defined change to `src/preload` (and possibly a tiny `src/main` IPC handler). Those
cross-boundary changes are called out explicitly in §1 as **DECISIONS**, because Plan 01 was
told "frontend only" and this one is where that constraint has to relax. Do not start coding
until those are agreed.

Reference being adapted: `.references/write-write/src/renderer/src/agent/**` and
`.../src/main/agent/**`. **Important:** the reference uses a _different_ IPC design than this app.
This plan adapts the reference's tool pattern onto this app's **AG-UI + AbstractAgent** foundation
(which the backend already scaffolds). Read §2 (the mismatch) before writing anything.

---

## 0. What "done" looks like (the end-to-end picture)

A user types a message in the agent dock → `useAgent` calls the renderer-side agent → the agent
streams AG-UI events back → as those events arrive, when the model calls a **frontend tool**
(e.g. `propose_edit`), the renderer runs the tool handler **against the live TipTap editor** and
sends the result back so the run can continue → proposals/annotations appear inline in the
editor; assistant text streams into the dock.

Concretely, this plan delivers:

1. A renderer **`AbstractAgent` subclass** (`Agent`) whose `run(input)` returns an
   `Observable<BaseEvent>` fed by the existing IPC bridge (`window.api.runAgent` +
   `window.api.onAgentEvent`).
2. A **frontend-tool registry + handlers** (the five reference tools, minus any we descope),
   each a pure-ish function over the `Editor`.
3. The **tool round-trip**: when the agent needs a frontend tool, the renderer executes it and
   returns an AG-UI `ToolMessage` / tool-result so the backend can resume.
4. A **`useAgent` hook** (the renderer's command+subscription surface) and a thin
   **controller/view** for the agent dock that consumes it.
5. Wiring the tools to the editor instance from Plan 01.

---

## 1. DECISIONS required before coding (cross-boundary)

Plan 01 was renderer-only. This feature has three places where the renderer is not enough.
Resolve these first; each has a recommendation.

### D1 — How does a frontend tool call get _to_ the renderer and its result back?

The backend `RuntimeAgentPort` (`src/main/application/agent/port/runtime-agent.port.ts`) already
models `run → Stream<BaseEvent>` and `abort`. But **there is currently no channel for the
backend to ask the renderer to execute a tool and wait for the answer.** Today's preload
(`src/preload/index.ts`) only has `runAgent`, `abortAgent`, `onAgentEvent` (one-way events).

Two architectures:

- **D1-A — Tools run entirely in the renderer; backend never executes them.** The model's tool
  calls arrive as AG-UI `TOOL_CALL_START/ARGS/END` events on the existing `onAgentEvent`
  stream. The renderer detects a _frontend_ tool call in that event stream, runs the handler on
  the editor, and **submits the tool result as the next turn's input** (an AG-UI `ToolMessage`
  appended to `messages` on the next `runAgent` call), letting the backend's agent loop continue.
  - ✅ No new IPC channel. Fits AG-UI's "tools are declared on the input, results come back as
    messages" model. The backend already accepts `tools` and `messages` in `RunAgentInput`.
  - ⚠️ Requires the backend agent loop to **pause** when it emits a frontend-tool call and
    resume when the tool result message arrives. Need to confirm the Claude adapter does this
    (it should: that's exactly what AG-UI frontend tools are). **Verify** against
    `src/main/adapters/agent/claude/runtime/*` (read-only) before committing to this.
- **D1-B — Add a request/response tool channel** (mirrors the reference's
  `frontend-tool-bridge.ts` + `AGENT_FRONTEND_TOOL_CALL_CHANNEL` / `..._RESULT_CHANNEL`). Backend
  emits a tool-call to the renderer, renderer replies, the backend's in-flight run resolves a
  pending promise and continues **within the same run**.
  - ✅ Single run, no message-replay; matches the reference exactly.
  - ⚠️ Requires **preload + main** changes (two new channels + a pending-promise bridge in the
    adapter). That's backend work this plan would have to own or hand to a backend task.

> **VERIFIED (2026-06-06) — D1-A's premise is FALSE today; neither A nor B works without backend
> changes.** Read the adapter and the Claude SDK before re-reading the rest of this section:
>
> 1. **The adapter drops `input.tools`.** [`build-options.ts`](../../src/main/adapters/agent/claude/logic/build-options.ts)
>    hardcodes `tools: []` and never reads `input.tools`. The `tools` field crosses IPC
>    ([`run-agent-input.ts`](../../src/main/application/agent/data/run-agent-input.ts)) and is then
>    discarded. So whatever specs the renderer sends today reach Claude as nothing.
> 2. **The SDK has no "AG-UI frontend tool" concept.** Custom tools are
>    `tool(name, description, zodShape, handler)` wrapped in `createSdkMcpServer({tools})` and passed
>    via `options.mcpServers`. **The handler runs in-process in main**, not the renderer. There is no
>    way to hand the SDK a bare JSON-Schema spec and have it _not_ execute the tool.
> 3. **The run does not pause.** [`run-event-stream.ts`](../../src/main/adapters/agent/claude/runtime/run-event-stream.ts)
>    folds the `query` async-iterable straight to completion. There is no suspend point.
> 4. **But the SDK _does_ give us a suspend primitive: `canUseTool`.** It is an `async` callback
>    `(toolName, input, {signal}) => Promise<{behavior:'allow', updatedInput} | {behavior:'deny', message}>`
>    that **pauses the query until it resolves.** This — not "AG-UI auto-suspends" — is the real
>    pause/resume hook. (Note the SDK's documented workaround: a dummy `PreToolUse` hook is required
>    to keep the stream open for `canUseTool` in streaming-input mode.)
>
> **Consequence.** "Renderer-only, no backend change" (the old D1-A reasoning) is not achievable on
> the Claude SDK. _Some_ backend work is mandatory. The question is no longer A-vs-B as framed; it is
> **which of two backend shapes** to build. See the resolved decision below, which merges what
> CopilotKit does (specs → JSON Schema → request `tools`; result returns as a message) with what the
> Claude SDK actually exposes (in-process `tool()` handlers + `canUseTool` as the pause point).
>
> **Resolved D1 — registered SDK tools whose handler suspends via the renderer (a refined D1-B).**
> The main process registers one `createSdkMcpServer` whose tools are generated from the specs the
> renderer sends in `input.tools`. Each generated tool's in-process handler does not do editor work
> itself (it can't — the editor is in the renderer); instead it **emits a tool-call to the renderer
> over a new IPC channel and awaits the renderer's result**, then returns that result as the tool's
> `content`. This is the reference's pending-promise bridge, realized through the SDK's own handler
> mechanism rather than a bespoke bus. `canUseTool` (or just the handler's own await) is the pause.
> It needs **preload + main** changes (one call channel + one result channel + the per-call pending
> map in the adapter) — own them in this plan or split to a backend task (see D5/§8 step 10).
>
> Why not the pure-message replay (old D1-A)? Because the SDK won't surface "a frontend tool was
> called, now stop and wait for a message" — it owns the loop and will try to execute any tool it
> knows about. To make it stop, we either don't register the tool (then Claude can't call it) or we
> register it with a handler that suspends (the resolved choice). Pure-message replay would require
> re-implementing the agent loop outside the SDK, which this app explicitly does not do.

### D2 — Tool specs: shape, where they live, and how main turns them into SDK tools

The old framing ("backend just forwards whatever `tools` the renderer sends") is **wrong given
resolved D1**: the Claude SDK can't consume an AG-UI `Tool`/JSON-Schema spec directly — main has to
**generate `tool()`/`createSdkMcpServer` definitions** from the specs. So D2 has three parts.

#### D2.1 — The spec shape: AG-UI `Tool` (JSON Schema), renderer-owned

Keep the wire/spec type as AG-UI's `Tool` (`{ name, description, parameters }`, `parameters` = JSON
Schema), which is already what `RunAgentInput.tools: readonly Tool[]` carries. This matches
CopilotKit's contract exactly — CopilotKit registers tools with a Zod `parameters`, converts Zod →
JSON Schema, and ships that as the request's `tools`. This app's specs are **authored** as JSON Schema
directly (no Zod in the renderer), one per tool. **Decision: the renderer is the single source of
the specs**; the backend receives them per-run and has zero hardcoded tool knowledge (so adding a
tool is a renderer-only change to the spec list + a handler).

**Location: `renderer/src/agent/tools/specs.ts`** — pure data, one `export const <name>Tool: Tool`
per tool + `export const agentToolSpecs = [...] as const`. This is the array passed as `tools` into
`useAgent` → `runAgent` → IPC → `input.tools`. (Unchanged from the original recommendation; what
changed is everything _downstream_ of it.)

> **Naming guard (CopilotKit borrows this too):** the spec `name` is the identity that ties three
> places together — the renderer handler dispatch (`handlers.ts` `switch`), the SDK tool registered
> in main, and the `TOOL_CALL_START.toolCallName` the renderer matches to decide "is this _my_
> tool." Derive all three from the same `agentToolSpecs` names; never restate a literal.

#### D2.2 — Preload typing: two new channels (this is the actual "preload typing" decision)

Resolved D1 needs IPC the current preload doesn't have. Add to `Api`:

- `onAgentToolCall(listener: (call: AgentToolCall) => void): () => void` — main → renderer, "run this
  frontend tool." `AgentToolCall = { runId: string; toolCallId: string; toolName: string; args:
unknown }` (`args` is `unknown`, parsed/validated renderer-side against the spec — **no `as`**).
- `submitAgentToolResult(result: AgentToolResult): Promise<void>` — renderer → main, the answer.
  `AgentToolResult` carries `{ runId, toolCallId, output }` where `output` is the
  `AgentToolOutput` union ported from the reference (`{ ok, ... } | { error, ... }`), serialized to
  text for the SDK tool's `content`.

These two types are the **shared contract**, so they live where both sides import them — put them in
`src/main/application/agent/data/` (next to `run-agent-input.ts`) and import into preload + renderer,
exactly as `RunAgentInput`/`BaseEvent` are already shared across the boundary today. The renderer's
`tools/handlers.ts` produces `AgentToolOutput`; the bridge wraps it into `AgentToolResult`.

#### D2.3 — Main: spec → SDK tool generation (the new backend piece)

In the adapter, replace `tools: []` with a generator that, per run, maps each `input.tools` entry to
a `tool(spec.name, spec.description, /* schema */, handler)` and wraps them in one
`createSdkMcpServer`, passed via `options.mcpServers`. Two snags to design for, both verified above:

- **JSON Schema vs. Zod.** `tool()`'s third arg is a Zod raw shape, but our specs are JSON Schema.
  Either (a) author specs as Zod in a renderer module and JSON-Schema-ify them for the wire (the
  CopilotKit approach), or (b) keep specs as JSON Schema and convert JSON Schema → Zod in main. **(a)
  is cleaner** and matches CopilotKit, but adds a renderer dependency for Zod→JSON-Schema; **(b)**
  keeps the renderer dependency-free. **Recommend (b)** for YAGNI/no-new-dep unless a converter is
  already present — flag as a sub-decision to confirm against installed deps before coding.
- **The handler is the suspend point.** Each generated tool's handler is
  `async (args) => { emit AgentToolCall to renderer; await pending result; return { content:[{type:'text', text: serialize(output)}] } }`.
  The pending-promise map is keyed by `toolCallId`; `submitAgentToolResult` resolves it. Keep the
  dummy `PreToolUse` hook the SDK requires to hold the stream open. The existing
  [`tool-result-events.ts`](../../src/main/adapters/agent/claude/logic/tool-result-events.ts) +
  the `tool_result` modelling in [`sdk-types.ts`](../../src/main/adapters/agent/claude/data/sdk-types.ts)
  already turn the SDK's echoed tool results into AG-UI `TOOL_CALL_RESULT` events — that half of the
  round-trip exists; only the call-out/await half is missing.

> **Net D2 answer:** specs are renderer-owned AG-UI `Tool` data in `tools/specs.ts` (CopilotKit-style
> single source); preload gains `onAgentToolCall` + `submitAgentToolResult` typed against shared
> `AgentToolCall`/`AgentToolResult` in `application/agent/data`; main generates SDK `tool()`s from
> `input.tools` whose handlers suspend on the renderer via those channels. This is what connects the
> frontend tool spec to the Claude backend.

### D3 — Does the agent UI exist yet?

The reference has an `AgentDock` (composer + status + activity log). Plan 02 should deliver the
**minimum**: a composer to send a message and a place to show streaming assistant text. The rich
activity log / proposal cards / annotation rail are **follow-up** (descope to Plan 03 unless you
want them now). **Recommend** minimum dock now.

---

## 2. The reference-vs-app mismatch (read this before porting)

| Concern           | Reference (`write-write`)                                  | this app (today)                                                      | Implication for this plan                                                   |
| ----------------- | ---------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| IPC surface       | generic `window.api.on(channel, …)` / `invoke(channel, …)` | fixed typed `Api` (`runAgent`, `abortAgent`, `onAgentEvent`)          | Can't copy reference hooks verbatim; rewrite against the app's `Api`.       |
| Event model       | bespoke `AgentRuntimeEvent`                                | **AG-UI `BaseEvent`** stream                                          | Use AG-UI event types; parse `TOOL_CALL_*`, `TEXT_MESSAGE_*`, `RUN_*`.      |
| Agent abstraction | none on the renderer (hooks call IPC directly)             | backend port named after **AG-UI `AbstractAgent`**                    | Renderer should have a real `AbstractAgent` subclass so `useAgent` is thin. |
| Tool transport    | dedicated call/result channels + pending-promise bridge    | **none yet** (resolved D1: build the same, via SDK `tool()` handlers) | Two new IPC channels + main generates SDK tools from `input.tools`.         |
| Tool specs        | `shared/agent/tools.ts` (shared main+renderer)             | renderer-local registry (`useFrontendTool`); main maps to SDK tools   | Specs live in renderer; spec+handler co-located in a registry (§3.5).       |

The **tool handlers themselves** (`tool-propose-edit.ts`, `tool-get-ranges.ts`, etc.) port almost
verbatim from the reference — they're pure functions over `Editor` and the Plan 01 extensions.
What changes is _everything around how they're invoked_.

---

## 3. Target layout (renderer)

Under `src/renderer/src/agent/`:

```
agent/
  Agent.ts                 # AbstractAgent subclass; run() bridges IPC -> Observable<BaseEvent>
  AgentProvider.tsx             # provides the Agent instance + the tools registry (one context tree)
  AgentToolsContext.tsx         # the registry: register(entry)/unregister(name)/snapshot()/byName(name)
  useFrontendTool.ts            # registers one { spec, handler } into the registry for the component's life
  useAgent.ts                   # returns { agent, send }; send snapshots the registry into input.tools
  useToolBridge.ts              # the one effect: onAgentToolCall -> registry.byName -> handler -> submit
  tools/
    specs.ts                    # AG-UI Tool specs (data) — names/descriptions/JSON schema
    tool-get-current-document.ts
    tool-get-current-selection.ts
    tool-get-ranges.ts
    tool-create-annotation.ts
    tool-propose-edit.ts
    __tests__/...               # one test per handler
  AgentDock.controller.tsx      # wires useAgent + useFrontendTool(editor) + useToolBridge -> view
  AgentDock.view.tsx            # pure composer + streaming transcript
  __tests__/...
```

> **What changed vs. the original sketch (see §3.5 for the why):** there is no `handlers.ts`
> `switch` dispatcher — the **registry replaces it** (look the handler up by name). Specs and
> handlers are co-located at registration via `useFrontendTool` (CopilotKit's idea), so they can't
> drift. `useFrontendTools.ts` (plural, the old editor-subscription) is split into the passive
> registry (`AgentToolsContext` + `useFrontendTool`) and the active `useToolBridge`.

Ports/adapters note: AG-UI's `AbstractAgent` _is_ effectively the renderer's "port to the
backend agent". If you want to honor AGENTS' `ports/`+`adapters/` split literally, you can model
it as: a `ports/agent.port.ts` interface (`send`, `subscribe`, `abort`) implemented by an
adapter that wraps `Agent` over `window.api`. **Recommend** keeping `Agent` as the
adapter directly (it already is the abstraction) and supplying it through context like the
notes/repos pattern in AGENTS §"Ports and adapters in the renderer", so tests inject a fake agent.

---

## 3.5 Renderer hook design — `useFrontendTool`, `useAgent`, the registry (READ FIRST)

The renderer surface is three concepts that meet at **one shared registry**. This design borrows
CopilotKit's ergonomics (a `useFrontendTool`/`useCopilotAction`-style hook that co-locates a tool's
spec and handler; a `useAgent` that returns the agent so you call its methods) and adapts the one
place this app differs: its tools live in a renderer registry and must be **injected into
`input.tools` per run**, because the backend builds Claude's options once per `query()` (see the
"per-run, not mid-run" note below).

### The registry is the seam

`AgentToolsContext` holds `ToolEntry[]`, where `ToolEntry = { spec: Tool; handler: (args) =>
Promise<AgentToolOutput> }`. It has exactly four operations: `register(entry)`, `unregister(name)`,
`snapshot(): readonly Tool[]` (the specs, for a run), `byName(name): ToolEntry | undefined` (for
dispatch). Three readers touch it, and that's the whole architecture:

```
                ┌─────────────────────── AgentToolsContext (registry) ───────────────────────┐
 useFrontendTool│ register({spec,handler}) on mount, unregister(name) on unmount             │
                │                                                                              │
 AgentProvider  │ injects tools = registry.snapshot() into the agent's runAgent params,       │
   (tool inject)│ so a bare agent.runAgent() already carries the tools (CopilotKit behavior)   │
                │                                                                              │
 useToolBridge  │ onAgentToolCall(call) ─► entry = registry.byName(call.toolName)             │
                │                          output = await entry.handler(call.args)            │
                │                          submitAgentToolResult({ ...call, output })          │
                └──────────────────────────────────────────────────────────────────────────┘
```

Because spec + handler are registered **together**, the name can't drift between "what Claude is
offered" and "what runs when Claude calls it." This is why there is **no `handlers.ts` dispatcher**:
`registry.byName` _is_ the dispatch.

### Concept 1 — `useFrontendTool(entry, deps?)` (the CopilotKit-style hook)

```ts
// registers the tool for the lifetime of the calling component
useFrontendTool({
  spec: proposeEditTool, // AG-UI Tool (from tools/specs.ts)
  handler: (args) => proposeEdit(editor, args) // pure fn over the editor; returns AgentToolOutput
})
```

It pushes the entry into the registry on mount and removes it on unmount (an effect keyed by
`spec.name` + `deps`). Passive — it never calls the agent or touches `window.api`. A tool that only
makes sense in a context (e.g. needs a live selection) is simply registered by the component that
owns that context; when that component isn't mounted, Claude isn't offered the tool **on the next
run**. We keep this thin: **no `render`/status machinery** (CopilotKit's `render` for inline tool UI
and `useHumanInTheLoop`'s `respond` are explicitly out of scope — see "Future" below). For now
`spec.parameters` is authored JSON Schema directly (no Zod dep), matching D2.1.

### Concept 2 — `useAgent(): { agent }` (the letter of CopilotKit's interface)

CopilotKit's `useAgent` returns exactly **`{ agent }`** — the `AbstractAgent` itself. The hook adds
**no methods of its own**; it only subscribes the component to the agent's
`messages`/`isRunning`/`state` mutations so React re-renders. We follow this to the letter: callers
use AG-UI's real methods, which already cover everything (no custom `send`).

```ts
const { agent } = useAgent()
// reads (reactive): agent.messages, agent.isRunning, agent.state
// run:              agent.addMessage({ id, role: 'user', content: text }); agent.runAgent()
// abort:            agent.abortRun()
// subscribe:        agent.subscribe(subscriber)
```

- **`agent`**: the `Agent` (our `AbstractAgent`) from `AgentProvider`. The hook wires
  `useSyncExternalStore(agent.subscribe, () => agent.messages)` (and `isRunning`) so the component
  re-renders on agent state changes. We inherit AG-UI's event reduction (message/state application)
  for free — we do **not** re-implement event-to-state folding.
- **No `send`.** AG-UI's `runAgent(parameters?)` takes `tools` as a first-class field
  (`RunAgentParameters = Partial<Pick<RunAgentInput, 'runId'|'tools'|'context'|'forwardedProps'>>`,
  `@ag-ui/client`), so there is no need to invent a method to "inject tools" — `tools` is just a
  parameter. A controller runs a turn with `agent.addMessage(userMsg); agent.runAgent()`, exactly the
  AG-UI surface.

**So where do the tools get injected?** In **`AgentProvider`**, not in the hook — this is precisely
how CopilotKit makes a bare `runAgent()` "just work": the provider that owns the agent also owns the
registry and ensures `runAgent`'s params carry `tools = registry.snapshot()` (e.g. the provider holds
the agent instance and merges the snapshot into params before each run, or via a thin
`runAgent`-wrapping middleware/`use(...)`). The hook's return stays exactly `{ agent }`; the
registry→`tools` coupling lives in the provider, invisibly. This keeps both interfaces faithful:
`useFrontendTool` registers, `useAgent` returns `{ agent }`, and `agent.runAgent()` already carries
the registered tools.

### Concept 3 — `useToolBridge()` (the round-trip)

One effect, lives in the provider/controller. Subscribes `window.api.onAgentToolCall`, looks the
entry up in the registry, runs its `handler`, and calls `window.api.submitAgentToolResult`. It is
the renderer **adapter** half of resolved D1's two channels — so it lives where the lint allows
`window.api` (an `adapters/`-style location or a controller), never in a `.view.tsx`. An unknown
tool name (no registry entry) returns an `error` output, never throws.

### Per-run, not mid-run (a constraint to design around, not fight)

The Claude SDK builds `options` (incl. the registered `tool()`s) **once per `query()`**. So the tool
set is fixed for the duration of a single run; it cannot grow/shrink mid-run. This is fine: within a
run Claude re-calls the same tools as needed; a changed registry (a newly mounted tool) takes effect
on the **next** `runAgent`, because the provider re-snapshots the registry into the run's `tools`. Do
**not** design for mid-run tool mutation (YAGNI).

### Future (explicitly out of scope, but the design leaves room)

- **`useHumanInTheLoop`** = a `ToolEntry` with **no JS `handler`**; instead a `render` UI calls
  `respond(value)` and that value becomes the output. Same registry, same bridge, same channels —
  the bridge would, for a handler-less entry, hand the call to a UI and await `respond`. Adding it
  later is additive (a second registration hook + an optional `render` on `ToolEntry`); nothing here
  blocks it.
- **Inline tool `render`** (CopilotKit's progress UI / proposal cards) → Plan 03.

---

## 4. Component-by-component spec

### 4.1 `Agent extends AbstractAgent`

`AbstractAgent.run(input: RunAgentInput): Observable<BaseEvent>` is the one abstract method
(confirmed in `@ag-ui/client` dist: `abstract run(input): Observable<BaseEvent>`). Implement it
by bridging the existing IPC:

```ts
// header comment: renderer AG-UI agent; bridges window.api IPC to an Observable<BaseEvent>.
import { AbstractAgent, type RunAgentInput } from '@ag-ui/client'
import type { BaseEvent } from '@ag-ui/core'
import { Observable } from 'rxjs' // rxjs is already installed (AG-UI dep)

export class Agent extends AbstractAgent {
  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((subscriber) => {
      const off = window.api.onAgentEvent((event) => subscriber.next(event))
      window.api
        .runAgent(toRunInput(input))
        .then((result) => {
          if (!result.ok) subscriber.error(result.error)
        })
        .catch((err) => subscriber.error(err))
      // completion: when a RUN_FINISHED/RUN_ERROR event arrives, complete the subscriber
      // (do that inside the onAgentEvent callback by checking event.type), then off().
      return () => off()
    })
  }
}
```

Details to get right:

- **Filtering by runId.** `onAgentEvent` is a global stream; if multiple runs can overlap, filter
  events to the active `runId` (the backend mints it; `runAgent` returns `{ runId }`). Keep a
  per-`run()` runId and ignore events for others. For the minimal dock, runs are sequential, so a
  single active-run guard suffices — but write it to filter from the start.
- **Completion.** Complete the Observable on `EventType.RUN_FINISHED`; error it on
  `EventType.RUN_ERROR`. Use the `EventType` enum from `@ag-ui/core` (don't string-match).
- **Teardown.** Unsubscribe must call the `off()` returned by `onAgentEvent` and `abortAgent`
  the run if still in flight.
- **`max-params` 2 / `max-statements` 12 / `complexity` 8** — the `run` body is close to the
  statement cap. Extract the event-routing (`event -> next|complete|error`) into a pure helper
  `routeAgentEvent(event, subscriber)` so `run` stays small and the routing is unit-testable.

`toRunInput` maps the AG-UI `RunAgentInput` (runId/messages/tools/context/forwardedProps)
to the IPC `RunAgentInput` (`messages`, `threadId?`, `tools`, `state?`). Pure calculation, test it.

### 4.2 Tool specs — `tools/specs.ts`

Port the five `*Tool` consts from the reference `shared/agent/tools.ts` but as **AG-UI `Tool`**
shape (name, description, `parameters` = JSON schema). Confirm AG-UI's `Tool` field name for the
schema (`parameters`) against `@ag-ui/core` (`type Tool = z.infer<typeof ToolSchema>` around line
3285 of its dist). Keep the inputSchemas identical to the reference. One export per spec +
`export const agentToolSpecs = [...] as const`. This is the array passed as `tools` into
`useAgent`/`runAgent`.

Descope check: do we want all five now (`get_current_document`, `get_current_selection`,
`get_ranges`, `create_annotation`, `propose_edit`)? **Recommend** porting all five — they're
small and interdependent (`get_ranges` → `propose_edit`/`create_annotation`).

### 4.3 Tool handlers — `tools/*.ts` (no dispatcher; see §3.5)

Each handler is a pure-ish fn `(editor, args) => AgentToolOutput`, registered with its spec via
`useFrontendTool` (the registry replaces the old `handlers.ts` `switch` — dispatch is
`registry.byName`). Port verbatim from the reference (they already operate on `Editor` and Plan 01's
extensions):

- `tool-get-current-document.ts` → `editor.getMarkdown()` (the `@tiptap/markdown` storage API;
  confirm the method name on the installed version — reference uses `editor.getMarkdown()`).
- `tool-get-current-selection.ts` → uses `editor.storage.markdown.manager.serialize(...)` +
  `setRange` from Plan 01.
- `tool-get-ranges.ts` → text index + match; **de-`let`** the two `let` accumulators
  (`text`, `index`) — rewrite `createDocumentTextIndex` with a reducer/`flatMap` over
  `descendants`, and `findMatches` recursively or with a generated index array. This file has
  several `let`s and is the main rewrite (see §6).
- `tool-create-annotation.ts`, `tool-propose-edit.ts` → verbatim, using Plan 01's
  `getRange`/`createAnnotation`/`createProposal`.
  Define `AgentToolResult` / `AgentToolOutput` locally in the renderer (port the types from the
  reference `shared/agent/tools.ts`). Reconcile `AnnotationSeverity` with Plan 01's local copy —
  **single source**: export it from Plan 01's `editor/extensions/annotations.ts` and import here.

### 4.4 Registry + hooks — see §3.5 (the design lives there)

§3.5 is the source of truth for `AgentToolsContext`, `useFrontendTool`, `useAgent` (`{ agent, send }`),
and `useToolBridge`. The notes below are only the implementation reminders that don't fit §3.5:

- **`AgentToolsContext`**: `register`/`unregister`/`snapshot`/`byName` over `ToolEntry[]`. Stored in a
  ref + a version counter (or `useSyncExternalStore`) so `register`/`unregister` don't re-render every
  consumer — the snapshot is read imperatively at `send` time, not subscribed to.
- **`useFrontendTool`**: effect keyed on `spec.name` + `deps`; `register` on mount, `unregister` on
  cleanup. Guard against duplicate names (warn, like CopilotKit).
- **`useToolBridge`**: the renderer **adapter** half of D1's channels — touches `window.api`
  (`onAgentToolCall`/`submitAgentToolResult`), so it lives where lint allows it (controller or
  `agent/adapters/`), never a `.view.tsx`. Unknown tool name → `error` output, never throw. Created
  range/annotation/proposal ids live in Plan 01's plugin state — no extra store.
- **`useAgent`**: returns `{ agent }` (the letter of CopilotKit's interface — no `send`). Subscribe
  via `useSyncExternalStore(agent.subscribe, …)` for `messages`/`isRunning`. Tools are injected in
  `AgentProvider` (registry snapshot → `runAgent`'s `tools` param), not in the hook. Callers run a
  turn with `agent.addMessage(userMsg); agent.runAgent()` — the public `runAgent` drives
  apply/subscribe and returns `RunAgentResult`. Agent supplied via `AgentProvider`/`useAgentInstance`
  so tests inject a fake `AbstractAgent` emitting canned events — no IPC, per AGENTS §frontend testing.

### 4.6 Dock controller + view

- `AgentDock.view.tsx` (pure): composer (Base UI `Input` + `Button`/send), a transcript area
  rendering streamed assistant text, a status indicator. Props only. Strings via `t`.
- `AgentDock.controller.tsx`: `const editor = ...` (from Plan 01's editor context or lifted
  state), `const { agent } = useAgent()`, register the editor tools with `useFrontendTool`
  (one call per tool, or a small `useEditorTools(editor)` that does them), `useToolBridge()`, render
  the view with `agent.messages`, `agent.isRunning`, and an `onSend` that does
  `agent.addMessage({ id, role: 'user', content: text }); agent.runAgent()`.
- Wire the editor + dock together: the editor instance from Plan 01 must be reachable by the
  tool handlers passed to `useFrontendTool`. **Recommend** lifting the `Editor` into a context
  (`EditorProvider`) in Plan 01's mount step, or having a single parent that owns
  `useManuscriptEditor` and passes the editor to both `EditorView` and `AgentDock.controller`.
  Note this back into Plan 01 if you want the provider added there.

---

## 5. Constraints (same as Plan 01, plus)

All of Plan 01 §2 applies. Additional ones that bite here:

- **`*.view.tsx` no hooks / no `window.api`** — the dock view is pure; all agent state comes via
  props from the controller.
- **Only controllers (via hooks) and `**/adapters/**`may touch`window.api`**
  ([architecture.mjs:59](../../eslint/architecture.mjs)). `Agent.ts` touches `window.api` —
  so it must live somewhere the lint allows it. It is **not** a `.tsx`, so the
  `noDirectIpcInComponents` rule (which targets `*.tsx`) doesn't catch it — **but** keep it under
  an `adapters/` folder anyway for honesty and to match the pattern. **Verify** the lint scope:
  the `window.api` ban is on renderer `*.tsx` only; `.ts` modules like `Agent.ts` are not
  restricted by that block. Still, put IPC-touching code in `agent/adapters/`.
- **No `let`** — `tool-get-ranges.ts` is the big offender (§6).
- **No `as`** — parsing AG-UI events: use the `EventType` enum + the discriminated union from
  `@ag-ui/core`; narrow with `switch (event.type)`, never cast.

---

## 6. The specific rewrites

### 6.1 `tool-get-ranges.ts` de-`let` (the main one)

Reference uses `let text = ''`, `let index = ...`, and `for (let i …)` loops. Rewrite:

- `createDocumentTextIndex`: collect `{char, pos}` pairs by reducing over `descendants`. Since
  `descendants` is a visitor (returns void), accumulate into a `const chars: {c:string;p:number}[]`
  via `.push` inside the visitor (pushing to a `const` array is allowed — it's not reassignment),
  then derive `text = chars.map(x=>x.c).join('')` and `positions = chars.map(x=>x.p)`. No `let`.
- `findMatches`: replace the `let index = indexOf; while(...)` with a recursive helper
  `collect(from: number, acc: readonly number[]): readonly number[]` or generate all indices via
  a functional scan. Keep it under complexity 8.
- The `for (let index = 0; index < node.text.length; index++)` becomes
  `[...node.text].forEach((c, i) => chars.push({ c, p: position + i }))` or
  `Array.from(node.text, (c, i) => ...)`. (Beware surrogate pairs — `node.text.length` vs
  spread; match the reference's char-by-char semantics, which uses `.length`/index, so use a
  plain index map: `Array.from({length: node.text.length}, (_, i) => ...)`.)

Test it hard: single match → ok with rangeId; zero → `not_found`; multiple → `ambiguous` with
preview. This handler is the trickiest; give it its own thorough test.

### 6.2 AG-UI event routing without `as`

Build `routeAgentEvent(event, subscriber)` and any "is this a frontend tool call" check using
`event.type === EventType.TOOL_CALL_START` etc. The tool name lives on `ToolCallStartEvent`
(`toolCallName`/`toolCallId` — confirm field names in `@ag-ui/core` dist). Match against
`agentToolSpecs` names. All narrowing via the enum + union; zero casts.

### 6.3 `getMarkdown()` API check

Confirm the markdown serialization method on the installed `@tiptap/markdown` (`editor.getMarkdown()`
in the reference). If the installed major differs, use the documented call
(`editor.storage.markdown.getMarkdown()` or `...manager.serialize`). Verify before relying on it.

---

## 7. Tests

Per AGENTS, every use case (here: each tool handler, the event router, the input mapper) needs
tests; UI gets view/controller/hook tests with fakes.

1. **Each tool handler** — construct a headless editor (Plan 01 helper), seed content/ranges,
   assert `AgentToolResult` for success and each failure (`range not found`, drifted text,
   overlap, ambiguous). This is the bulk of the coverage.
2. **`handlers.ts` dispatch** — each tool name routes to the right handler; unknown name handled.
3. **`routeAgentEvent`** — table of AG-UI events → `next`/`complete`/`error` calls (use a spy
   subscriber). Cover `RUN_FINISHED`, `RUN_ERROR`, `TEXT_MESSAGE_CONTENT`, `TOOL_CALL_START`.
4. **`toRunInput`** — mapping correctness.
5. **`Agent`** — inject a fake `window.api` (`onAgentEvent` emits canned events,
   `runAgent` resolves `{ok:true,{runId}}`); subscribe to `run(...)` and assert it forwards
   events, filters by runId, completes on RUN_FINISHED, tears down (the `off()` is called).
6. **`useAgent`** — `renderHook` with an `AgentProvider` supplying a **fake `AbstractAgent`** that
   emits a scripted run (user msg → assistant text → tool call → finished). Assert `send`
   updates status idle→running→idle and that streamed text accumulates. No IPC.
7. **`useFrontendTools`** — with the fake agent emitting a `propose_edit` tool call and a real
   editor, assert a proposal is created in the editor's plugin state and the tool result is
   submitted back (spy on the submit path).
8. **Dock view** — render with props, assert composer + transcript render; firing send calls the
   `onSend` prop.
9. **Dock controller** — fake agent + editor; assert send flows through and streamed text reaches
   the view.

Coverage gate 80%; the handler tests + router/mapper tests carry most of it.

---

## 8. Sequencing (do in this order)

1. **Verify D1** against the Claude adapter (read-only). Lock D1-A or D1-B. _(Gate.)_
2. Tool specs (`tools/specs.ts`) + types.
3. Tool handlers + dispatch + their tests (pure, no agent yet — fully testable now).
4. `toRunInput` + `routeAgentEvent` + tests (pure).
5. `Agent` + test (fake `window.api`).
6. `useAgent` + `AgentProvider` + test (fake agent).
7. `useFrontendTools` wiring (shape per D1) + test.
8. Dock view + controller + tests.
9. Mount the dock next to the editor; share the `Editor` instance (provider — coordinate with
   Plan 01's mount step).
10. If D1-B: hand off / implement the preload + main channel changes (separate, explicitly
    approved backend task).

---

## 9. Definition of done

`npm run lint && npm run test && npm run type-coverage && npm run build` green. Manually drive a
run (`npm run dev`): send a message, confirm assistant text streams and a `propose_edit` shows an
inline proposal in the editor that you can accept/reject. Commit conventional, scope `agent`,
straight to `main`, no Co-authored-by.

---

## 10. Open questions (answer before starting)

- [ ] **D1**: does the Claude adapter suspend on frontend tool calls (→ D1-A) or do we need a
      dedicated tool channel in preload/main (→ D1-B)? _(must verify first)_
- [ ] All five tools now, or descope `get_current_document`/`get_current_selection`? →
- [ ] Minimum dock now, rich activity log / proposal cards later (Plan 03)? →
- [ ] Editor instance sharing: add an `EditorProvider` in Plan 01's mount, or single owning
      parent? →
- [ ] Is touching `src/preload` / `src/main` in-bounds for this plan, or split the backend bits
      into a separate approved task? →

```

```
