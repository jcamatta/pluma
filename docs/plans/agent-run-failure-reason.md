# Agent run-failure reason in the rail

When a run fails the rail says only "Run failed" — the writer cannot tell that their Claude sign-in
expired and that they must re-authenticate. This plan gives the app a **closed, typed vocabulary of the
run failures it actually handles** — today `authentication` and `generic` — declared on the IPC wire
layer, mapped there from the SDK's own error codes, and rendered by the frontend as a title plus a
remedy line.

The vocabulary is deliberately small: we do not re-export every error the SDK can produce, only the ones
the UI does something different about. Everything else collapses to `generic`, which renders today's
"Run failed".

Verified against the SDK (0.3.172) while diagnosing: on an expired token the run yields
`assistant.error === 'authentication_failed'` and then `result.subtype === 'success'` with
`is_error === true` — which is exactly why the current code falls through to a constant string.

## Transport: AG-UI's own `RUN_ERROR`, not a new interface

`RunErrorEventSchema` in `@ag-ui/core` is `{ type, message: string, code?: string }`. The failure code
travels in that optional **`code`** field of the existing `RUN_ERROR` event, on the existing
`agent:event` channel. No new event type, no new channel, no parallel error envelope — our union simply
narrows what that protocol-defined string may be at our boundary. `message` stays a human-readable
diagnostic; the UI never renders it.

`BaseEvent` is a zod `passthrough` type (it carries a `[k: string]: unknown` catchall), which is why
stamping `code` compiles — and why every *read* of it arrives as `unknown` and must be narrowed
structurally, exactly as `route-agent-event.ts` already narrows `message`.

One wrinkle this must respect: AG-UI's `onEvent` subscriber does **not** fire for RUN_ERROR (only the
`onRun*` callbacks do), and `onRunFailed` hands over a plain `Error`. So the renderer carries the code
across that hop in a typed `Error` subclass of its own — a local class, not a wire shape. Reviewed
against `@ag-ui/client`'s run pipe: it ends in `catchError(e => this.onError(input, e, subscribers))`
and passes that same object into `onRunFailed({ error })` without rewrapping, so an `instanceof` check
survives the trip. Step 5 pins that assumption with a test.

## Done

- A run that fails because the Claude sign-in expired shows, in the rail's failed-run header,
  "Sign-in expired" and beneath it a remedy line (and their Spanish equivalents).
- Every other failure shows today's generic "Run failed" — never a blank, never a raw SDK string.
- Sending a second message while still signed out shows the same title and remedy again (the header
  passes through "Thinking…" and fails afresh), not a stale or blank header.
- The failure code is typed end to end: SDK code → domain union → wire union → renderer union, and the
  two unions the layering forces us to declare twice are pinned equal by a test.
- `npm run lint`, `npm run test`, `npm run type-coverage`, `npm run build` green; `npm run test:e2e`
  green, including the new real-app failure spec.

## Steps

### 1. `[shared]` The wire vocabulary

- `src/shared/ipc/ipc-event-contract/agent-run-failure.ts` (new) — `AGENT_RUN_FAILURES = ['authentication', 'generic']`,
  the `AgentRunFailure` union derived from it, and `toAgentRunFailure(code: unknown): AgentRunFailure`.
  The parameter is `unknown`, not `string | undefined`, so the structural narrowing of the passthrough
  `code` field lives in exactly one place instead of at each call site.
- `src/shared/ipc/ipc-event-contract/__tests__/agent-run-failure.test.ts` — a known code narrows;
  unknown strings, `undefined`, and non-string values all fall to `'generic'`.

The module documents that its carrier is `RunErrorEvent.code`, so the coupling is discoverable from the
contract rather than folklore.

### 2. `[backend]` The domain vocabulary and the SDK mapping

- `src/main/application/agent/data/run-failure.ts` (new) — the same closed union as domain data, named
  `RunFailure` (deliberately *not* `AgentRunFailure`: step 3 imports both and they must not collide).
  It is declared twice on purpose — `domainNoSharedImports` forbids the application and adapter layers
  from importing `src/shared` — and step 3 pins the two together.
- `src/main/adapters/agent/claude/logic/to-run-failure.ts` (new, pure) — the anti-corruption mapping
  `SDKAssistantMessageError → RunFailure`, written as an explicit per-case record with a `'generic'`
  fallthrough (so adding `billing_error` or `rate_limit` later is a one-line diff, not a rewrite).
  This is the only place SDK error strings are known.
- `src/main/adapters/agent/claude/logic/step-run-event.ts` — carry the assistant message's `error` in
  `RunAccumulator`, recorded **before** `onAssistant`'s `lastUsageMessageId` early-return: that guard
  returns the accumulator untouched, and parallel tool calls reuse a message id, so capturing after it
  would silently drop the code. `resultEvent` then stamps the mapped code onto `RUN_ERROR.code`;
  `is_error === true` with `subtype === 'success'` is the auth case, so the recorded code must win over
  `subtype`.
- Tests: `__tests__/to-run-failure.test.ts` (new) and additions to `__tests__/step-run-event.test.ts` —
  an assistant `error: 'authentication_failed'` followed by an `is_error` result emits `RUN_ERROR` with
  `code: 'authentication'`, including the case where that assistant message repeats an earlier id; a
  clean run is unchanged.

### 3. `[backend]` Pin the domain and wire vocabularies together

- `src/main/ipc/agent/__tests__/run-failure-alignment.test.ts` (new) — the ipc layer is the only layer
  allowed to import both, so it asserts `[...RUN_FAILURES] toEqual [...AGENT_RUN_FAILURES]`. Adding a
  case to one union without the other turns `npm run test` red.

No production mapper: the two unions are string-identical, so a translation function here would rebuild
every `RUN_ERROR` into an identical object and run as a no-op branch on every streamed text delta, for a
guarantee this test already gives. And if they ever did drift, `toAgentRunFailure` collapses the unknown
string to `'generic'` — it degrades to today's behaviour rather than shipping a broken string.

### 4. `[backend]` Stop discarding a thrown query error

- `src/main/adapters/agent/claude/runtime/run-event-stream.ts` — `Stream.catchAll` currently drops the
  error entirely, which is why this whole class of failure was invisible in the dev console. Pass it to
  `onQueryError` and `Effect.logError` it (the `ipc-log` convention) before emitting the closing event.
  The emitted event vocabulary is unchanged: a thrown query still closes as `generic` (or as an interrupt
  when aborted). Diagnostics only, so no UI effect.

Under 30 source lines and no behaviour change, so it lands without a test file.

### 5. `[frontend]` Carry the code across AG-UI's `onRunFailed`

- `src/renderer/src/agent/agent-run-error.ts` (new) — `AgentRunError extends Error`, holding a typed
  `failure: AgentRunFailure` alongside the message.
- `src/renderer/src/agent/route-agent-event.ts` — the `'error'` outcome carries the failure, parsed from
  the event's `code` with the shared `toAgentRunFailure`.
- `src/renderer/src/agent/adapters/Agent.ts` — `run()` errors the Observable with an `AgentRunError`
  instead of a bare `Error`, so `onRunFailed({ error })` receives it intact.
- Tests: `__tests__/route-agent-event.test.ts` and `adapters/__tests__/Agent.test.ts` extended for the
  code round-trip, including a RUN_ERROR with no `code` (→ `'generic'`). **One of them must drive the
  real AG-UI pipeline** — `runAgent({}, { onRunFailed: ({ error }) => … })` against a RUN_ERROR carrying
  `code: 'authentication'`, asserting the captured error is an `AgentRunError` with that failure. The
  existing tests subscribe to `run()`'s Observable directly, which skips the exact third-party hop this
  design depends on.

### 6. `[frontend]` Expose the typed failure to the rail

- `src/renderer/src/rail/useRunFailed.ts` — hold `AgentRunFailure | null` instead of a boolean, read from
  the `AgentRunError` via `instanceof` (no cast), defaulting to `'generic'` for any other error; still
  cleared on `onRunInitialized`. The file keeps its name — the hook's contract changes, not its subject,
  and a needless move is a `npm run build` risk for no gain.
- `src/renderer/src/rail/useRailConversation.ts` — expose `failure` on `RailConversation`; `runStatus`
  keeps taking a boolean (`failure !== null`), so `conversation-render.ts` and `step.ts` are untouched.
- Tests: the existing hook test, extended for the code it now returns.

### 7. `[frontend]` Render title + remedy (both locales)

Eight files — the review caught that `ActivityLabels` is constructed in four test files, not one:

- `src/renderer/src/rail/Activity.view.tsx` — `ActivityLabels.runFailed` becomes
  `{ title: string; remedy?: string }`; the header renders `title`, and when `status === 'error'` a muted
  remedy line renders beneath it. Existing tokens only (`text-feedback-error`, `text-text-muted`).
- `src/renderer/src/rail/ChatRail.controller.tsx` — resolve those strings from `convo.failure` through
  `t()`.
- `src/renderer/src/i18n/locales/en.json` **and** `es.json` — **replace** the existing dead
  `rail.runError` *string* (`"Run failed: {{message}}"`, present in both locales, referenced nowhere in
  `src/`) with the nested object it collides with: `rail.runError.authentication.{title,remedy}` and
  `rail.runError.generic.title`. `rail.runFailed` is removed once its last reader is gone. Settled copy:
  - `en`: "Sign-in expired" / "Sign in to Claude again from your terminal, then restart Pluma."
  - `es`: "Sesión caducada" / "Vuelve a iniciar sesión en Claude desde la terminal y reinicia Pluma."
- Tests: `__tests__/Activity.view.test.tsx` (failed run renders title + remedy; working and settled runs
  render neither), plus the `ActivityLabels` literal in `__tests__/AssistantRow.view.test.tsx` and
  `__tests__/Conversation.view.test.tsx`, and `__tests__/ConversationRail.controller.test.tsx:243`, which
  asserts on `i18n.t('rail.runFailed')` and must move to the new key.

### 8. `[e2e]` Prove it in the real app

- `e2e/support/launch-app.ts` — accept optional env overrides. They must be able to **remove** keys, not
  only add them: `guiEnv()` inherits all of `process.env`, so a machine with `ANTHROPIC_API_KEY`,
  `ANTHROPIC_AUTH_TOKEN` or `CLAUDE_CODE_OAUTH_TOKEN` exported would authenticate anyway and the spec
  would fail depending on whose machine it ran on.
- `e2e/agent-auth-failure.e2e.ts` (new) — launch the built app with `CLAUDE_CONFIG_DIR` pointed at an
  empty temp directory and those three keys dropped, open a real folder, send a message, assert the rail
  shows the sign-in title and its remedy line, then send a second message and assert it fails the same
  way rather than going stale.

The lever is **verified inside an Electron main process on Windows**: with an empty `CLAUDE_CONFIG_DIR`
and the three auth env keys cleared, the SDK returns `error: 'authentication_failed'` with the text
"Not logged in · Please run /login", against a control run in the ambient environment that fails with a
different message ("401 OAuth access token has expired"). The differing messages prove the SDK really is
reading the empty config dir rather than `~/.claude`. It fails within seconds and never prompts.

Not proven: that the lever overrides *valid* credentials — this machine has none right now
(the token behind the original bug report is still expired). Bound the spec with an explicit
`test.setTimeout` far below the 180s the other agent specs use; a slow run means the lever stopped
working.

No new manifest id — no new UI region and no new IPC channel, so the spec claims the existing
`feature:rail` tag.

### 9. `[docs]` Delete this plan

Its own `docs:` commit, performed by `finish-plan`.

## Constraints

- **Protocol first**: the failure rides `RunErrorEvent.code` on the existing `agent:event` channel. No new
  event types, channels, or error envelopes; nothing that AG-UI would not recognise.
- **Closed vocabulary**: only failures the UI treats differently get a name. `billing_error` and
  `rate_limit` are plausible next members and the mapping is shaped to accept them, but they are out of
  scope here.
- Hexagonal layering holds: SDK error strings are known only in the claude adapter's `logic/`; the
  application layer holds the domain union; only `src/main/ipc` may see both sides
  (`domainNoSharedImports`).
- Every user-facing string comes from `t()` and lands in `en.json` and `es.json` together (locale-parity
  test). The SDK's own prose is never rendered.
- No new dependencies. No `as` casts / `@ts-ignore` / `eslint-disable`: the SDK's `error` field is a typed
  union, and the renderer narrows with `instanceof`.
- Views stay pure props; the controller resolves labels. No DOM reaching; `window.api` stays in adapters.
- Each step ≤ ~300 weighted `src/` lines and ≤ 15 files; every code step lands with its tests.
- `e2e/support/launch-app.ts` (step 8) is the one file here a parallel worktree may also touch — the
  change is an additive optional parameter; re-check it is unmodified before committing.

## Open questions

1. **Remedy wording for `authentication`.** — *SETTLED*: approved, in English and Spanish (step 7).
   A copy-the-command chip and an in-app sign-in flow stay out of scope.
2. **Should the thrown-query-error path be logged?** — *SETTLED*: yes, the error must not be discarded.
   It is step 4, `[backend]`, with no UI effect.
3. **Domain → wire translation.** — *SETTLED* by review: an alignment test, not a production mapper
   (step 3). Trade-off accepted: the guarantee moves from the compiler to `npm run test`, which is a
   required gate anyway, and the hot path stays clean.
