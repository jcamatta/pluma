# Plan: Composer send-on-Enter + restore-prompt-on-early-stop

## What & why

Two coupled chat-composer behaviours, both in the rail's composer (`src/renderer/src/rail/`):

- **(a) Send on plain Enter.** Today the composer submits on **Ctrl/Cmd+Enter** (the binding lives in
  `RailComposer.view.tsx`'s `onKeyDown`). Writers expect a chat box to send on **Enter**, with
  **Shift+Enter** inserting a newline. Flip the binding: Enter submits, Shift+Enter (and IME
  composition) keep the default newline behaviour.
- **(b) Restore the prompt when the user stops before the AI produced anything.** A writer often hits
  Enter by accident, or sends and immediately wants to revise. If they press **Stop** _before the
  assistant has generated any output for that turn_, put the just-sent text back into the composer so
  they can edit and resend — instead of losing it to the transcript.

Both are renderer-only, single-feature changes (no IPC, no backend, no new deps). They share the
composer's submit/stop wiring, so they are planned together but sliced into independent commits.

## Run-lifecycle facts this plan is built on (verified in the code)

- **Submit** (`ChatRail.controller.tsx` `submit()`): trims `value`, returns early if empty or
  `agent.isRunning`, clears the composer (`setValue('')`), appends the user message via
  `agent.addMessage({ id, role: 'user', content: text })`, then `agent.runAgent(...)`.
- **Stop** is `onStop={() => agent.abortRun()}` (`ChatRail.controller.tsx`). Memory note "rail Stop is a
  no-op" is **stale**: `Agent.abortRun()` (`src/renderer/src/agent/adapters/Agent.ts`) overrides the
  base no-op — it calls `detachActiveRun()`, which completes the base class's `takeUntil` pipe, tears
  down `run()`, fires `agent:abort` over IPC, and settles `isRunning` back to `false`. The e2e
  `rail.e2e.ts` "stops an in-flight run" test already proves Stop works. So `abortRun()` is the real
  abort seam to hook the restore onto.
- **Working / streaming.** `agent.isRunning` drives `working`. Assistant output lands in
  `agent.messages` as assistant messages (text fragments and/or tool-call messages) once the AG-UI
  stream produces them; `useAgent` re-renders on `onMessagesChanged`. `conversation-rows.ts`
  (`assistantRow`) only emits an assistant row for the current turn when the folded assistant
  `text.trim().length > 0` **or** there is ≥1 tool-call step — i.e. that predicate already encodes
  "the AI produced something this turn."
- **Composer value** is React state in the controller (`useState('')`), passed down as `value` and
  echoed by the textarea in `ComposerField.tsx`. Restoring = `setValue(text)`.

## Definition of "before the AI generated anything" (see Open Q1)

Proposed precise rule, computed at the moment Stop is pressed, scoped to the **current (latest) turn**:
the turn has produced **no assistant output** — no assistant text and no tool calls. This reuses the
exact predicate `conversation-rows.ts` already uses to decide whether to render an assistant row, so
"nothing generated" == "no assistant row for the latest turn yet." Extract that predicate into a small
pure `*-logic.ts` so both the row projection and the stop-decision share one definition and it is
unit-testable. If output already exists, Stop behaves exactly as today (abort, leave the transcript).

## Done

A writer can:

- Press **Enter** in the composer to send; **Shift+Enter** inserts a newline (no send). The Send button
  still works. Submit is still blocked while a run is in flight and on whitespace-only input.
- Send a message, then press **Stop before any assistant output appears**, and see the message **return
  to the composer** (focused, ready to edit), with that turn's user bubble removed from the transcript.
- Press **Stop after** assistant text/tools have appeared and get today's behaviour (run aborts, message
  stays in the transcript, composer stays empty).

Green: `npm run lint`, `npm run test` (incl. e2e coverage audit), `npm run type-coverage`,
`npm run build`; for the UI change also `npm run test:e2e`.

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[frontend]` **Send on Enter, newline on Shift+Enter.**
   - `src/renderer/src/rail/RailComposer.view.tsx`: change the `ComposerField` `onKeyDown` so that
     `event.key === 'Enter' && !event.shiftKey && !working` calls `event.preventDefault()` + `onSubmit()`;
     Shift+Enter (and any modifier-less newline during IME composition) falls through to the textarea's
     default. Guard against IME: ignore the key when `event.nativeEvent.isComposing` is true (or
     `event.keyCode === 229`) so composing CJK input doesn't submit mid-word. Drop the old
     Ctrl/Cmd+Enter branch.
   - Tests: `RailComposer.view.test.tsx` (add if absent) — Enter submits and preventDefaults;
     Shift+Enter does **not** submit; Enter while `working` does not submit; Enter while composing does
     not submit. Update `ComposerField.test.tsx`'s comment/test that references "⌘/Ctrl+Enter" to the
     plain-Enter contract (it asserts key forwarding, which still holds; just fix the now-stale wording).
   - No copy change; no locale change. (Optional: see Open Q2 about a placeholder hint.)

2. `[frontend]` **Shared pure predicate: "did this turn generate anything?"**
   - `src/renderer/src/rail/turn-output-logic.ts`: a pure
     `latestTurnHasOutput(messages: readonly Message[]): boolean` (and/or
     `latestTurnIsEmpty`) that groups by the same user-boundary rule as `conversation-rows.ts` and
     returns whether the **last** turn has assistant text or any tool call. Reuse/most-likely extract the
     existing `groupTurns` + the `assistantRow` emptiness check so there is **one** definition of
     "produced output." Keep `conversation-rows.ts` delegating to it (minimal refactor — only if it
     doesn't bloat the diff; otherwise mirror the predicate and add a test that pins them in lock-step).
   - Tests: `__tests__/turn-output-logic.test.ts` — empty messages → no output; user-only latest turn →
     no output; latest turn with assistant text → output; latest turn with a tool call but no text →
     output; a _prior_ turn having output but the latest being user-only → no output (so a second
     accidental send is restorable even after a completed first turn).

3. `[frontend]` **Restore-on-early-stop wiring in the controller.**
   - `src/renderer/src/rail/ChatRail.controller.tsx`: replace `onStop={() => agent.abortRun()}` with a
     `handleStop()` that, **before** aborting, checks `latestTurnIsEmpty(agent.messages)`; if empty, it
     pulls the latest user message's text, removes that user message from the transcript, restores it
     into the composer (`setValue(text)`), and focuses the composer; then always calls
     `agent.abortRun()`. If not empty, it just aborts (today's behaviour).
   - Removing the user message: use the agent's existing message API. **Open Q3** — confirm the
     supported way to drop the last user message (e.g. `agent.setMessages(messages.slice(0, idx))`),
     since `AbstractAgent` exposes `setMessages` (used by `seedThread`/`newThread`) but not a public
     "pop last." Do **not** invent a new agent method without confirming; if no clean API exists, prefer
     `setMessages` with the latest user message (and anything after it) filtered out.
   - Composer focus: reuse the existing `ComposerFocusContext` handle (the `focus()` the Ctrl/Cmd+K
     bridge already uses) rather than reaching into the DOM — see the no-DOM-reaching rule. The
     controller can obtain it via the same context the bridge does, or accept a focus callback prop;
     pick the seam that keeps the controller's deps minimal (decide during impl, document choice).
   - Tests: `ChatRail.controller.test.tsx` (or `ConversationRail.controller.test.tsx`) with a fake
     agent — (i) Stop with an empty latest turn restores the text to `value`, removes the user message,
     and calls `abortRun`; (ii) Stop with assistant output present leaves `value` empty, keeps the
     message, and calls `abortRun`; (iii) the restored text is the trimmed sent text.

4. `[e2e]` **Real-app spec for both behaviours** (reuses the existing `feature:rail` manifest id — no new
   id, so no manifest edit; the audit already covers it).
   - Extend `e2e/rail.e2e.ts` (or add `e2e/composer-send-stop.e2e.ts` claiming
     `@e2e feature:rail`) with:
     - **Enter sends:** type a constrained prompt, press **Enter** (no Send click), assert the user
       bubble appears and the run starts (Send → Stop swap). Press **Shift+Enter** in a fresh composer
       and assert the value gains a newline and **no** message is sent.
     - **Early Stop restores:** type a long prompt, press Enter, and as soon as the run is in flight but
       **before** an assistant reply renders, click Stop; assert the prompt text is back in the composer
       textarea and that turn's user bubble is gone. Mind the live-stream settle race — this test
       deliberately races the _pre-output_ window, so pin the assertion on the composer textarea value
       returning, with a generous timeout, and accept that a model that answers instantly may make the
       "before output" window unobservable (note this flake risk; keep the assertion tolerant or gate on
       a long/slow prompt as `LONG_PROMPT` already does for the Stop test).
   - If a single spec file would mix Enter-send and early-stop into an unwieldy test, split into two
     `test(...)` blocks in the same file. No new manifest id.

5. `[docs]` Remove this plan file in its own `docs:` commit once steps 1–4 ship (performed by
   `finish-plan`).

## Constraints

- **Renderer-only, single feature.** No `src/shared`, no `src/main`, no IPC channel, no new manifest id.
  No new dependency.
- **Hexagonal / no DOM reaching.** Composer focus goes through the registered `ComposerFocusContext`
  handle, never `document.querySelector` (lint-banned `rendererNoDomTreeReaching`). `*.view.tsx` stays
  pure props; the stop decision and message mutation live in the **controller**; the turn predicate is a
  pure `*-logic.ts` calculation.
- **No escape hatches.** No `as` (except `as const`), `@ts-ignore`, `eslint-disable`, non-null `!` —
  narrow `unknown` (e.g. a message's `content`) with a type-guard as `conversation-rows.ts` already does.
- **Don't invent behaviour.** The "before AI generated anything" rule (Open Q1) and the message-removal
  API (Open Q3) must be confirmed before coding step 3; if unconfirmed, stop and ask rather than guess.
- **i18n / both locales.** No new user-facing string is required by the core feature. If Open Q2
  (placeholder hint) is taken up, the key lands in **both** `en.json` and `es.json` (parity test).
- **Minimal diff.** Keep the predicate extraction in step 2 small; don't reshape `conversation-rows.ts`
  beyond sharing the one definition.

## Open questions

- **Q1 — exact "nothing generated" boundary.** Proposed: the latest turn has **no assistant text and no
  tool call** at Stop time (reusing the `conversation-rows.ts` assistant-row predicate). Alternative
  boundaries to confirm with the user: (a) treat a _tool call with no visible text_ as "generated
  something" (proposed: yes, it did) vs. "still restorable"; (b) whether a RUN_STARTED with zero output
  bytes counts as generation (proposed: no). **Open — pick before step 3.**
- **Q2 — discoverability of the new send shortcut.** Should the placeholder or a small hint mention
  "Enter to send · Shift+Enter for newline"? Default: **no copy change** (keep minimal diff). If yes,
  it's a both-locales key. **Open.**
- **Q3 — supported API to drop the restored user message.** `AbstractAgent` exposes `setMessages`
  (used by `seedThread`/`newThread`); there is no public "remove last message." Confirm using
  `setMessages(messages.slice(0, lastUserIdx))` (dropping the latest user message and anything after) is
  acceptable, or whether the user prefers leaving the transcript untouched and only re-populating the
  composer. **Open — pick before step 3.**
- **Q4 — restore when output exists but is trivial.** If the assistant streamed only whitespace before
  Stop, the predicate treats it as "no output" (trim). Confirm that's desired (proposed: yes —
  whitespace-only is effectively nothing). **Open (low-stakes).**
  </content>
  </invoke>
