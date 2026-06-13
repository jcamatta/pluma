# Fix: Stop button aborts the in-flight run

## Summary

The composer's **Stop** button does not interrupt a running agent turn. `ChatRailController` calls
`agent.abortRun()`, but `AbstractAgent.abortRun()` is an empty no-op in `@ag-ui/client` — only the
library's own `HttpAgent` overrides it. Our `Agent` subclass never does, so clicking Stop runs a no-op
while the backend keeps streaming. The real abort path (`run()` Observable teardown →
`abortRunById(runId)` → `agent:abort` → `query.interrupt()`) only fires when the run's RxJS subscription
is torn down, which `abortRun()` currently never causes.

This is a small, independent fix: override `abortRun()` in our `Agent` so it tears the active run down.

## Root cause (already investigated)

- `AbstractAgent.abortRun(): void` is `{}` — a no-op (`@ag-ui/client/dist/index.mjs`,
  `index.d.ts:377`). `HttpAgent` overrides it (`abortRun(){this.abortController.abort();super.abortRun()}`).
- The base class pipes every run through `takeUntil(this.activeRunDetach$)` and exposes a **public**
  `detachActiveRun(): Promise<void>` (`index.d.ts:527`) that does `activeRunDetach$.next()` then
  completes. `activeRunDetach$` itself is private (`index.d.ts:498`), so the detach method is the seam.
- Calling `detachActiveRun()` completes the piped run → unsubscribes our `run()` Observable → its
  existing teardown `() => { off(); if (!done && runId) this.abortRunById(runId) }`
  (`src/renderer/src/agent/adapters/Agent.ts`) fires the abort over IPC. So the fix is to make
  `abortRun()` trigger the detach.

## Done

- Clicking **Stop** while a run is in flight settles it: the composer flips Stop → Send and the backend
  query is interrupted (no further events arrive for that run).
- `Agent.abortRun()` has a unit test proving it tears the active run down and reaches the abort seam.
- The existing real-app Stop spec in `e2e/rail.e2e.ts` ("stops an in-flight run with the composer Stop
  button"), currently red, passes.
- `npm run lint`, `npm run test`, `npm run type-coverage`, `npm run build` green; `npm run test:e2e`
  green for `rail.e2e.ts` (UI change).

## Steps

1. **Override `abortRun()` in `Agent`** (with unit test).
   - `src/renderer/src/agent/adapters/Agent.ts`: add
     `override abortRun(): void { void this.detachActiveRun(); super.abortRun() }`. Keep it `void` —
     the method's contract is synchronous; the detach's completion is observed through the existing
     teardown, not awaited here.
   - `src/renderer/src/agent/adapters/__tests__/Agent.test.ts`: extend the existing subclass-based
     harness — start a run (drive a fake event stream so a `runId` is minted via the overridden
     `startRun`), then call `abortRun()` and assert `abortRunById` (the protected seam the tests already
     override) is invoked with that `runId`, i.e. the run was torn down. Cover the no-active-run case:
     `abortRun()` before any run does not throw and does not call the abort seam.
   - One commit. Well under budget (1 source file + 1 test).

2. **Remove this plan** — `docs:` commit deleting `docs/plans/fix-stop-abort.md` once shipped
   (performed by `finish-plan`).

## Constraints

- Renderer adapter file (`adapters/`) — IPC is allowed here; no view/controller rules apply.
- No new dependencies. No escape hatches (no `as`, `!`, ts/eslint-disable). `detachActiveRun` is public,
  so no cast is needed to reach it.
- No manifest change: `agent.abort`, `feature:rail` are already shipped and claimed by `e2e/rail.e2e.ts`.
  The spec already exists — this fix turns it green rather than adding coverage.

## Open questions

- _SETTLED_ — `detachActiveRun()` is public on `AbstractAgent` (`index.d.ts:527`); the override needs no
  cast or escape hatch.
- _SETTLED_ — abort already wired end to end on teardown (`abortRunById` → `AGENT_ABORT_CHANNEL` →
  `abortAgent` → `query.interrupt()`); this change only makes Stop reach that teardown.
