# Performance measurement suite

An automated, repeatable way to measure Pluma's performance ahead of v1. A dedicated Playwright-Electron suite (`npm run test:perf`) drives the **built** app through a fixed set of user scenarios, measures each one over several iterations, and writes a machine-readable JSON result plus a human-readable markdown report to a **gitignored** results folder — like `coverage/`, reports are never committed; only the measurement code and the skill are. A Claude Code skill encapsulates the measurement process (build → run → render → compare → summarize regressions) so the report can be picked up and acted on as a task. (Attaching the skill to a recurring schedule is the user's own task and out of scope here.)

**One report per run, one section per scenario.** Each scenario spec writes its own result into a pending area during the run; the `globalTeardown` assembles a single run JSON (all scenarios) and renders a single `report.md` whose sections are the scenarios. You read one artifact for the whole picture; the per-scenario granularity lives inside it, and the JSON retains everything for any later Excel/cowork rendering.

The suite **measures, it does not gate**: no hard thresholds inside the specs. Judgment happens downstream by comparing a run against the accumulated baseline on the same machine (e.g. flag a metric that drifts >20% from the baseline median). The only absolute targets we adopt are the well-established perception ones (keystroke latency ≈ <50 ms, interaction response ≈ <100 ms), and even those are reported as verdicts, not assertion failures.

**Known limitation (stated up front):** numbers from one developer machine are an approximation, not what users experience. Runs are only comparable against runs from the **same machine** (the run context records a machine id for exactly this). True production telemetry from real users is explicitly **out of scope** for this plan — future work.

## Done

- `npm run test:perf` builds nothing new conceptually: it runs the perf suite against `out/` (reusing the e2e global-setup build), executes every scenario N times, and leaves behind:
  - `perf-results/runs/<timestamp>-<commit>.json` — the granular per-scenario stats (median, p50/p95, iteration count) plus run context (commit hash, app version, machine, timestamp), and
  - `perf-results/report.md` — the rendered report: latest run per scenario, baseline (median of prior same-machine runs), delta, and a verdict.
- `perf-results/` is gitignored; nothing under it is ever committed.
- Scenarios covered: cold start, open large file, typing latency (small + large doc), explorer listing of a large folder, long-session memory.
- All statistics and comparison logic are pure calculations with unit tests; `lint`, `test`, `type-coverage`, `build` green at every step.
- `.claude/skills/measure-performance/SKILL.md` exists and describes the full measurement process end to end (run → read report → compare to baseline → summarize regressions → propose follow-up tasks). Scheduling it is the user's own task, not part of this plan.

## Architecture

- **Where the code lives:** `e2e/perf/` — one spec per scenario under `e2e/perf/scenarios/*.perf.ts`, shared measurement helpers under `e2e/perf/support/`, pure-logic tests under `e2e/perf/support/__tests__/` (Vitest node project, same as the existing `e2e/__tests__/audit.test.ts`). This reuses `tsconfig.e2e.json` (already includes `e2e/**/*`) and the `eslint/e2e.mjs` block; both need only the new perf Playwright config file added to their file lists. All of it is outside `src/`, so commit weight is 0 — steps stay small anyway for the veto reviewer.
- **Own Playwright config:** `playwright.perf.config.ts` with `testMatch: '**/scenarios/*.perf.ts'`, `workers: 1`, the existing `e2e/support/global-setup.ts` for the build, and a `globalTeardown` that assembles the run JSON and renders the report. The e2e config matches only `*.e2e.ts`, and the e2e coverage audit scans only e2e specs, so the two suites stay fully independent — perf specs do not claim manifest ids.
- **One report, assembled from per-scenario pieces.** Each scenario spec writes its measured result to `perf-results/.pending/<scenario>.json` as it runs (specs run sequentially under `workers: 1`). The `globalTeardown` collects every pending piece, writes one consolidated run file `perf-results/runs/<timestamp>-<commit>.json` (all scenarios + run context), clears the pending area, and renders a single `perf-results/report.md` with one section per scenario. Adding a scenario therefore never touches the report wiring — it just drops another pending piece the teardown picks up.
- **Measurement mechanics:** `performance.mark`/`performance.measure` via `page.evaluate` for renderer timings; a CDP session (`Performance.getMetrics`) for JS heap and layout/script counters; `app.getAppMetrics()` via `electronApp.evaluate` for per-process CPU/memory. Specs reuse `launchApp`, `withTempFolder`, and the sanctioned folder-picker stub exactly as e2e does — nothing else is stubbed.
- **Statistics discipline:** every scenario runs N iterations (default 5, overridable via `PERF_ITERATIONS`) and reports median + p95, never a single number. Cold start relaunches the app per iteration; in-app scenarios may iterate within one launch where that is faithful.
- **Report + baseline as plain code, no new deps:** the teardown (TypeScript, transpiled by Playwright like the config itself) reads all `perf-results/runs/*.json` for the current machine id, computes the baseline per metric (median of prior runs), and writes `report.md`. Comparison rules (delta %, regression flag at >20%, perception verdicts for keystroke/interaction) are pure functions in `support/`, unit-tested.

## Steps

1. **Perf harness skeleton.** ✅ Done. `playwright.perf.config.ts` (testDir `e2e/perf/scenarios`, testMatch `*.perf.ts`, workers 1, reuse global-setup; teardown wired in step 3); `e2e/perf/support/scenario-result.ts` (the `ScenarioResult`/`PerfMetric`/`PerfUnit` data types — metrics carry raw per-iteration samples); `e2e/perf/support/perf-paths.ts` (the gitignored `perf-results/` locations); `e2e/perf/support/stats.ts` (`summarize` → count/min/median/p95/max via R-7 interpolation, with `__tests__/stats.test.ts`); `e2e/perf/support/write-pending.ts` (a scenario writes its result to `perf-results/.pending/<scenario>.json`); npm script `test:perf`; `.gitignore` entry `perf-results/`; added the new config file to `tsconfig.e2e.json` include and `eslint/e2e.mjs` files. `run-context.ts` was moved to step 3, where it is first consumed at run-assembly time (avoids unconsumed code in this step). Lands green with the stats unit tests.
2. **Cold-start scenario.** ✅ Done. `e2e/perf/scenarios/cold-start.perf.ts`: N full launch→close cycles measuring spawn → launcher "Open Folder" button visible (the interactive marker — see resolved open question), writing a `launch-to-interactive` (ms) metric as its pending piece. Added shared helpers it needs: `support/resolve-iterations.ts` (PERF_ITERATIONS, default 5; tested) and `support/collect-samples.ts` (sequential, recursive, no mutable state; tested). Verified end to end: a 2-iteration run built the app and wrote `perf-results/.pending/cold-start.json` (~1.0s to interactive on the dev machine).
3. **Report assembly + renderer.** `e2e/perf/support/run-context.ts` (commit hash via `git rev-parse`, app version from `package.json`, machine id from `os.hostname()`, timestamp); `e2e/perf/support/assemble-run.ts` (pure: pending pieces + run context → one run record) and `e2e/perf/support/render-report.ts` (pure: run record → markdown, one section per scenario), both with `__tests__`; a `globalTeardown` wires them — collect pending → write `perf-results/runs/<timestamp>-<commit>.json` → clear pending → write `perf-results/report.md`. At this point a run produces both artifacts.
4. **Baseline comparison.** `e2e/perf/support/compare-baseline.ts` (pure: current run + prior same-machine runs → per-metric baseline, delta %, regression flag >20%, perception verdicts; `__tests__/compare-baseline.test.ts`), folded into the rendered report (baseline / delta / verdict columns).
5. **Scenario: open large file.** `e2e/perf/support/seed-large-doc.ts` (pure generator for a ~50k-word markdown body, tested) + `e2e/perf/scenarios/open-large-file.perf.ts`: seeded temp folder, open via the stubbed picker, measure click → editor content rendered.
6. **Scenario: typing latency.** `e2e/perf/scenarios/typing-latency.perf.ts`: keystroke → DOM update p50/p95, in a small doc and in the large seeded doc (reusing the step-5 generator).
7. **Scenario: explorer listing.** `e2e/perf/scenarios/explorer-listing.perf.ts`: temp folder seeded with ~500 entries, measure open → all rows rendered.
8. **Scenario: long-session memory.** `e2e/perf/scenarios/long-session-memory.perf.ts`: open/close ~20 files in one launch; record JS heap (CDP) and per-process RSS (`app.getAppMetrics()`) before vs after; report growth.
9. **The measurement skill.** `.claude/skills/measure-performance/SKILL.md`: the operating procedure — ensure a clean tree on current `main`, `npm run test:perf`, read `perf-results/report.md`, compare against baseline, summarize regressions with the suspect commit range (baseline commit → current commit), and propose follow-up tasks for confirmed regressions. Scheduling the skill is the user's task and is not documented as a step here.
10. **Remove the plan** (`docs:` commit, via `finish-plan`).

## Constraints

- No new dependencies — statistics, rendering, and comparison are hand-written pure TypeScript; Playwright transpiles the config/teardown as it already does for e2e.
- The perf suite never mocks `window.api`, IPC, the filesystem, or use cases; the folder-picker stub remains the only sanctioned stub.
- Specs always pass — a perf run is a measurement, not a gate; regressions surface in the report, never as a red suite.
- Reports and run history (`perf-results/`) are gitignored and never committed; only measurement code, tests, config, and the skill enter git.
- Hard bans still apply in `e2e/` (no `let`, no `as`, no escape hatches, no disable directives); helpers follow the `withResource` style.
- `test:perf` is on-demand / scheduled only — it must not be added to any git hook.
- Perf specs do not appear in `e2e/coverage-manifest.ts` and claim no `@e2e` tags.

## Open questions

- **Report format beyond markdown.** Markdown now; an Excel/cowork rendering of the run history can be layered on later since the JSON is the source of truth. Markdown is the v1 deliverable — `OPEN (deferred, does not block)`.
- **"App interactive" marker for cold start.** `SETTLED` — the launcher's "Open Folder" button becoming visible (`getByRole('button', { name: 'Open Folder' })`, from `launcher.e2e.ts`) is the first thing a user can act on, so it marks interactive.
- **Iteration count N.** Default 5 per scenario (cold start is the expensive one at ~N full launches); revisit after the first baselines show the variance. `OPEN (tune after step 4)`.
- **Production telemetry.** Out of scope here; would be its own plan (opt-in metrics, privacy, transport). `SETTLED (excluded)`.
