# Fix: unique assistant message ids across turns

## Summary

When you send a second message, part of the new assistant reply is appended to the **previous**
assistant bubble and the new reply's own bubble never appears. The cause is an id collision at the
source: text-message ids are minted as `` `block-${event.index}` ``, where `event.index` is the
content-block index **within one turn**. Every assistant turn's first text block therefore reuses the
id `block-0`, so across turns the ids collide.

The `@ag-ui/client` reducer that builds `agent.messages` handles a colliding id badly (by design — it
assumes ids are unique): a `TEXT_MESSAGE_START` whose id already exists is **silently dropped** (no new
message), and the following `TEXT_MESSAGE_CONTENT` deltas are **appended to the existing (previous-turn)
message**. Result: text bleeds backward and the new reply disappears.

Fix it where it is created — make every block's message id globally unique per turn — so `agent.messages`
reconstructs correctly. This is a small backend-only change and a prerequisite for clean rendering in the
turn-reconstruction work (`rail-turn-reconstruction.md`).

## Root cause (already investigated)

- `src/main/adapters/agent/claude/logic/transform-stream-event.ts`: `const messageId = `block-${event.index}``for text blocks.`event.index` resets to 0 each assistant turn.
- `@ag-ui/client` `apply()`: `TEXT_MESSAGE_START` → `if(!messages.find(m=>m.id===id)) messages.push(...)`
  (existing id ⇒ no-op); `TEXT_MESSAGE_CONTENT` → finds by id and appends delta. Confirmed in
  `node_modules/@ag-ui/client/dist/index.mjs`.
- Tool-call blocks are already keyed by the SDK's own `block.id` (globally unique), so only the text
  branch — and the `result-${tool_use_id}` / `block-${index}` derivations — need auditing.

## Done

- Two consecutive assistant turns produce **distinct** text-message ids; no id appears in more than one
  turn within a session.
- Sending a second message shows a new, separate assistant reply and leaves the first reply's text
  unchanged (no backward bleed) in `agent.messages`.
- The multi-turn `e2e/rail.e2e.ts` exercises a full second turn end to end and proves the first turn
  survives (both user bubbles + both sentinels on screen). The precise distinct-id guarantee is pinned
  by the unit tests, since the live activity summary masks the corruption for the in-flight turn (see
  the note in step 2).
- `npm run lint`, `npm run test`, `npm run type-coverage`, `npm run build` green; `npm run test:e2e`
  green for `rail.e2e.ts`.

## The discriminator: per-assistant-message, not per-run

`runId` alone is **not** sufficient: one run (one `runId`) can contain multiple assistant messages —
text → `tool_use` → (tool result) → more text — and each new assistant message restarts its
content-block index at `0`. So within a single `runId` you would still get two `block-0`s. The collision
is per-assistant-message, so the discriminator must be too.

Chosen source: the **Anthropic message id** carried by the `message_start` stream event (`message.id`,
e.g. `msg_…`), which is unique per assistant message and needs no counter or module state. Mint text ids
as `` `${currentMessageId}-block-${index}` ``. Tool-call blocks keep the SDK's `block.id` (already
globally unique). Reload ids are unaffected — `session-messages-to-history` keys by `entry.uuid` (the
SDK's stable per-message session uuid), and reloaded vs. live arrays never coexist (thread select
replaces the array), so each only needs to be internally unique.

## Steps

1. **Track the current assistant-message id in the run accumulator and mint unique block ids**
   (test-first).
   - `src/main/adapters/agent/claude/logic/step-run-event.ts`: extend `RunAccumulator` (today
     `threadId` + `blocks`) with `currentMessageId`, set from the inner `message_start` stream event's
     `message.id`. Pure fold (previous state → next state); no module-level mutable state, no `let`.
   - `src/main/adapters/agent/claude/logic/transform-stream-event.ts`: take the current message id and
     mint text `messageId` as `` `${currentMessageId}-block-${index}` ``. Tool ids stay `block.id`.
     Update `OpenBlock` in `src/main/adapters/agent/claude/data/sdk-types.ts` only if the text variant
     must carry the id.
   - Tests: extend `__tests__/transform-stream-event.test.ts` and `__tests__/step-run-event.test.ts` —
     two assistant messages (each `message_start(id)` → `content_block_start(text,index:0)` → deltas →
     stop), assert the two `TEXT_MESSAGE_START` ids differ; also a multi-message single run (two
     `message_start`s) yields distinct ids. Keep existing single-message assertions green.
   - One commit (logic + data + tests; all small, ≤ a few source files).

2. **Exercise the multi-turn path end to end in e2e** (no manifest change).
   - `e2e/rail.e2e.ts` ("sends a message and shows the assistant reply"): wait for the second turn to
     render its own reply (its sentinel) and assert the first turn's bubble and sentinel persist.
   - Note (discovered during step 1): an e2e cannot cleanly isolate _this_ bug in the current
     rendering, because the in-flight turn's reply is drawn from a separate live activity summary that
     masks the corruption until a later turn settles. So the precise distinct-id guard is the step-1
     unit test; this spec is a multi-turn smoke that proves consecutive turns don't destroy prior ones.
     The rendered no-bleed guarantee is validated by `rail-render-messages-directly.md`, which renders
     settled turns straight from `agent.messages`.
   - `e2e/` is weight 0; this rides with step 1's branch.

3. **Remove this plan** — `docs:` commit deleting `docs/plans/fix-message-id-collision.md`
   (performed by `finish-plan`).

## Constraints

- Backend adapter logic only; pure calculations stay pure (`transform-stream-event`, `step-run-event`
  fold via the accumulator — no shared mutation, no `let`, no module-level state).
- The discriminator must be deterministic for a given stream so the calcs stay unit-testable without the
  SDK. No `Date.now()`/random in the pure logic.
- No new dependencies. No escape hatches.
- Tool-call ids stay as the SDK's `block.id`; only audit/adjust the text-id and any `block-`/`result-`
  derivations.

## Open questions

- _SETTLED_ — discriminator is the Anthropic `message_start.message.id` (per assistant message), not
  `runId` (which collides on multi-message tool-using turns) and not a random uuid (banned in pure
  logic, discards identity). Confirm in step 1 that `message_start` is present in the SDK
  `stream_event` payload (`SDKPartialAssistantMessage['event']` = the raw Anthropic stream event, which
  includes `message_start`); a per-message counter in the accumulator is the fallback if not.
- _SETTLED_ — reload ids (`entry.uuid`) are unique and independent of live ids; they need not match.
- _SETTLED_ — fixing the id at the source also fixes the library's `agent.messages`, so this is worth
  doing independently of the rail-rendering plan, which builds on a correct `agent.messages`.
