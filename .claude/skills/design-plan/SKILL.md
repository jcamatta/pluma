---
name: design-plan
description: Design an implementation plan for a feature and write it to docs/plans/ — sliced into small, independently committable steps split by layer/concern and sized to the commit budget, ready for the user to review before any code is written. Use when the user describes a feature or change to build, says "plan this", "write a plan", "let's design X", or otherwise asks for a plan before implementation.
---

# Design an implementation plan

This skill produces the **plan** that opens our workflow: plan → the user reviews the plan → one branch per plan → mini-commits (each triggers the `veto` reviewer) → `finish-plan`. You write the plan and hand it back for review. **Do not write feature code in this skill, and do not start implementing** — the plan must be approved first.

The output is a single file in `docs/plans/`, sliced so each step is one small, green, independently reviewable commit.

## 0. Understand before slicing

Read enough to plan against reality, not a guess:

- Restate the feature in one or two sentences and confirm the scope with the user if it's ambiguous. **Do not invent business behavior** — if a rule isn't explicit in the request or the code, ask before baking it into the plan (per the working agreement).
- Look at the code the feature touches and the worked references: the explorer feature (`src/renderer/src/explorer/`) for the renderer port/adapter/hook pattern, and an existing `application/<feature>/` for the backend layout. Match the established shape; don't introduce a new one.
- Note the constraints that will bound the steps: no new dependencies without approval, hexagonal layering (IPC → application; adapters at the edge), CQS (commands vs queries on separate use cases/ports), the IPC `Result` boundary, design tokens + Base UI + Motion + `t()` for UI, and the e2e coverage audit (a new user-facing feature or IPC channel needs a manifest id + real-app spec in the _same_ step that ships it).

## 1. Slice the work

Two forces shape every cut: **architecture** and the **commit-size budget**. Apply both.

- **Split by concern / layer — never mix them in one step.** Keep shared contracts, backend, frontend, dependencies, and infrastructure/testing in their own steps. The natural order follows the dependency direction, so each step lands green on what came before:
  1. **Shared types / IPC contract** the rest depends on.
  2. **Backend**, inner-to-outer: `data` → `error` → `port` → `usecase` (+ its `__tests__`) → `adapter` (+ its `__tests__`) → `ipc` endpoint + registration.
  3. **Renderer**, inner-to-outer: `port` → `window.api` adapter + in-memory fake → query-key helper → hooks (query / command, each with tests) → `*.view.tsx` → `*.controller.tsx`, with `en.json` keys alongside the UI that uses them.
  4. **e2e**: the manifest id(s) + the real-app `*.e2e.ts` spec.

  Not every feature needs every role — create a step only where there's something to put in it.

- **Size every step to one mini-commit.** Each step must fit the budget: **≤ ~300 weighted `src/` lines** (added + deleted), **≤ 15 source files**, and **code over 30 lines lands with a test file**. Only `src/` carries weight; docs/config/`e2e/` are weight 0. If a step would exceed the budget, split it further — a fat step is a planning failure, not something to push through. Smaller steps also let the `veto` reviewer judge each commit sharply, so err toward more, smaller steps.

- **Each step is independently committable and independently green.** A reviewer can read it alone, and `lint` / `test` / `type-coverage` / `build` pass at that point in the sequence. Order the steps so this always holds — a step never depends on a later one.

- **The final step removes the plan.** End the sequence with the plan's own deletion as a separate `docs:` commit (the `finish-plan` skill performs this). Note it as the last step.

## 2. Write the plan file

Create `docs/plans/<name>.md` (kebab-case, descriptive — e.g. `chat-panel.md`, `thread-history.md`). Structure:

- **Title + one-paragraph summary** — the feature in product terms.
- **Done** — a concrete definition of "done": what the user can do when it's shipped, and which checks/e2e must be green.
- **Steps** — the sliced sequence from step 1, numbered. For each step: the files it adds/changes (by repo-relative path and role), what it delivers, and the tests it lands with. Keep each step's prose to what it delivers and why a decision was made — not editing mechanics.
- **Constraints** — the layering/CQS/`Result`/tokens/no-new-deps bounds that apply, and any feature-specific invariants.
- **Open questions** — anything unsettled. Mark each `SETTLED`/open as it's resolved; an open question blocks the steps that depend on it.

Do not pre-list unbuilt e2e manifest ids except inside the step that ships them — adding a manifest id without its spec turns the audit red.

## 3. Branch (only if the user is ready to start)

Per the workflow, **one plan = one branch**, regardless of type or size. Branch names follow Conventional Branch: `<type>/<description>` where `type` is `feat` / `fix` / `hotfix` / `release` / `chore`, description lowercase-hyphenated (e.g. `feat/thread-history`). Create the branch **before** the first implementation commit.

If you are already on a correctly-named non-trunk branch for this work, stay on it. If you're on a trunk branch (`main`/`master`/`develop`), create the branch now — but **only commit the plan once the user has reviewed it** (next step). Do not start feature work.

## 4. Hand the plan back for review

Show the user the plan (path + the sliced steps). **Stop here.** The user reviews and approves the plan before any code is written — that is step 2 of the workflow. Do not begin implementing steps until they say go.

When approved, the plan file is committed (on its branch) and execution proceeds one step / one mini-commit at a time, each commit passing the `veto` gate, until `finish-plan` closes it out.
