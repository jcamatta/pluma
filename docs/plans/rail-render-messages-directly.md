# Render the conversation directly from agent.messages (steps for every message)

## Summary

Today the rail shows the agent's **steps** (the tool-call timeline) only for the single in-flight turn,
because steps live in a _second_ model — the transient `AgentActivity` built by `useAgentActivityLog`,
which is reset on every new user message. Meanwhile the settled conversation renders as plain text
bubbles (`splitConversation` → `Transcript.view`, whose `toItem` keeps only `message.content`), and a
reloaded thread loses steps entirely (`session-messages-to-history` extracts text only).

The fix is to collapse to **one model and render it directly: `agent.messages`** (the AG-UI `Message[]`),
with each turn's steps **derived statelessly** from the messages — no parallel `AgentActivity` to keep in
sync. We delete `useAgentActivityLog`, `activity-log.ts`, and the text-only transcript path, and render
the message array through **one pure projection** that groups messages into turns and folds each tool
result into the step it answers.

This depends on `fix-message-id-collision.md` having landed (so `agent.messages` is clean). That fix has
shipped. Recommended order is preserved: id fix first, then this.

## How AG-UI actually shapes a turn (verified — read this before coding)

A critical correction over the first draft of this plan: **one Claude turn is not one assistant message.**
The renderer's `AbstractAgent.apply()` was inspected in the installed `@ag-ui/client` and run against a
real text→tool→text turn. Because our transform emits `TOOL_CALL_START` with **no `parentMessageId`**
(`src/main/adapters/agent/claude/logic/transform-stream-event.ts`), `apply()` fragments a single turn
into several `Message`s:

```
assistant  <sdkId>-block-0   content:"Let me check. "          ← one assistant msg per TEXT block
assistant  <toolCallId>      toolCalls:[read_file]  (no text)  ← one assistant msg per TOOL call
tool       result-<id>       content:"file contents"           ← the tool result, by toolCallId
assistant  <sdkId>-block-2   content:"Done."
```

- Text blocks each become their **own** assistant message, id `${sdkId}-block-${index}`.
- Each tool call becomes its **own** assistant message whose **id is the toolCallId**, holding
  `toolCalls: [{ id, function: { name, arguments } }]` and no text.
- The tool result is a `tool`-role message linked by `toolCallId` (its `error` field is an optional
  **string**).

The **reload** path produces a _different_ shape: `getSessionMessages` returns the turn as a single
consolidated assistant entry (text + `tool_use` blocks together) and the result inside a separate `user`
message. So the live array and the reloaded array are **not** interchangeable, and we must not try to make
them byte-for-byte identical (the original plan's goal — abandoned).

The resolution: **the projection is the single normalizer.** It collapses _both_ the live-fragmented
shape and the reload-consolidated shape to the same `Row[]`. Neither producer has to match the other.

Run failure adds **no message**: `apply()` does nothing to `agent.messages` on `RUN_ERROR`. The failure
surfaces only through the run Observable → `onRunFailed` (as `useAgentActivityLog` already consumes it),
and only **live** — a reloaded thread carries no stored error trace.

## Why one model (design rationale)

- **AG-UI is the model.** The conversation is "a flat ordered array of messages with no explicit turn
  grouping"; roles, `toolCalls`, `toolCallId`, `error` already encode everything. A separate `Turn` or
  `AgentActivity` is a _second_ representation of the same run that must be coordinated — the bug-#2 trap.
- **Events are the source of truth; `agent.messages` is the canonical derived view** that `apply()`
  maintains (AG-UI serialization / compaction). We render that view rather than rebuilding our own from
  raw events.
- **Steps are derived, statelessly.** A tool step's status comes from the data: the matching `tool`
  message present ⇒ done, absent ⇒ still calling. (See the decision on "failed" below — the live pipeline
  currently cannot produce a failed tool result, so we do not render a status the data can't reach.)
- **The one surviving transform is a pure projection**, not a model: group the flat array into turns and
  fold each turn's text + tool calls + results into one display row. Recomputed each render; cannot
  diverge.
- The only non-message state is `agent.isRunning` (built-in, drives "working") and a tiny live
  "current run errored" boolean from `onRunFailed` — one flag, not a model.

## Decisions (resolved)

- **Stream assistant text live during the run.** Rendering from `agent.messages` means deltas append to
  `content` as they arrive; we show them. Remove the current `reply = working ? '' : summary` guard. The
  projection must still drop empty / textless assistant messages so a live tool-only message never flashes
  as a blank bubble.
- **One grouped bubble per turn.** A turn (a user message and the assistant messages that follow it up to
  the next user message) renders as one assistant bubble, matching today's single-`ConversationTurn` UX —
  not one bubble per fragment.
- **Text concatenated; steps in a collapsible timeline (separated, not interleaved).** Within a turn, the
  text segments are concatenated into one reply and the tool calls render as a collapsible step timeline
  (the current mental model). This reads cleanly as prose and is the simpler projection/view. The tradeoff
  — losing the exact position of text relative to a step — is acceptable for this product. (Interleaving
  text and steps in array order is the alternative if fidelity is later wanted; not now.)
- **Tool-step status is `calling` / `done` only — no `failed` for now (verified library limitation).**
  The renderer's `apply()` constructs a tool message as `{ id, toolCallId, role, content }` and **ignores
  any `error`**, and the `TOOL_CALL_RESULT` event schema has no `error` field — so a failed tool **cannot**
  be marked failed on the live `agent.messages` through AG-UI. We _could_ set `error` on the reload path
  (we build that message ourselves), but then the same failed run would render normal while live and turn
  red only after reopening — a worse inconsistency. So v1 derives status from result presence only; the
  tool's output `content` already carries the error text in both paths. "Failed" styling is a later change
  done on **both** paths together (see "Deferred").
- **Run error is live-only.** A failed _run_ shows an inline affordance on the in-flight turn, driven by
  `onRunFailed` (a single boolean of local state). A **reloaded** failed run shows no error affordance —
  `getSessionMessages` carries no error trace and `apply()` adds none. This is documented behavior, not a
  gap to fix here.

## Done

- Every turn in the rail — current and all prior — shows its own step timeline, live and on reload.
  Reopening a past thread reconstructs each turn with its steps.
- `useAgentActivityLog`, `activity-log.ts` (the reducer), and the text-only `transcript-logic` /
  `Transcript.view` path are removed; the conversation renders from `agent.messages` via one pure
  projection. The step timeline view (`LogRow`/`ActivityView`) is reused for both live and settled steps.
- `npm run lint`, `npm run test`, `npm run type-coverage`, `npm run build` green; `npm run test:e2e`
  green for `rail.e2e.ts` and `agent-thread-history.e2e.ts`.

## Shipping — three small PRs

This plan ships incrementally so each PR is small, green, and independently reviewable. Each PR is its own
branch off the latest `main`; this plan file is the shared design record and is removed by the last PR.

- **PR 1 — Backend persistence (foundation).** Step 1. Reload history carries tool calls + results.
  Backend-only, fully unit-tested, **no visible UI change** and no e2e manifest change. Branch
  `fix/rail-history-tool-calls`.
- **PR 2 — The projection + the assistant-row view, unused.** Steps 2–3. Pure reassembler and the view,
  with tests; merges with **zero behavior change** because nothing renders them yet. Branch
  `fix/rail-conversation-rows`.
- **PR 3 — Flip the switch + delete the old model.** Steps 4–6. Wire the controller to render from
  `agent.messages`, remove `AgentActivity`/transcript code, add e2e. The visible win lands here, on top of
  already-reviewed pieces. Branch `fix/rail-render-messages`.

## Steps

### Backend — make reloaded history carry tool calls/results (PR 1)

1. **Preserve tool calls/results in `session-messages-to-history`** (test-first).
   - `src/main/adapters/agent/claude/logic/session-messages-to-history.ts`: alongside text, read
     `tool_use` blocks into the assistant `Message`'s `toolCalls[]`
     (`{ id, type: 'function', function: { name, arguments } }`) and emit each `tool_result` block as a
     `{ role: 'tool', id, toolCallId, content }` message. The shape need **not** match the live array
     byte-for-byte — the step-2 projection normalizes both. All reads stay through type-guards over
     `unknown` (no casts). An assistant turn that only called a tool (no text) is now kept.
   - Tests: extend `__tests__/session-messages-to-history.test.ts` — a stored session with `tool_use` +
     matching `tool_result` reconstructs an assistant message carrying the tool call followed by a
     `tool` message; existing text-only cases stay green.
   - `claude-thread-reader.ts` only maps — no change beyond types. 1–2 commits (split text vs tool
     extraction if the size budget is tight).

### Renderer — pure projection (the normalizer)

2. **`messages → turn rows` pure calculation** (test-first).
   - New pure module under `src/renderer/src/rail/` (e.g. `conversation-rows.ts`):
     `Message[] → readonly Row[]`. Algorithm:
     - **Group into turns.** Walk the flat array in order; a `user` message opens a turn, and every
       following `assistant`/`tool` message belongs to it until the next `user` message.
     - **Per turn build one row**: a user row (the prompt) and an assistant row carrying
       `{ text, steps }`. `text` is the concatenation of that turn's assistant-message `content` segments
       (in order, skipping empty). `steps` is built from every `toolCall` found across the turn's
       assistant messages.
     - **Match results by `toolCallId`.** For each tool call, find the turn's `tool` message whose
       `toolCallId` equals the call id: present ⇒ `done`, absent ⇒ `calling`. Do **not** "fold into the
       preceding message" — match by id, because live the call and its text live in separate messages.
     - This collapses the live-fragmented shape and the reload-consolidated shape to identical rows.
     - Reuse the `LogStatus`/step vocabulary from the existing timeline (move the type here — see step 3).
       Pure — no React, no IO; replaces `transcript-logic.ts`'s `toItem`.
   - Tests: two turns each render their own steps (not just the last); a tool result settles the matching
     step; a missing result reads `calling`; a tool-only assistant turn still yields a row with steps and
     no blank bubble; text from one turn never bleeds into another; the live-fragmented array and the
     reload-consolidated array for the same turn produce the same `Row`.
   - One commit (logic + test). Scope is larger than a one-liner — grouping + matching + the moved type.

### Renderer — view

3. **Assistant row view with inline steps** (test-first).
   - Render an assistant row as the concatenated reply text + a collapsible step timeline, reusing
     `Activity.view`'s `ActivityView`/`LogRow` so live and settled steps look identical; settled rows
     collapsed by default. Pure props; design tokens only; Base UI `Button` for the toggle; Motion for
     expand/collapse.
   - **Type move:** `LogEntry` / `LogStatus` currently live in `activity-log.ts` (deleted in step 4) but
     are imported by `Activity.view.tsx` and `LogRow.view.tsx`. Move them into the new `conversation-rows`
     module (or a small shared `step.ts`) and re-point those view imports. Count these edits against the
     file budget.
   - View test: a row with two steps renders both rows and the reply; toggling expands/collapses.
   - One commit (view + test).

### Renderer — wire it in and delete the parallel models

4. **Render `agent.messages` directly in the controller; remove `AgentActivity`** (test-first).
   - `src/renderer/src/rail/ChatRail.controller.tsx`: render the conversation by passing `agent.messages`
     through the step-2 projection and the step-3 view — for every turn. Drive "working" from
     `agent.isRunning`; track a minimal current-run-error boolean from `onRunFailed` and show an inline
     affordance on the in-flight turn (no message is added on error). The in-flight turn renders from
     `agent.messages` like any other; its text streams as deltas append (guard removed). Preserve the
     thread-title derivation (first `user` message's text).
   - Remove `useAgentActivityLog`, `activity-log.ts`, `transcript-logic.ts`, and the text-only
     `Transcript.view` / `ConversationTurn.view` / `AssistantTurn.view` path now superseded; keep the
     timeline view. Update/remove their tests.
   - Controller test: a conversation with two completed turns renders both with steps; an in-flight turn
     shows live status; a failed run shows the error affordance.
   - **≥2 commits** — the deletions (the hooks/logic plus their views and **6+ test files**) exceed the
     15-file commit cap. Sequence: (4a) introduce the new render path with the old still present and green;
     (4b) delete the old models/views/tests. Split (4b) further by file cluster if still over 15 files.

### e2e

5. **Real-app coverage for steps everywhere** (no new manifest ids).
   - `e2e/rail.e2e.ts`: after a tool-using turn settles, send a second message and assert the **prior**
     assistant turn still shows its step timeline (steps persist, not only on the last).
   - `e2e/agent-thread-history.e2e.ts`: reopen a thread that used a tool and assert the reconstructed turn
     shows its steps. Drive a real run that calls a frontend tool (e.g. an editor tool) so a real
     `tool_use`/`tool_result` exists. Verify steps render on reload (step 1 + step 2) **before** writing
     the assertion, or it will be red for a real design reason rather than a flake.
   - Claims existing `feature:rail` / `feature:thread-history` / `operation:agent.thread-history`; no
     manifest change. `e2e/` is weight 0.

6. **Remove this plan** — `docs:` commit deleting `docs/plans/rail-render-messages-directly.md`
   (performed by `finish-plan`).

## Constraints

- Single source of truth is `agent.messages` (AG-UI `Message[]`). Do **not** introduce a parallel turn or
  activity model; the only message→view transform is the pure, stateless projection in step 2.
- The projection groups by turn and matches tool results **by `toolCallId`**, never by adjacency — the
  live array splits a turn's text and tool calls across separate messages.
- Hexagonal: projection is a pure renderer calculation over `Message` data; no IPC in views;
  `*.view.tsx` calls no hooks and never touches `window.api`; controllers wire hooks to views.
- Read path only (CQS unaffected). `Message`/`Result` stay the IPC boundary contract.
- Design tokens only, Base UI primitives, Motion for expand/collapse, `t()` for all copy (reuse existing
  `rail.*` keys; add keys only for genuinely new strings).
- No new dependencies. No escape hatches. Keep each commit within the size budget — step 4 must split.

## Deferred (explicitly out of scope)

- **Failed-tool rendering.** Marking a step `failed` requires a live mechanism AG-UI's `TOOL_CALL_RESULT`
  does not provide (its `apply()` drops `error`), so it must be done on **both** the live and reload paths
  together to avoid a run looking different before vs. after reopening — likely a small custom signal
  threaded alongside `agent.messages`, or an AG-UI upgrade that carries the flag. The projection's status
  derivation should be written to make adding `failed` trivial later, but it is not added now.
- **Persisted run-error on reload.** Surfacing a past failed run after reopening a thread would need the
  error stored in / read from the session; out of scope.
- **Interleaved text/steps** (rendering each text segment beside the step it narrates) — alternative to
  the chosen concatenated layout; revisit only if the grouped reply proves insufficient.
