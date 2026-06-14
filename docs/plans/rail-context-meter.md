# Rail context meter — show context-in-use for the thread

Show how full the model's context window is for the **current agent thread**, as a small ring indicator pinned in the composer (mirroring Claude Code's "Context 60.3k / 1.0M (6%)" meter). Hovering the ring shows the exact figure; clicking it opens a breakdown (input vs cache-read vs cache-creation).

This is **context occupancy**, not cost. The number is the input footprint of the **most recent** model request in the thread — `input_tokens + cache_read_input_tokens + cache_creation_input_tokens` of the last assistant turn — over the model's context window. It is a point-in-time snapshot, never a cumulative sum across turns (each turn re-sends the whole conversation, so the latest request's input size _is_ the current context size).

The raw numbers come from the Claude Agent SDK in the main process. They live on the renderer in **`agent.state`** — AG-UI's shared-state container — under a `contextUsage` key, fed by two paths into the **same** place:

- **Live (during a run):** the backend emits a `STATE_SNAPSHOT` event; AbstractAgent compacts it into `agent.state` automatically.
- **On resume (loading a past thread):** we read the last assistant turn's usage from the stored session and call `agent.setState({ contextUsage })`.

One hook reads `agent.state.contextUsage`; the composer renders the ring. This matches the intuition that "context lives in the agent's shared state".

## Done

A user who has run at least one turn — **or** who re-opens any past thread — sees a ring in the composer filled to the fraction of the window in use. Hover shows `Context <used> / <window> (<pct>%)`; click shows the breakdown. The value updates live as a turn progresses. All four checks (`lint`, `test`, `type-coverage`, `build`) pass, and `test:e2e` passes with a real-app spec that (a) runs a turn and sees the meter, and (b) re-selects a past thread and sees the meter without running.

## Model context windows (researched — corrects earlier assumption)

Per the current models reference, both models Pluma uses have a **native 1M-token** window — there is **no `[1m]` beta variant to opt into**:

| Model id                           | Context window |
| ---------------------------------- | -------------- |
| `claude-opus-4-8` (default)        | **1,000,000**  |
| `claude-sonnet-4-6`                | **1,000,000**  |
| `claude-haiku-4-5` (fallback only) | 200,000        |

So `contextWindowForModel`: `claude-opus-4-8` → `1_000_000`, `claude-sonnet-4-6` → `1_000_000`, default → `200_000`. (Caveat for the record: on Microsoft Foundry Opus 4.8 is capped at 200k — not a surface Pluma targets. Also: the Opus-4.7+ tokenizer produces ~30% more tokens for the same text, which only affects how fast the meter fills, not our math.) A more robust alternative to a hardcoded map is the **Models API** (`max_input_tokens` per model), but that adds a network call; the static map is enough for v1.

## End-to-end scenario / flow

**Scenario — live.** Marta has a folder open and the rail open. She types _"summarize my draft"_ and Sends. The agent reads files and replies. As the model answers, a ring appears at ~1%. Hover: _"Context 12.4k / 1.0M (1%)"_. Click: _Input 1.2k · Cache 11.1k · Cache write 0_. She sends a longer turn; the ring grows.

**Scenario — resume.** The next day Marta re-opens that thread from history. **Before sending anything**, the ring already shows ~1% — read from the thread's last stored assistant turn. Starting a new chat clears the ring.

**Flow — live turn:**

```
Send → ChatRailController.submit → agent.runAgent({ forwardedProps: { state: runControls.runState } })
  │  (model/effort travel via forwardedProps.state — NOT agent.state, so contextUsage never clobbers them)
  ▼
[main] claude-runtime-agent: window = contextWindowForModel(resolvedModel); query({...}) streams
  ▼
[main] runEventStream fold (stepRunEvent) now also handles `assistant`:
        used = usage.input_tokens + cache_read_input_tokens + cache_creation_input_tokens
        emit STATE_SNAPSHOT { snapshot: { contextUsage: { usedTokens: used, windowTokens, breakdown } } }
  │  (pushed on agent:event — the whole BaseEvent, no allow-list)
  ▼
[renderer] Agent.run → routeAgentEvent forwards STATE_SNAPSHOT → AbstractAgent compacts it into agent.state
  ▼
[renderer] useAgentContextUsage: onStateChanged → readAgentContextUsage(agent.state) → ring
```

**Flow — resume (no run):**

```
Select thread → useThreadSession → useThreadContext(cwd, id)  (a query, separate from useThreadHistory)
  ▼
[main] get-thread-context use case → ThreadReader.getThreadContext → getSessionMessages(id, { dir })
        lastContextUsageFromSession(entries): find last `assistant` entry → read its usage + model
        → toContextUsage(usage, contextWindowForModel(model))  → Result<AgentContextUsage | null>
  ▼
[renderer] useThreadSession seeds it: agent.setState({ contextUsage })  (newThread → agent.setState({}))
  ▼
[renderer] same useAgentContextUsage hook (onStateChanged) → ring, before any run
```

Verified facts this relies on:

- `agent:event` is typed as the full `@ag-ui/core` `BaseEvent` and forwarded verbatim — a new `STATE_SNAPSHOT` needs no IPC change.
- `AbstractAgent` exposes `state`, `setState`, and `onStateChanged`, and "all STATE_SNAPSHOT/STATE_DELTA events within a run are compacted into a single STATE_SNAPSHOT" → `agent.state` is the single source.
- The run's model/effort come from `forwardedProps.state` (`toRunInput`), independent of `agent.state`, so storing `contextUsage` in `agent.state` is safe. We key it `contextUsage` (not `context`) to avoid any clash with AG-UI's separate `RunAgentInput.context` channel.
- `step-run-event.ts` currently ignores `message.type === 'assistant'` (the full message carrying final `usage`) — that is the live capture point.
- `getSessionMessages` already returns the stored `SessionMessage[]`; `sessionMessagesToHistory` reads their content but drops `usage`/`model`, which are still present for us to read on the resume path.

## Steps

Each step is one small, independently green, additive commit. Phase A delivers the live meter; Phase B adds the resume path. They can ship as **two PRs** (A first) per our split-PR practice, or one — the slicing is the same.

### Phase A — live meter during a run

**A1. Shared — usage data type + state guard.**

- Add `src/shared/agent/context-usage.ts`: the wire `AgentContextUsage` Data type (`usedTokens`, `windowTokens`, `breakdown: { inputTokens, cacheReadTokens, cacheCreationTokens }`) and the single exported guard `readAgentContextUsage(state: unknown): AgentContextUsage | undefined` that reads `state.contextUsage` (the shape carried by both `STATE_SNAPSHOT.snapshot` and `agent.state`). No cast — a real `value is T` narrowing.
- Add `src/shared/agent/__tests__/context-usage.test.ts`.

**A2. Backend — pure calcs: model→window and SDK-usage→context.**

- Add `src/main/adapters/agent/claude/logic/context-window.ts` — `contextWindowForModel(model: string): number` (the 1M map above, default 200k).
- Add `src/main/adapters/agent/claude/logic/to-context-usage.ts` — `toContextUsage(usage, windowTokens): AgentContextUsage`.
- Add tests under `logic/__tests__/`.

**A3. Backend — emit `STATE_SNAPSHOT` from the run fold.**

- Edit `step-run-event.ts` — add an `assistant` branch building the snapshot via `toContextUsage` and returning a `STATE_SNAPSHOT`; thread `contextWindow` through the curried deps; dedupe by assistant message id in the accumulator so parallel tool calls don't re-emit.
- Edit `run-event-stream.ts` — add `contextWindow` to `RunDeps`, pass to `stepRunEvent`.
- Edit `claude-runtime-agent.ts` — resolve `contextWindowForModel(resolvedModel)` and pass it in.
- Update `step-run-event` tests (assistant → snapshot with expected `usedTokens`; duplicate id is a no-op).

**A4. Renderer — usage hook + display calcs.**

- Add `src/renderer/src/rail/context-meter-logic.ts` — `contextRatio`, `contextPercent`, `formatTokenCount` (`"12.4k"`, `"1.0M"`). Pure.
- Add `src/renderer/src/rail/useAgentContextUsage.ts` — subscribes `onStateChanged`, reads `agent.state` through `readAgentContextUsage`, returns `AgentContextUsage | undefined` (read-only query hook).
- Add tests: logic direct; hook via `renderHook` against a fake agent (mirror the `useAgentActivityLog` harness).

**A5. Renderer — `ContextMeter` plain component.**

- Add `src/renderer/src/rail/ContextMeter.tsx` — SVG ring (fill = ratio, Motion-animated), Base UI `Tooltip` (hover) + `Popover` (click breakdown). Local `useState` for popover open only; `usage` + translated `labels` via props; design tokens only; no decorative icon.
- Add `src/renderer/src/rail/__tests__/ContextMeter.test.tsx`.

**A6. Renderer — wire into the composer + i18n.**

- Edit `RailComposer.view.tsx` — optional `contextSlot?: ReactNode` in the toolbar row.
- Edit `ConversationRail.view.tsx` — thread a `contextMeter?: ReactNode` slot through `ChatPane` to `RailComposer`.
- Edit `ChatRail.controller.tsx` — call `useAgentContextUsage(agent)`, build labels with `t`, pass `<ContextMeter/>` (or `null`) as the slot.
- Edit `src/renderer/src/i18n/en.json` — `rail.context.*` keys (weight 0).
- Add/extend a `RailComposer.view` test for the slot.
- → Live meter works during/after a run.

### Phase B — show context when resuming a thread

**B1. Backend — calc: last usage from a stored session.**

- Add `src/main/adapters/agent/claude/logic/last-context-usage.ts` — `lastContextUsageFromSession(entries): AgentContextUsage | null`: find the last `assistant` `SessionMessage`, read its `usage` and `model` through small guards (no cast), map via `toContextUsage(usage, contextWindowForModel(model))`. Returns null if none.
- Add tests.

**B2. Backend — query use case + port method (additive).**

- Add `ThreadReader.getThreadContext(cwd, id): Effect<AgentContextUsage | null, ThreadReadFailed>` to `thread-reader.port.ts`; implement in `claude-thread-reader.ts` (reuses `getSessionMessages` + `lastContextUsageFromSession`).
- Add `src/main/application/agent/usecase/get-thread-context.ts` + tests (in-memory reader).
- Existing `getThreadHistory` is untouched (stays green).

**B3. Backend — IPC channel + handler (additive).**

- Add `AGENT_THREAD_CONTEXT_CHANNEL` to the agent IPC contract, a handler invoking the use case and returning a `Result<AgentContextUsage | null, …>`, and register it.
- Add handler test.

**B4. Renderer — port + adapter + query hook (additive).**

- Add the reader-port method + `window.api` adapter mapping + in-memory fake entry, and `src/renderer/src/threads/useThreadContext.ts` (a `useQuery` returning the `Result`), with a shared query-key helper.
- Add hook + adapter tests.

**B5. Renderer — seed `agent.state` on select, clear on new.**

- Extend the resume seam: `useThreadSession` calls `useThreadContext` and, on select, `agent.setState({ contextUsage })` (via a small `ThreadControls` method or an extended `seedThread`); `startNew`/`newThread` calls `agent.setState({})`.
- Add/extend `useThreadSession` test (select → state seeded; new → cleared).
- → Re-opening a thread shows its context with no run.

### Wrap

**W1. e2e — manifest ids + real-app spec.**

- Add `rail-context-meter` to `FEATURES` and `agent.thread-context` to `OPERATIONS` in `e2e/coverage-manifest.ts`.
- Add `e2e/rail-context-meter.e2e.ts` (`@e2e feature:rail-context-meter`, `@e2e operation:agent.thread-context`): open a folder (stubbed picker), run one short turn, assert the meter shows a non-empty value via its accessible label; then re-select the thread from history and assert the meter shows without running. Wait for the run to settle (composer Stop→Send) before the history step. Cleanup via `withTempFolder` + `app.close()` in `finally`.

**W2. docs — remove this plan** (its own `docs:` commit, via `finish-plan`).

## Constraints

- Hexagonal + Effect: capture and the resume read stay in the Claude adapter; folds and mappers are pure calcs; the runtime agent and use cases (actions) do the wiring. No new layer.
- No new dependencies: ring is hand-rolled SVG + Motion; Tooltip/Popover are Base UI (all present).
- No casts / escape hatches: opaque `agent.state`, `STATE_SNAPSHOT.snapshot`, and stored `SessionMessage` fields are read through `value is T` guards.
- CQS: `useAgentContextUsage`, `useThreadContext`, and `get-thread-context` are all read-only queries, separate from any command.
- UI rules: design tokens only, Base UI primitives, Motion, every string via `t`; the view stays hook-free, the controller supplies labels and the slot.
- e2e ships its manifest ids and spec in the same change (W1).

## Open questions

- **e2e cost (noted, separate change).** Driving real turns makes the suite progressively expensive. Out of scope here, but worth a follow-up: run the e2e agent on a cheaper model (e.g. `claude-sonnet-4-6`, low effort) and keep this spec to a single short turn. Flag if you want that addressed before adding this spec.
- **Ship A then B, or together?** Proposed: two PRs (A = live meter, B = resume), per our split-PR practice — A is independently useful. Confirm.

## Settled

- **Model windows** — `claude-opus-4-8` and `claude-sonnet-4-6` are **1M** native (no beta variant); fallback 200k. (Researched above.)
- **Cadence** — emit a `STATE_SNAPSHOT` per `assistant` message (live growth within a turn). Cheap to change to once-per-`result` later.
- **Transport** — context lives in `agent.state.contextUsage`, fed by `STATE_SNAPSHOT` (live) and `setState` (resume); safe from the model/effort run state, which travels via `forwardedProps`.
