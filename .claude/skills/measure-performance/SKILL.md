---
name: measure-performance
description: Measure the desktop app's performance and report regressions. Runs the Playwright-Electron perf suite against the built app, reads the rendered report, compares each metric to the accumulated same-machine baseline, and summarizes regressions with the suspect commit range so they can be picked up as tasks. Use when the user asks to measure/benchmark performance, run the perf suite, check for performance regressions, or produce a performance report.
---

# Measure performance

This skill runs the performance suite and turns its output into an actionable summary. The suite only **measures** — it never fails on a slow number; judgment happens here, by reading the report and comparing against history. Fixing a regression is separate work (propose it as a task; do not fix it under this skill unless asked).

## What it measures

The suite (`e2e/perf/scenarios/*.perf.ts`) drives the **real built app** through five scenarios, each over several iterations, reporting median + p95 (never a single number):

- **cold-start** — `launch-to-interactive` (ms): spawn → launcher interactive.
- **open-large-file** — `open-to-rendered` (ms): click a 50k-word file → rendered.
- **typing-latency** — `keystroke-to-paint` (ms, small doc; carries a 50 ms perception budget) and `keystroke-to-paint-large-doc` (ms).
- **explorer-listing** — `list-to-rendered` (ms): pick a 500-entry folder → all rows rendered.
- **long-session-memory** — `heap-growth` and `rss-growth` (bytes) after opening 20 files.

## Procedure

1. **Preconditions.** Be in a git repo with a clean-ish tree, on the branch you want to characterize (usually `main`). Note the current commit — it stamps the run.
2. **Run the suite.** `npm run test:perf` (its global-setup builds `out/` first). If `out/` is already fresh, prepend `PLAYWRIGHT_SKIP_BUILD=1` to skip the rebuild. Override iterations with `PERF_ITERATIONS` (default 5; raise for a tighter baseline, lower for a quick look). It is slow by design — several full app launches.
3. **Read the report.** Open `perf-results/report.md`. It has a provenance header (commit, version, machine, timestamp) and one section per scenario: a table of each metric's median / p95 / min / max plus **Baseline**, **Δ%**, and **Verdict**.
4. **Interpret the verdicts.** `baseline` = first run on this machine, nothing to compare yet. `ok` = within normal range. `REGRESSED` = median rose more than 20% over the same-machine baseline. `OVER BUDGET` = breached an absolute perception budget (keystroke > 50 ms). Focus on `REGRESSED` and `OVER BUDGET`.
5. **Locate the cause.** For a regression, find the baseline run's commit in `perf-results/runs/` (the most recent prior same-machine run) and list what landed since: `git log <baselineCommit>..HEAD --oneline`. Summarize the likely culprits for the affected scenario.
6. **Report and propose.** Summarize: which metrics regressed, by how much, current vs baseline, and the suspect commit range. Propose a follow-up task per confirmed regression. Do not fix it here unless explicitly asked.

## Caveats — state these in any summary

- **One machine is a biased sample.** These numbers reflect this machine, not what users experience. Runs are only comparable against prior runs **from the same machine** (the report's baseline already filters by machine id). Do not compare numbers across machines.
- **Noise is real.** That is why every metric is a median + p95 over many iterations, and why the gate is a >20% drift, not a tight threshold. A single odd run is not a regression.
- **Reports are not committed.** `perf-results/` is gitignored, exactly like `coverage/`. Never commit it. The run history under `perf-results/runs/` is the source of truth the report and baselines are built from.
- **Production telemetry is out of scope.** Real-user measurement (opt-in metrics from shipped builds) is future work, not this suite.
