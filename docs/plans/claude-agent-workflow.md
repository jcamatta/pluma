# Claude agent workflow — thin global router + per-area worker agents + an orchestrator

## Summary

Replace the two overlapping always-on rule documents (`.claude/CLAUDE.md`, ~495 lines, and
`docs/project-rules.md`, 206 lines, which already contradict each other on header comments) with a
layered setup that loads each kind of knowledge **only where it is needed and only where it is
reliably present**, and drives every change through one orchestrator so the full pipeline runs every
time.

- **Global knowledge lives in `CLAUDE.md`** — reliably loaded on the **main/orchestrator thread**:
  what Pluma is, the non-negotiables a tool can't enforce, the commit/branch grammar, and the routing
  map. Thin (~120 lines).
- **Area knowledge lives IN the worker agent's body.** `backend-engineer`'s system prompt _is_ the
  backend conventions (full reference prose); `frontend-engineer`'s is the frontend + e2e conventions.
  This is the corrected decision (see "Why knowledge lives in the agent body"): a subagent runs in its
  own context and does **not** reliably auto-load `CLAUDE.md`, `docs/`, or `@import` references, so the
  only place rules are _guaranteed_ to reach the worker is its own body. `docs/conventions/README.md`
  is a one-screen pointer to those bodies so a human still has a docs entry point.
- **veto stays the enforced subset, separate by design.** `.veto/backend.yaml` / `frontend.yaml`
  inline their rules and are deliberately doc-blind (_"never read documentation — judge only the
  code"_). They are the terse, enforceable subset of the conventions, at a different altitude (the
  agent body teaches; veto rejects). Two artifacts are inherent; the agent body is canonical and the
  veto yaml is its enforced subset (see "Single home per rule").
- **An orchestrator skill, `build-feature`, sequences the fixed pipeline every time:** design → (your
  approval) → independent review → implement (contract first, then backend ∥ frontend) → independent
  validation → finish (delete plan, push, PR, link + live-test command). It is a **sequencer, not a
  hard gate** — no hook can enforce "phase N ran"; what is mechanically enforced is veto/lint/type at
  commit and the validator's evidence in the PR body.

## Why knowledge lives in the agent body (the corrected decision)

The original plan put area rules in `docs/conventions/*.md` that the worker would "read first." A probe
during implementation established two facts that kill that approach:

1. The Claude Code docs are **silent on `@import` inside agent bodies**, and CLAUDE.md is **not
   documented as auto-loaded for custom subagents**. A subagent's only guaranteed context is its own
   body (the system prompt) plus what the caller passes in the prompt.
2. "Read `docs/conventions/backend.md` first" is an _instruction the model may skip_ — exactly the
   adherence failure this redesign exists to fix.

Therefore the operative rules for an area live in that area's worker body, where they are guaranteed
loaded. This still honors the goal "rules live in a readable file the agent has": the body is plain
reference markdown, not an action skill. The only change from the earlier decision is **location**
(`.claude/agents/<role>.md` instead of `docs/conventions/<area>.md`), chosen for reliability.
`docs/conventions/README.md` points humans to it.

## Single home per rule (the single-source-of-truth invariant)

Each rule has exactly **one canonical home**; every other mention only _points_, never restates:

| Rule kind                         | Canonical home                                                         | Who else may reference it                                               |
| --------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Area "how we code" (full prose)   | the worker agent body (`backend-engineer.md` / `frontend-engineer.md`) | `docs/conventions/README.md` (pointer only)                             |
| The mechanically-judgeable subset | `.veto/<area>.yaml` (terse, doc-blind)                                 | — (it cannot read the body by design)                                   |
| Global non-negotiables + grammar  | `CLAUDE.md`                                                            | worker bodies carry a short **non-negotiables echo** (audited to match) |
| Mechanical style/size/safety      | `eslint/`, `tsconfig`, `.husky/`                                       | bodies say "enforced by lint", never restate the rule                   |

The unavoidable duplications — the veto subset, and the short non-negotiables echo each worker needs
because it may not load CLAUDE.md — are **made safe by a mandatory audit** (step 8, not optional):
every `.veto/*.yaml` rule id maps to a heading in the matching agent body, and the non-negotiables
echo is byte-checked against CLAUDE.md's list. Drift turns the audit red.

## Context flow — how isolated workers stay coordinated

Subagents do not see the conversation, so coordination is explicit through four channels:

1. **The plan file on disk** — the shared spec every worker reads (steps, per-step area tag, "Done").
2. **The contract (`src/shared` IPC types/ports + error tags), defined first** — the interface both
   parallel workers build against, and the set of error `_tag`s the frontend will map to locale keys.
   Defining it up front is what lets backend and frontend run without seeing each other's code.
3. **The orchestrator is the shared memory.** The main thread holds the whole conversation; when it
   dispatches a worker it passes the plan path, the specific step(s), the contract, and a summary of
   what prior workers returned. For sequential steps the later worker can also read the earlier
   worker's committed code.
4. **The validator reads the plan's "Done" + the full `main...HEAD` diff** — independent _judgment_,
   shared _spec_, plus negative cases.

**Known traps travel with the worker.** The hard-won landmines (worktree path trap, Base UI
`data-active` vs `data-selected`, class-method binding loss via context, the live-stream settle race,
i18n es/en parity, PM scroll inside Base UI ScrollArea) live as a "Known traps" section in the
relevant worker body, because an isolated worker has none of the session memory that recorded them.

## Parallel execution (kept by explicit request; merge risk bounded)

You asked to ship backend and frontend in parallel to accelerate. We keep it, with the merge risk
bounded by sequencing the genuinely-shared work outside the parallel window:

1. **Contract step (sequential)** — shared types / IPC contract / error tags in `src/shared`, by the
   `backend-engineer`. Fixing the contract (and the error tags) up front removes the "contract evolves
   mid-flight" conflict the review flagged.
2. **Backend ∥ Frontend (parallel)** — `backend-engineer` (`src/main`) and `frontend-engineer`
   (`src/renderer`) run at once, each with `isolation: worktree` so commits never race on one index.
   The trees are disjoint and each side wires only its own end (IPC handler in `src/main`;
   `RepositoriesProvider` adapter + locale strings in `src/renderer`), so there is no shared file in
   this window.
3. **Merge (orchestrator)** — fold both worktrees' commits onto the plan branch.
4. **e2e (sequential)** — once both sides are wired, the `frontend-engineer` writes the real-app spec
   and adds the `coverage-manifest.ts` id(s). Done after the merge, so the manifest is never edited by
   two workers at once.

> Reviewer dissent on record: an independent review recommended dropping parallelism as opposite-grain
> to this repo's small-sequential-commit model and questioned the speedup. We keep it per your explicit
> request; the contract-first + e2e-last sequencing is the mitigation. If merge friction shows up in
> practice, falling back to fully sequential is a one-line change (drop `isolation: worktree` and run
> the two steps in order) with zero correctness cost.

A single-area change just runs its one worker; the parallel window only applies when a change has
disjoint backend + frontend work. The pipeline _phases_ always all run — parallelism is an
implementation-phase optimization, never a skipped phase.

## Target architecture

```
.claude/
  CLAUDE.md                      ← THIN, GLOBAL, reliably loaded on the main thread (<~120 lines)
      • What Pluma is (2 lines)
      • Non-negotiables a tool can't enforce (branch-first, never merge, never game/weaken a check,
        no escape hatches, no new deps, minimal diff/YAGNI, both locales, no AI/authorship attribution)
      • Commit & branch grammar (brief; the commit-msg hook enforces the detail)
      • Routing map: build a change → /build-feature; the phases and the skill/agent each uses;
        "area rules ARE the worker agent bodies; veto enforces the subset"
      • "veto / lint / type-coverage / hooks are the real gate (configs, not prose)"
      • (no stale .veto/architect.yaml reference — killed)

  skills/                        ← ACTIONS only (verbs)
    build-feature/SKILL.md       ← NEW orchestrator/sequencer: design → approve → review → implement → validate → finish
    design-plan/                 ← exists; updated to tag each step's area (shared/backend/frontend/e2e)
    finish-plan/                 ← exists; updated to validate via change-validator and emit PR link + live-test command
    test-functionality/          ← exists; the validator's procedure

  agents/                        ← WORKERS (who + what knowledge); active only after a Claude Code restart
    backend-engineer.md          ← body = full backend conventions + non-negotiables echo + known traps; tools scoped; isolation: worktree
    frontend-engineer.md         ← body = full frontend + e2e conventions + non-negotiables echo + known traps; tools scoped; isolation: worktree
    plan-reviewer.md             ← read-only; focused review checklist (constraints, SRP-vs-action, over-complication, simplification, out-of-box)
    change-validator.md          ← independent; proves the change works via test-functionality; returns an evidence report

docs/
  conventions/README.md          ← POINTER: "area conventions are the engineer agent bodies; veto is the enforced subset"
  project-rules.md               ← DELETED
```

## The pipeline (scenario)

You run **`/build-feature "word-count badge, persisted per file"`**:

1. **Design** — runs `design-plan`: writes `docs/plans/word-count-badge.md`, slicing and tagging each
   step (shared contract, backend, frontend, e2e). **Pauses, shows you the plan.**
2. **Your approval.** (gate)
3. **Review** — dispatches the **`plan-reviewer`** (fresh context, reads plan + codebase): missed
   constraints, SRP-vs-action confusion, over-complication, simplifications, out-of-box angles.
   Orchestrator folds it in; re-shows you if it changed materially.
4. **Implement** — creates the branch; **contract step** (shared types + error tags) first; then
   **`backend-engineer` ∥ `frontend-engineer`** in isolated worktrees against the contract; merges
   both; then the **e2e** step. veto runs on every `src/` commit against the matching `.veto/*.yaml`.
5. **Validate** — dispatches **`change-validator`** (independent): proves it works against the plan's
   "Done" + the diff, returns an evidence report.
6. **Finish** — runs `finish-plan`: deletes the plan (own `docs:` commit), pushes, opens the PR with
   the validator's report in the body, and returns the **PR link** + **`cd <worktree> && npm start`**
   (with a "then: click…" line).

## Steps

Every file here is under `.claude/` or `docs/` → **weight-0**; the commit-size hook imposes no size or
test requirement, and veto (scoped to `src/`) does not review these commits. Slicing is for
reviewability. Each commit is conventional and lands on `chore/claude-agent-workflow`.

1. **`backend-engineer` agent.** Body = full backend conventions lifted+corrected from the current
   docs (hexagonal, CQS, Result-at-IPC, repositories, Effect, Data/Calc/Action, layer boundaries,
   backend testing, commit-size detail, "mechanical rules enforced by lint") + non-negotiables echo +
   Known-traps (backend-relevant). Scoped `tools`; `isolation: worktree`.

2. **`frontend-engineer` agent.** Body = full frontend conventions (component types, hook CQS,
   ports/adapters, design tokens, Base UI, Motion, i18n + es/en parity) **and** e2e conventions
   (drive-the-real-app, audit/manifest, locators), corrected (header comments kept; es.json exists) +
   non-negotiables echo + Known-traps (frontend/e2e-relevant). Scoped `tools`; `isolation: worktree`.

3. **`plan-reviewer` agent.** Read-only; the design-plan checklist inverted into a critique checklist.

4. **`change-validator` agent + finish-plan wiring.** Add the agent (uses `test-functionality`,
   returns the evidence report); update `finish-plan` to validate through it and surface the PR link +
   live-test command.

5. **`build-feature` orchestrator skill.** The fixed pipeline incl. contract-first → parallel
   implement → merge → e2e, the approval pause, and the plan-reviewer/change-validator dispatch.
   Honest framing: sequencer, not a hard gate.

6. **`design-plan` skill update.** Tag each generated step with its area (shared/backend/frontend/e2e)
   so the orchestrator knows which worker to dispatch.

7. **Slim CLAUDE.md to the global router.** Rewrite to <~120 lines: app context, non-negotiables,
   commit/branch grammar, routing map, "tools are the gate". Remove everything relocated to a worker
   body; **remove the stale `.veto/architect.yaml` reference**.

8. **Delete project-rules.md + the mandatory audit.** Remove `docs/project-rules.md`; add
   `docs/conventions/README.md` pointer; walk the traceability map (Appendix) to confirm every old
   rule landed in a worker body, CLAUDE.md, or is enforced-by-tool; verify each `.veto/*.yaml` id maps
   to a worker-body heading and the non-negotiables echo matches CLAUDE.md; grep `.veto/*.yaml` for any
   stale CLAUDE.md path reference.

9. **Remove the plan (finish-plan).** `docs: remove claude-agent-workflow plan, complete`.

_Dogfood:_ the new agents/skills only take effect **after a Claude Code restart**, so the end-to-end
`/build-feature` dry-run happens in a fresh session, not as a commit in this plan.

## Design review — SRP, simplification, constraints (self-critique)

**Responsibilities are cohesive, not per-action.** `design-plan` plans; `plan-reviewer` critiques;
each engineer implements its area; `change-validator` proves; `finish-plan` closes out (multi-action,
one purpose); `build-feature` sequences. We do **not** shatter `finish-plan` into per-action skills,
and `review-plan` is **not** a separate skill — the orchestrator dispatches the reviewer directly
(4 skills, not 5).

**Simplifications taken:** convention prose has exactly one home (the worker body); the validator _is_
`test-functionality` behind an independence boundary; the reviewer inverts the design-plan checklist;
the orchestrator _calls_ existing skills; only four agents; e2e folded into `frontend-engineer` rather
than a fifth agent.

**Honest limits surfaced:** the orchestrator cannot be hook-enforced — "every phase, always" is a
sequencer guarantee, backed by what _is_ enforced (veto per commit, validator evidence in the PR).
Auto-delegation is heuristic, so the orchestrator invokes workers explicitly. Parallel writers need
`isolation: worktree` + a merge; the contract-first/e2e-last sequencing keeps the parallel window free
of shared files. New agents/skills require a restart to load.

## Constraints

- **No rule silently dropped** — only relocated to a worker body, CLAUDE.md, or marked
  enforced-by-tool. The Appendix map is the proof; step 8's audit verifies it.
- **Do not weaken enforcement.** `.veto/`, `eslint/`, `.husky/` unchanged.
- **Resolve contradictions toward reality** (header comments kept; es.json exists; pre-commit steps
  `check-commit-size → lint-staged → veto` and veto filenames `backend.yaml`/`frontend.yaml`
  corrected; FILE.md and its hook are gone — never reintroduced).
- **One canonical home per rule**; everywhere else points. The veto subset and the non-negotiables
  echo are the only sanctioned duplications, kept honest by the mandatory audit.
- **No new dependencies.** `.claude/` + `docs/` only.
- **One plan, one branch.** `chore/claude-agent-workflow` (this worktree, branched off `origin/main`).

## Decisions (resolved)

1. `docs/project-rules.md` → **deleted**; `docs/conventions/README.md` pointer replaces it.
2. Orchestrator skill → **added** (`build-feature`), framed as a sequencer, not a hard gate.
3. Fast path → **none**; every change runs every phase.
4. Knowledge home → **the worker agent body** (corrected from docs/ for reliability; probe-driven),
   readable reference prose; veto is the separate enforced subset; **global** rules live in CLAUDE.md
   with a short audited echo in each worker body.
5. Parallelism → **kept** (your explicit request): contract-first → backend ∥ frontend in isolated
   worktrees → merge → e2e. Reviewer dissent recorded; sequential fallback is trivial.
6. Single source of truth → **one canonical home per rule + a mandatory (non-optional) audit**.

## Appendix — traceability map (old CLAUDE.md / project-rules.md → destination)

| Current section                                                             | Destination                                                          |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| What the app is                                                             | CLAUDE.md (global)                                                   |
| Workflow loop / plan-first / slicing                                        | CLAUDE.md router + build-feature + design-plan                       |
| Worktrees & parallel work                                                   | CLAUDE.md non-negotiables + engineer bodies (worktree trap)          |
| Working agreement (DoD, minimal diff, no escape hatches, never game a rule) | CLAUDE.md non-negotiables (+ echo in worker bodies)                  |
| Commit-size budget                                                          | backend-engineer body (detail) + CLAUDE.md (the rule)                |
| Architecture (layers, CQS, Result, repositories, layout)                    | backend-engineer body                                                |
| Code structure (Data/Calc/Action)                                           | backend-engineer body                                                |
| Code style + size/complexity + layer boundaries                             | backend-engineer body (+ "enforced by lint")                         |
| Frontend (component types, hooks, ports/adapters)                           | frontend-engineer body                                               |
| Styling & tokens / Animation / Base UI / Translation                        | frontend-engineer body                                               |
| Testing                                                                     | backend-engineer + frontend-engineer bodies                          |
| End-to-end testing (+ audit)                                                | frontend-engineer body                                               |
| Tooling & enforcement                                                       | backend-engineer body (reference) + CLAUDE.md ("tools are the gate") |
| Commits & branches                                                          | CLAUDE.md (grammar) — commit-msg hook enforces                       |
