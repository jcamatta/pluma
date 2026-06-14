# Pluma — how this project is built

Pluma is an AI-assisted desktop writing app ("VS Code for writers"), built on Electron + React, with a
hexagonal (ports & adapters) main process written in Effect. This file is the **global router**: it
holds what every change must respect and where the detailed rules live. It is deliberately thin.

## Where the rules live (don't restate them here)

Detailed "how we code" rules are **not** in this file — they live where they are reliably loaded:

- **Backend conventions** (hexagonal layers, CQS, the IPC `Result` boundary, tagged errors,
  repositories, Effect, Data/Calc/Action, code style/limits, backend testing) → the
  **`backend-engineer`** agent body (`.claude/agents/backend-engineer.md`).
- **Frontend + e2e conventions** (component view/controller/plain split, query/command hooks, renderer
  ports/adapters, design tokens, Base UI, Motion, i18n, frontend testing, drive-the-real-app e2e + the
  coverage audit) → the **`frontend-engineer`** agent body (`.claude/agents/frontend-engineer.md`).
- The **mechanically-judgeable subset** of those rules is enforced by **veto** (`.veto/backend.yaml`,
  `.veto/frontend.yaml`) — terse, doc-blind, the reviewer's copy.
- A human entry point to the above is `docs/conventions/README.md`.

Each rule has **one canonical home**; everywhere else only points to it. Don't copy convention prose
into this file.

## The real gate (configs, not prose)

What actually judges a change — satisfy these with correct code, never route around them:

- **ESLint** (`eslint/`) — functional style, type-safety escape-hatch bans, layer boundaries,
  view/controller bans, size/complexity limits.
- **type-coverage** (`type-coverage --strict`, 95%) and **test coverage** (Vitest, 80%).
- **husky hooks** — `pre-commit`: `check-commit-size → lint-staged → veto`; `pre-push`:
  `test:coverage → type-coverage → build`. `commit-msg`: Conventional Commit + Conventional Branch,
  rejects trunk-branch commits and any attribution footer.
- **veto** (`npx veto .veto/ --staged`) — the semantic reviewer (`.veto/backend.yaml` +
  `.veto/frontend.yaml`); runs last at pre-commit. If it blocks, read `.veto/runs/latest.md`, fix the
  code, recommit.

## Non-negotiables a tool can't fully enforce

These bind every agent (the worker bodies echo them, because a subagent may not load this file):

- **Work on a branch; never commit on a trunk branch** (`main`/`master`/`develop`); **never merge a
  PR** yourself.
- **Never weaken, dodge, or game a check.** No `eslint-disable` / `@ts-ignore` / `@ts-expect-error` /
  `@ts-nocheck`, no `as` casts (except `as const`), no non-null `!`. Fix the underlying code or stop
  and ask — a check is satisfied by correct code, not made to disappear.
- **Minimal diff / YAGNI.** Change only what the task requires; smallest implementation that satisfies
  it; don't reformat/rename/refactor unrelated code. **Don't invent business behavior** — if a rule
  isn't explicit in the code or request, ask.
- **No new dependencies** without approval; justify any you propose.
- **Both locales.** Any user-facing key lands in `en.json` **and** `es.json` (a parity test enforces
  it).
- **No authorship/attribution metadata** in commits or PRs — no `Co-authored-by`, `Signed-off-by`,
  "Generated with", "Claude", AI mentions, or emoji.
- **Assume parallel agents.** Many worktrees run at once; the tree can change under you. Keep your diff
  to your task's files; if another agent's in-progress work touches a file you need, stop and ask. A
  full-suite failure may be another agent's work — verify by running only the files you touched.
- **Stay current with `main`.** Before opening a PR (or when a branch has been alive a while), rebase
  onto the latest `main`; resolve conflicts, re-run checks, push again.

## How we work — plan, then execute one small piece at a time

Every change runs the **full pipeline, every time** (no fast path). The **`build-feature`** skill is
the orchestrator that sequences it:

1. **Design** (`design-plan` skill) — write the plan to `docs/plans/<name>.md`, sliced into small
   steps each tagged `[shared]`/`[backend]`/`[frontend]`/`[e2e]`. Plans hold only _active_ work; a
   completed plan is deleted in its own `docs:` commit.
2. **Approval** — the human reviews and approves the plan before any code.
3. **Independent review** (`plan-reviewer` agent) — a fresh agent critiques the plan; fold it in.
4. **Implement** — one plan = one branch. Dispatch **`backend-engineer`** (`src/main`, `src/shared`
   contract first) and **`frontend-engineer`** (`src/renderer`, `e2e`) by step area; contract first,
   then backend ∥ frontend (parallel when disjoint), then e2e. The **orchestrator owns all git**
   (branch, commits, merges, PR); the engineer agents only write code. Each commit passes veto.
5. **Finish** (`finish-plan` skill) — validate via the independent **`change-validator`** agent, run
   the checks, delete the plan, push, open the PR (validator evidence in the body), and hand back the
   PR link + a `cd <worktree> && npm start` live-test command. The human reviews and approves — never
   self-merge.

Orchestration is a **sequencer, not a hard gate**: the enforcement is veto/hooks per commit plus the
validator's evidence in the PR. New agents/skills load only after a Claude Code restart.

### Commit-size budget (enforced at pre-commit)

`.husky/check-commit-size.sh` rejects oversized commits — treat it like a lint rule, split don't
route around: **≤300 weighted `src/` lines**, **≤15 source files**, and a commit over **30 source
lines must change a test file**. Only `src/` carries weight; `docs/`, config, `e2e/`, snapshots are
weight 0. `*.test.*`/`*.spec.*`/`*.e2e.*`/`__tests__` count as tests, not weight.

### Commits & branches

Conventional Commits: `<type>(<scope>): <description>` — imperative, lowercase, no trailing period,
`!` for breaking; types `build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test`. Conventional
Branch: `<type>/<description>`, `type` ∈ `feat|fix|hotfix|release|chore`, lowercase-hyphenated. The
`commit-msg` hook enforces both and bans attribution footers.

## Definition of done

`npm run lint`, `npm run test` (includes the e2e coverage audit), `npm run type-coverage`, and
`npm run build` all green — run them and report them green before calling a task done. For UI changes
also `npm run test:e2e`. Never run `npm start` in a hook or skill — it doesn't exit.
