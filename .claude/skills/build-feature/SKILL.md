---
name: build-feature
description: Run a change end to end through Pluma's full pipeline — design a plan, get the human's approval, have it independently reviewed, implement it (contract first, then backend and frontend by their worker agents), and finish it (independent validation, plan deletion, push, PR, live-test command). Use when the user asks to build, add, or change a feature and wants the whole workflow driven for them.
---

# Build a feature, end to end

This is the **orchestrator** for Pluma's workflow. It sequences every phase so none is skipped. Be
honest about what that means: this is a **sequencer, not a hard gate** — no hook can prove a phase
ran. What is mechanically enforced is `veto` on every `src/` commit, the husky hooks, and the
validator's evidence in the PR. Your job is to run all phases in order and not cut corners.

You run on the main thread (you have the Agent and Skill tools). You **dispatch worker subagents
explicitly** — auto-delegation is heuristic and unreliable, so always name the agent.

> Note: subagents and skills load at Claude Code startup. If `build-feature`, the engineer agents, the
> `plan-reviewer`, or `change-validator` were just added and aren't in the agent/skill list yet, tell
> the user to restart Claude Code, or run the phases by hand using the same sequence below.

## Phase 1 — Design (no fast path)

Invoke the **`design-plan`** skill for the user's request. It writes `docs/plans/<name>.md`, sliced
into small steps each **tagged with its area** — `[shared]`, `[backend]`, `[frontend]`, or `[e2e]`.
**Stop and show the user the plan.**

## Phase 2 — Approval (gate)

Wait for the human to approve. Do not proceed to review or code until they say go. If they request
changes, revise the plan and re-show it.

## Phase 3 — Independent review

Dispatch the **`plan-reviewer`** subagent (Agent tool), passing the plan path. It returns a critique
(missed constraints, single-responsibility-vs-action, over-complication, simplification, out-of-box)
with a verdict. Fold the actionable findings into the plan. If the plan changed materially, show the
user the revised plan again before implementing. Surface any reviewer point that conflicts with a
decision the user already made — let them decide, don't override silently.

## Phase 4 — Implement

Create the branch (one plan = one branch; `<type>/<description>`) if not already on it, then commit
the approved plan. Implement **by area tag**, in dependency order. Each commit passes `veto`
(`.veto/backend.yaml` for `src/main`, `.veto/frontend.yaml` for `src/renderer`); if veto blocks, read
`.veto/runs/latest.md`, fix the code, recommit — never route around it.

1. **`[shared]` contract first (sequential).** Dispatch **`backend-engineer`** for the `src/shared`
   IPC types and error `_tag`s. Fixing the contract up front is what lets the two sides build without
   seeing each other's code.
2. **`[backend]` ∥ `[frontend]` (parallel, optional optimization).** When the change has disjoint
   backend and frontend work, dispatch **`backend-engineer`** (for `[backend]` steps, `src/main`) and
   **`frontend-engineer`** (for `[frontend]` steps, `src/renderer`) **at the same time**, each with
   `isolation: 'worktree'` so their commits never race on one index. Pass each: the plan path, its
   step(s), the contract, and a summary of prior results. Then **merge** both worktrees' commits onto
   the plan branch — the trees are disjoint (`src/main` vs `src/renderer`), so the merge is clean.
   - **Sequential fallback:** for a single-area change, or if the worktree-merge proves unreliable,
     just run the steps in order (`[backend]` then `[frontend]`) on the one branch — same steps, no
     `isolation`, zero correctness cost. Prefer this when in doubt.
3. **`[e2e]` last (sequential).** Dispatch **`frontend-engineer`** for the real-app spec and the
   `coverage-manifest.ts` id(s), after both sides are wired and merged — so the manifest is never
   edited by two workers at once.

Keep each worker's diff to its own files. If two steps would touch the same file, sequence them.

## Phase 5 — Finish

Invoke the **`finish-plan`** skill. It runs the definition-of-done checks, **validates the change
through the independent `change-validator` agent**, deletes the completed plan (its own `docs:`
commit), pushes the branch, opens the PR with the validator's evidence in the body, and returns the
user the **PR link** plus a **`cd <worktree> && npm start`** live-test command. Do not merge the PR —
the human reviews and approves.

## What you guarantee

Every phase runs, every time — design, approval, independent review, implement, independent
validation, finish. Parallelism only speeds Phase 4 when work is disjoint; it never skips a phase.
