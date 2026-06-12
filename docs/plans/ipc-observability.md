# IPC-layer observability

Give the main-process IPC layer a single, reusable observability pattern so every endpoint logs
**what channel was called, whether it succeeded or failed, how long it took, and the failure cause** —
as structured JSON. Today none of the 13 handlers log anything, and each one re-implements the same
`Effect.runPromiseExit` + `Exit.match` + `Cause.failureOption` + fallback-tag serialization by hand.

We model this on serene's pattern (`withIpcLog` + a shared `ManagedRuntime` in
[.references/serene/src/backend/common/inbound/handler.ts](../../.references/serene/src/backend/common/inbound/handler.ts)
and [runtime.ts](../../.references/serene/src/backend/runtime.ts)), adapted to pluma's typed `_tag`
`Result` errors: we keep each channel's per-error projection (it is part of the IPC contract) but pull
the runtime, the logging, and the `Exit → Result` fold into one wrapper.

All logging primitives used (`Effect.log*`, `Effect.annotateLogs`, `Effect.withLogSpan`,
`Effect.withSpan`, `Logger.json`, `Logger.minimumLogLevel`, `ManagedRuntime`) are in the core `effect`
package — **no new dependency**.

## Done

- A shared `mainRuntime` (`ManagedRuntime`) provides a **JSON** logger layer to every IPC handler.
- A reusable `runIpc(...)` wrapper (plus a `runIpcAck(...)` variant for no-fail acks) runs a use-case
  effect on that runtime, emits a `started` / `succeeded` / `failed` log carrying the **channel** (and
  safe scalar context like a path or thread id) as JSON annotations, records elapsed time, opens a
  tracing span, and folds the `Exit` into the existing plain `Result`.
- All 13 IPC handlers are migrated to the wrapper. Their **return types and `Result` shapes are
  unchanged** — the renderer sees exactly what it sees today; only logging is added and boilerplate
  removed.
- `npm run lint`, `npm run test`, `npm run type-coverage`, `npm run build` all green. No new IPC
  channel and no user-facing UI change, so the **e2e coverage manifest is unaffected** and
  `npm run test:e2e` is not required for this plan.

## Steps

### 1. Observability foundation: runtime + reusable wrapper

The whole reusable pattern, self-contained and immediately exercised by its own tests.

- `src/main/runtime/observability-layer.ts` — the cross-cutting layer: `Logger.json` (structured JSON
  log output) merged with `Logger.minimumLogLevel(LogLevel.Info)`. This carries **only** logging; adapter
  layers stay per-handler.
- `src/main/runtime/main-runtime.ts` — `export const mainRuntime = ManagedRuntime.make(observabilityLayer)`.
- `src/main/ipc/shared/run-ipc.ts` — `runIpc(options)`, a **single options object** (respects
  `max-params: 2`):
  ```ts
  interface RunIpcOptions<A, E, PlainError, R> {
    readonly channel: string
    readonly effect: Effect.Effect<A, E, R> // use case with its adapters already provided
    readonly onError: (error: E) => PlainError // typed failure → plain Result error
    readonly onDefect: () => PlainError // unexpected defect/interrupt → fallback
    readonly annotations?: Record<string, string | number | boolean> // safe scalars only
  }
  ```
  It wraps `effect` with `Effect.annotateLogs({ channel, ...annotations })`,
  `Effect.withLogSpan('ipc')`, and `Effect.withSpan(\`ipc.${channel}\`)`; logs `started`, then on
success `Effect.logInfo('succeeded')`, on failure `Effect.logError('failed', ...)`with`Cause.pretty`. Runs on `mainRuntime.runPromiseExit`, then folds: success → `{ ok: true, value }`,
`Cause.failureOption`present →`{ ok: false, error: onError(value) }`, otherwise
`{ ok: false, error: onDefect() }`.
- `src/main/ipc/shared/run-ipc-ack.ts` — `runIpcAck({ channel, effect, annotations? })` for handlers
  whose `Result` error channel is `never` (it logs + runs but always returns `{ ok: true, value: null }`);
  keeps the one-export-per-file rule.
- Wire `mainRuntime` disposal in `src/main/index.ts` on `will-quit` (the logger layer has no
  finalizers today, but the lifecycle is correct and future layers — a file sink, a tracer — will need it).

**Tests** (`src/main/ipc/shared/__tests__/run-ipc.test.ts`): success returns `{ ok: true }`; a typed
tagged failure is projected by `onError`; a defect (`Effect.die`) falls back to `onDefect`; assert the
`channel` annotation appears on the emitted log (capture via a test `Logger`). The tracing span uses
the default no-op tracer, so no Tracer layer is required to compile or test.

Decision: **JSON everywhere** (per the locked decision "we want json logs"). A pretty-in-dev toggle is
recorded under Future ideas, not built now.

### 2. Migrate file handlers

Replace the hand-rolled body in each of the four file handlers with `runIpc`, preserving the exact
`Result` projection and adapter wiring; annotate the safe `path` scalar (never file contents).

- `src/main/ipc/file/create-file-handler.ts`, `delete-file-handler.ts`, `write-file-handler.ts`,
  `read-file-handler.ts`.
- Update the four sibling tests in `src/main/ipc/file/__tests__/` (behavior identical — they should
  pass with at most assertion-noise adjustments for emitted logs).

### 3. Migrate folder query/command handlers

The four non-streaming folder handlers, same mechanical swap; annotate `path` where present.

- `src/main/ipc/folder/list-folder-handler.ts`, `create-folder-handler.ts`, `delete-folder-handler.ts`,
  `pick-folder-handler.ts` (pick projects `{ _tag }` only — no path).
- Update the corresponding tests under `src/main/ipc/folder/__tests__/`.

### 4. Migrate the folder watch handler

`watch-folder-handler.ts` is a streaming/forked ack: it forks the watch-and-forward effect and returns
a `Result<null, FolderWatchError>` reporting only whether the **initial subscribe** succeeded. Wrap the
**ack effect** (the `Deferred.await(ready)` portion) with `runIpc` so the subscribe outcome is logged
with the `folder:watch` channel and `path`. The forked long-lived forwarding stream is left as-is for
now (per-event stream logging is a Future idea, not this step).

- `src/main/ipc/folder/watch-folder-handler.ts` + its test.

### 5. Migrate agent thread handlers

The four standard-shape agent handlers; annotate `cwd` / `threadId` (safe scalars).

- `src/main/ipc/agent/list-threads-handler.ts`, `thread-history-handler.ts`, `rename-thread-handler.ts`,
  `delete-thread-handler.ts`.
- Update the existing tests under `src/main/ipc/agent/__tests__/`.

### 6. Migrate agent ack + run handlers

- `abort-agent-handler.ts`, `submit-tool-result-handler.ts` → `runIpcAck` (both are `Result<null, never>`).
- `run-agent-handler.ts` → wrap the **ack effect** (mint runId + fork the event stream) with `runIpc`
  so the run-start outcome is logged with the `agent:run` channel and `threadId`/`runId`. The forked
  `Stream.runForEach` that forwards AG-UI events to the renderer is not per-event logged here (Future
  idea).
- Add/extend tests for the run-start ack and the two acks.

### 7. Remove the plan

Final `docs:` commit removing this file once every step is shipped and green (performed by
`finish-plan`).

## Constraints

- **Layering.** Changes are confined to the IPC layer plus a new `src/main/runtime/` infra folder at the
  edge. No `application/` or `adapters/` file changes. The runtime/wrapper may import `Logger`/`Effect`
  from core `effect`. Dependencies still point inward only.
- **`Result` boundary preserved.** Every handler returns the same plain discriminated union with the same
  `_tag` errors it returns today. Effect types never cross IPC. The per-channel error projection stays in
  the handler (it is contract serialization, not cross-cutting concern).
- **CQS unaffected.** Command vs query use cases are untouched; this is purely an endpoint-execution concern.
- **No new dependency.** Logging, log spans, and tracing spans are all core `effect`. (OTLP export, which
  needs `@effect/opentelemetry`, is explicitly deferred — see Future ideas.)
- **Privacy.** Annotate the `channel` plus safe scalars only (path, cwd, thread id, run id). **Never**
  annotate file contents, message bodies, tool payloads, or provider keys.
- **Style.** One export per file (hence separate `run-ipc.ts` / `run-ipc-ack.ts`), no `as`, no non-null,
  no disable directives. Spans use the default tracer so nothing new is required to compile.
- **e2e.** No new channel and no UI change ⇒ the `e2e/coverage-manifest.ts` audit is unaffected; do not
  add manifest ids. `test:e2e` is not a gate for this plan.

## Future ideas (metrics + deeper observability)

Recorded now, intentionally **out of scope** for this plan (decision: logging only for the first pass):

- **Metrics in `runIpc`.** An `ipc_requests_total` counter tagged `{ channel, outcome }` and an
  `ipc_request_duration_ms` histogram per channel (`Metric.counter` / `Metric.histogram`, both core
  `effect`). For the agent: an active-runs gauge, a runs-started/-failed counter, and watcher
  event-throughput. Expose via a small `diagnostics:*` IPC channel (with its own e2e coverage) or a
  periodic JSON snapshot log.
- **Tracing export (OTLP).** Add `@effect/opentelemetry` `OtlpTracer` as a layer on `mainRuntime`
  (needs dependency approval). The `Effect.withSpan` calls added in Step 1 — plus new `withSpan` calls
  inside use cases and adapters — would then export a real trace tree (IPC span → use-case span →
  adapter I/O span) to a collector, with no handler changes.
- **Renderer↔main correlation id.** Pass a request/correlation id from the renderer through IPC and
  annotate logs on both sides so a single user action is traceable end to end.
- **Persistent log sink.** A custom `Logger` that also writes the JSON lines to a rotating file under
  `userData`, for support bundles — not just the console.
- **Pretty-in-dev toggle.** Swap `Logger.json` for `Logger.pretty` when not packaged, selected at
  runtime layer construction, while keeping JSON in production.
- **Per-event stream observability.** Lightweight logging/metrics for the long-lived forwarding streams
  in `watch-folder` and `run-agent` (e.g. events-forwarded counter, stream-closed/-errored logs).
- **Redaction policy.** A shared allow-list helper for which scalars may be annotated, so the privacy
  rule is enforced in one place rather than per handler.

## Open questions

- **SETTLED — log format:** structured JSON via `Logger.json`, everywhere.
- **SETTLED — scope:** logging only now; metrics and OTLP are Future ideas above.
- **SETTLED — annotations:** channel + safe scalars (path / cwd / thread id / run id) only; never payloads.
- **SETTLED — streaming handlers:** instrument the ack outcome only in this plan; per-event stream
  logging is deferred.
