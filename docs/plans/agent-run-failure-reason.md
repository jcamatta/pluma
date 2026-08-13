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

One wrinkle this must respect: AG-UI's `onEvent` subscriber does **not** fire for RUN_ERROR (only the
`onRun*` callbacks do), and `onRunFailed` hands over a plain `Error`. So the renderer carries the code
across that hop in a typed `Error` subclass of its own — a local class, not a wire shape.

## Done

- A run that fails because the Claude sign-in expired shows, in the rail's failed-run header,
  "Sign-in expired" and beneath it a remedy line (and their Spanish equivalents).
- Every other failure shows today's generic "Run failed" — never a blank, never a raw SDK string.
- The failure code is typed end to end: SDK code → domain union → wire union → renderer union, with the
  domain→wire mapping exhaustive, so adding a case later is a compile error until every layer handles it.
- `npm run lint`, `npm run test`, `npm run type-coverage`, `npm run build` green; `npm run test:e2e`
  green, including the new real-app failure spec.

## Steps

### 1. `[shared]` The wire vocabulary

- `src/shared/ipc/ipc-event-contract/agent-run-failure.ts` (new) — `AGENT_RUN_FAILURES = ['authentication', 'generic']`,
  the `AgentRunFailure` union derived from it, and `toAgentRunFailure(code: string | undefined): AgentRunFailure`,
  which narrows the protocol's optional `code` and maps anything unknown (or absent) to `'generic'`.
- `src/shared/ipc/ipc-event-contract/__tests__/agent-run-failure.test.ts` — known code narrows;
  unknown, empty and `undefined` all fall to `'generic'`.

The module documents that its carrier is `RunErrorEvent.code`, so the coupling is discoverable from the
contract rather than folklore.

### 2. `[backend]` The domain vocabulary and the SDK mapping

- `src/main/application/agent/data/run-failure.ts` (new) — the same closed union as domain data
  (`AgentRunFailure`). It is declared twice on purpose: `domainNoSharedImports` forbids the application
  and adapter layers from importing `src/shared`, and step 3 makes the two provably aligned.
- `src/main/adapters/agent/claude/logic/to-run-failure.ts` (new, pure) — the anti-corruption mapping
  `SDKAssistantMessageError → AgentRunFailure`: `'authentication_failed' → 'authentication'`, everything
  else → `'generic'`. This is the only place SDK error strings are known.
- `src/main/adapters/agent/claude/logic/step-run-event.ts` — carry the assistant message's `error` in
  `RunAccumulator`; `resultEvent` stamps the mapped code onto the `RUN_ERROR` event's `code` field.
  `is_error === true` with `subtype === 'success'` is the auth case, so the recorded code must win over
  `subtype`.
- Tests: `__tests__/to-run-failure.test.ts` (new) and additions to `__tests__/step-run-event.test.ts` —
  an assistant `error: 'authentication_failed'` followed by an `is_error` result emits `RUN_ERROR` with
  `code: 'authentication'`; a clean run is unchanged.

### 3. `[backend]` Domain → wire at the IPC boundary

- `src/main/ipc/agent/to-wire-failure.ts` (new, pure) — an exhaustive
  `Record<AgentRunFailure /* domain */, AgentRunFailure /* wire */>` and the event mapper that rewrites a
  `RUN_ERROR`'s `code` on the way out. Exhaustiveness is the point: a new domain case that no wire case
  covers fails to compile.
- `src/main/ipc/agent/run-agent-handler.ts` — apply that mapper in the forwarding
  `Stream.runForEach` before `send`. The ipc layer is the only layer allowed to translate domain → wire,
  which is why the mapping lives here rather than in the adapter.
- `src/main/ipc/agent/__tests__/to-wire-failure.test.ts` — a RUN_ERROR carrying a domain code comes out
  with the wire code; non-RUN_ERROR events pass through untouched.

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
  code round-trip, including a RUN_ERROR with no `code` (→ `'generic'`).

### 6. `[frontend]` Expose the typed failure to the rail

- `src/renderer/src/rail/useRunFailed.ts` → `useRunFailure.ts` — hold `AgentRunFailure | null` instead of
  a boolean, read from the `AgentRunError` via `instanceof` (no cast), defaulting to `'generic'` for any
  other error; still cleared on `onRunInitialized`.
- `src/renderer/src/rail/useRailConversation.ts` — expose `failure` on `RailConversation`; `runStatus`
  keeps taking a boolean (`failure !== null`), so `conversation-render.ts` and `step.ts` are untouched.
- Tests: the existing hook test, renamed and extended for the code it now returns.

### 7. `[frontend]` Render title + remedy (both locales)

- `src/renderer/src/rail/Activity.view.tsx` — `ActivityLabels.runFailed` becomes
  `{ title: string; remedy?: string }`; the header renders `title`, and when `status === 'error'` a muted
  remedy line renders beneath it. Existing tokens only (`text-feedback-error`, `text-text-muted`).
- `src/renderer/src/rail/ChatRail.controller.tsx` — resolve those strings from `convo.failure` through
  `t()`.
- `src/renderer/src/i18n/locales/en.json` **and** `es.json` — `rail.runError.authentication.{title,remedy}`
  and `rail.runError.generic.title`, the latter reusing today's "Run failed" / "La ejecución falló". The
  settled copy:
  - `en`: "Sign-in expired" / "Sign in to Claude again from your terminal, then restart Pluma."
  - `es`: "Sesión caducada" / "Vuelve a iniciar sesión en Claude desde la terminal y reinicia Pluma."
- `src/renderer/src/rail/__tests__/Activity.view.test.tsx` — a failed run renders title + remedy; a
  working and a settled run render neither.

### 8. `[e2e]` Prove it in the real app

- `e2e/support/launch-app.ts` — accept optional env overrides merged into `guiEnv()`.
- `e2e/agent-auth-failure.e2e.ts` (new) — launch the built app with `CLAUDE_CONFIG_DIR` pointed at an
  empty temp directory, open a real folder, send a message, and assert the rail shows the sign-in title
  and its remedy line.

The lever is verified: with an empty `CLAUDE_CONFIG_DIR` the SDK returns `error: 'authentication_failed'`
("Not logged in · Please run /login") deterministically, without touching the user's real credentials and
without needing a valid account. No new manifest id — no new UI region and no new IPC channel, so the
spec claims the existing `feature:rail` tag.

### 9. `[docs]` Delete this plan

Its own `docs:` commit, performed by `finish-plan`.

## Constraints

- **Protocol first**: the failure rides `RunErrorEvent.code` on the existing `agent:event` channel. No new
  event types, channels, or error envelopes; nothing that AG-UI would not recognise.
- **Closed vocabulary**: only failures the UI treats differently get a name. Adding one later means
  touching steps 1–3 and 6 together — which the exhaustive Record in step 3 enforces.
- Hexagonal layering holds: SDK error strings are known only in the claude adapter's `logic/`; the
  application layer holds the domain union; only `src/main/ipc` maps domain → wire
  (`domainNoSharedImports`).
- Every user-facing string comes from `t()` and lands in `en.json` and `es.json` together (locale-parity
  test). The SDK's own prose is never rendered.
- No new dependencies. No `as` casts / `@ts-ignore` / `eslint-disable`: the SDK's `error` field is a typed
  union, and the renderer narrows with `instanceof`.
- Views stay pure props; the controller resolves labels. No DOM reaching; `window.api` stays in adapters.
- Each step ≤ ~300 weighted `src/` lines and ≤ 15 files; every code step lands with its tests.

## Open questions

1. **Remedy wording for `authentication`.** — *SETTLED*: the proposed sentence is approved, in English
   and Spanish (see step 7). A copy-the-command chip and an in-app sign-in flow stay out of scope.
2. **Should the thrown-query-error path be logged?** — *SETTLED*: yes, the error must not be discarded.
   It is step 4, `[backend]`, with no UI effect.
