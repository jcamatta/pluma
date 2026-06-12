## How we work

Build features the same way every time: **plan first, then execute the plan one small piece at a time.**

### The workflow, end to end

Every change — small or large, `feat` or `fix` — follows the same loop:

1. **Plan.** Write the plan in `docs/plans/` (see "Plan first").
2. **The human reviews the plan** and approves it before any code is written. Do not start implementing until the plan is approved.
3. **The plan gets its own branch.** One plan, one branch — regardless of size or type (`feat`, `fix`, `chore`, `docs`, `test`, …). Create the branch before starting (see "Commits" for the branch grammar).
4. **Subdivide the plan into mini-commits.** Each step is one small, coherent commit that stays under the commit-size budget and leaves the checks green. Small commits are not just about the budget — they are **far easier for the `veto` reviewer to judge**, so prefer more, smaller commits over fewer big ones.
5. **Each commit triggers the `veto` reviewer** (the pre-commit gate). Fix what it flags before moving on (see "Reviewer gate").
6. **When every step is done,** run the `finish-plan` skill — it runs the checks, proves the change works, removes the completed plan file, pushes the branch, and opens the PR.
7. **The human reviews the PR on GitHub** and decides: merge, or leave comments / request changes. Never merge it yourself.

### Worktrees and parallel work

**We work in git worktrees, and multiple agents may be working in parallel at the same time.** Always assume another agent is changing the tree underneath you:

- Keep your diff confined to your own plan's files so two streams never collide. If another agent's in-progress work touches a file you need, **stop and ask the human** rather than editing around them or reverting their work.
- `git status` captured at session start can be stale — re-check before relying on it. A full-suite failure may come from another agent's work, not yours; verify by running only the files you touched.
- **Stay up to date with `main`.** Before opening a PR (and whenever your branch has been alive a while), pull the latest `main` and **rebase your branch onto it** so you are always building on current code. A branch that sits for a long time will drift.
- **Assume a PR can develop merge conflicts** after it has been open for a while, because parallel work lands on `main` in the meantime. When that happens, rebase onto the latest `main`, resolve the conflicts, re-run the checks, and push again. Do not merge with unresolved drift.

### Plan first

Before writing code for a feature, write a plan. The plan exists to split a big feature into **small, independently committable units** — small enough to pass the commit-size budget (see below), each one ending with the checks green. We do not implement a feature in one large change; we slice it.

- **Plans live in `docs/plans/`,** one file per feature (e.g. `04-chat-panel.md`, `agent-architecture.md`). A plan names the feature, states what "done" looks like, lists the sequenced steps, and records the constraints and open questions.
- A plan's steps are the unit of work. Each step is sized so its commit fits the budget and leaves every check passing.

**How to slice a plan.** Two forces shape the cut: the architecture and the commit-size budget.

- **Separate by concern / layer.** Keep backend, frontend, dependencies, and infrastructure/testing in their own steps rather than mixing them in one commit. A natural ordering follows the dependency direction: shared types/contracts → backend (data → port → use case → adapter → IPC) → renderer (port → adapter → hooks → view/controller) → e2e. Each step depends only on what came before, so it lands green on its own.
- **Size every step to one mini-commit.** A step must fit the commit-size budget (max ~300 weighted `src/` lines, ≤15 source files, tests landing with code). If a step would blow the budget, that is a planning signal — split it further, don't write a fat commit. **Smaller commits also make the `veto` reviewer's job easier and its judgments sharper**, so err toward more, smaller steps.
- Each step should be **independently committable and independently green** — a reviewer can read it in isolation and the checks pass at that point in the sequence.

### Then execute, and record what you did

As you complete a step, **mark it done in its plan file and write a short note of what landed** — which files, which decisions, what is still open — so the next agent can pick up from there with the whole context **without re-reading the codebase and guessing.** The plan is the running handoff record. Keep the "what's next" pointer accurate.

Write these notes as functional progress: what the step delivered and why a decision was made. Do not narrate the mechanics of editing. Git already tracks the diff.

### When a plan is done, delete it

`docs/plans/` holds only **active** plans. When a plan is complete — every step checked off, all its work shipped (checks green, e2e where required), nothing left for anyone to pick up — **delete the plan file.** This keeps the folder a short list of what's in flight rather than an ever-growing archive. A half-done plan with deferred items is not done; it stays.

The history is not lost: a removed plan lives forever in git (`git log -- docs/plans/<name>.md` to read it back). Do the deletion as **its own small `docs:` commit** ("remove plan X, complete"), not folded into the last feature commit, so the timeline reads cleanly. (`docs/` is weight 0, so this never touches the commit-size budget.)

### Commit-size budget (enforced, like ESLint)

A pre-commit hook (`.husky/check-commit-size.sh`) rejects commits that are too large, so changes stay small and reviewable. Treat it as a hard rule on the same footing as a lint rule — **do not route around it; split the work instead** (this is exactly why we plan in small steps). The budget:

- **Max 300 weighted source lines** (added + deleted) per commit.
- **Max 15 source files** touched per commit.
- **A commit over 30 source lines must change at least one test file** — code and its tests land together.

**Only files under `src/` carry weight.** Everything outside `src/` — `docs/` (including the plans), config, scripts, the `e2e/` harness, lockfiles, snapshots, generated files — counts as weight 0, so updating docs/plans alongside code never pushes a commit over the budget. Within `src/`, `*.test.*` / `*.spec.*` / `*.e2e.*` / `__tests__` count as tests (they satisfy the "needs tests" check but do not add weight). If a commit trips the hook, the answer is never to weaken the hook — it is to make a smaller, coherent commit.

## General rules

Prefer the smallest implementation that satisfies the current requirement. Follow YAGNI.

Do not invent business behavior. If a business rule is not explicit in the code or request, ask before implementing it.

### Working agreement

- **Definition of done.** A task is done only when `npm run lint`, `npm run test`, `npm run type-coverage`, and `npm run build` all pass. Run them yourself and report them green before saying a task is complete. Never declare something finished without the checks passing. `npm run test` includes the **e2e coverage audit** (see "End-to-end testing"), so a new UI feature or IPC channel is not done until the manifest and its real-app spec exist. For any task that ships or changes user-facing UI, also run `npm run test:e2e` (the real desktop-app suite) and report it green — it is the gate for UI work even though, being slow, it is not in the pre-push hook.
- **Minimal diff.** Change only what the task requires. Do not reformat, rename, or refactor unrelated code, and do not touch files outside the scope of the request.
- **Never weaken the checks to pass.** Do not delete or skip tests, loosen an assertion, lower a coverage threshold, or relax a lint rule to make a build go green. If a check fails, fix the cause. If a rule genuinely needs to change, stop and ask.
- **No new dependencies without approval.** Do not add a runtime or dev dependency without asking first, and justify why each one is needed. This is the counterpart to YAGNI.
- **Assume another agent may be working in parallel.** The working tree may contain uncommitted changes you did not make, and files may change underneath you mid-task. Because of this: (1) never commit unless the human explicitly asks; (2) `git status` reported at session start can be stale — re-check before relying on it; (3) a full-suite failure may come from another agent's in-progress work, not your change — verify by running only the files you touched before assuming you broke something; (4) **if another agent's in-progress work affects a file you need to change, stop and ask the human to decide** rather than editing around them or reverting their work; (5) keep your diff confined to your own task's files so the two streams don't collide.
- **No escape hatches.** Do not silence the tools: no `eslint-disable` / `eslint-disable-next-line`, no `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`, no `as` casts (except `as const`), no non-null `!`. These are lint errors. If the types or rules are fighting you, fix the underlying code or ask.
- **Never hack, dodge, or game a rule. No rule may be circumvented — it is strictly forbidden, on penalty of death.** A check exists to be satisfied by correct code, not routed around. When a lint or type rule blocks you, the only acceptable responses are (1) fix the underlying code so the rule passes honestly, or (2) stop and ask the human to change the rule. You may **never** find a clever way to make the error disappear while leaving the problem in place. This applies to you and to every sub-agent you spawn; pass this rule on to them.

  This is broader than the escape hatches above. The following are all forbidden "hacks", even though none of them is an `eslint-disable` or a cast:
  - **Type-dodging through permissive APIs.** Using a loosely-typed function purely to bypass a type error instead of fixing the types. Example: writing `Object.assign(window, { api })` because `window.api = api` does not type-check — that hides the missing type instead of declaring it. Fix the types (e.g. the ambient `Window` declaration) so the direct, fully-checked assignment compiles.
  - **Weakening a rule's options.** Loosening a rule's configuration to let your code through — e.g. switching `ban-ts-comment` from banning `@ts-ignore` to `allow-with-description`, lowering a coverage threshold, raising a complexity/size limit, or adding an `allow` entry. Rule config is tightened by the human on request, never loosened by an agent to pass.
  - **Scoping a file out of a ban.** Adding a file/glob to a rule's `ignores`, or creating an override block that turns a rule off for the file you are editing, so your violation stops being reported. The one sanctioned exception in this codebase is `src/shared/invariant.ts` for the throw ban, which the human approved; do not create new carve-outs.
  - **Renaming/relocating to escape a rule**, restructuring code solely to fall outside a selector, or any other maneuver whose only purpose is to make the tool stop complaining rather than to make the code correct.

  If you are unsure whether a fix is "honest" or a "hack", ask yourself: _after this change, is the thing the rule was protecting against actually gone, or just unreported?_ If it is merely unreported, it is a hack — do not do it. When in doubt, stop and ask.

## Architecture

We follow **hexagonal architecture** (ports and adapters) and **functional programming with [Effect](https://effect.website)**.

### Layers

There is **no separate domain layer**. Business types, pure logic (calculations), and typed errors live in the **application** layer alongside the use cases that own them.

- **Application** — use cases plus the business types, pure logic, and typed errors they own. A use case orchestrates this logic and depends only on **ports** (interfaces), never on concrete adapters. Use cases are written in Effect.
- **Adapters** — concrete implementations of ports (filesystem, persistence, OS, external services). The application depends on the port; the adapter is wired in at the edge.
- **IPC** — the endpoints. Each endpoint calls an application use case. This is the boundary where Effect is executed and the outcome is serialized.

Dependencies point inward: IPC → application. The application defines ports; adapters implement them; nothing inner imports anything outer.

### Commands and queries

We separate use cases into two kinds, and keep read and write paths apart.

- **CQS (Command–Query Separation, at the method level).** A method either returns data (a **query** — no side effects) or changes state (a **command** — returns `void`/an ack). Never both. This is almost free and almost always worth it.
- **Lightweight CQRS (same store).** We split the read and write paths — query use cases vs command use cases, as distinct objects — over the **same** underlying store. This is not separate databases; it is separate paths against one. The frontend already does the same with `useQuery`/`useMutation` in the [hooks](#hooks-commands-and-queries).

So a use case is either a **command** (mutates; e.g. `create-file`, `delete-folder`) or a **query** (reads; e.g. `list-folder`). Keep them as separate use cases and, where it helps, separate ports — e.g. a `FolderWriter` port for commands and a `FolderReader` port for queries, rather than one port that both reads and writes.

### Target folder layout

As the app grows, place code as follows (create folders as needed):

- `src/main/application/` — use cases, the business types/pure logic/typed errors they own, and the port interfaces they depend on
- `src/main/adapters/` — port implementations
- `src/main/ipc/` — IPC endpoints that invoke use cases

Group a feature's files together under the application layer (e.g. `application/file/`), and split that feature folder by role:

- `usecase/` — the use cases (e.g. `usecase/create-file.ts`), with their tests under `usecase/__tests__/`.
- `port/` — the port interfaces the use cases depend on (e.g. `port/file-writer.port.ts`).
- `logic/` — pure logic / calculations shared by the use cases (e.g. `logic/validate-markdown-path.ts`).
- `data/` — the feature's plain **Data** types: domain facts modeled as records with no behavior (e.g. `data/entry.ts` exporting `FolderEntry`). These are not value objects — they carry no methods; any operation over them is a calculation in `logic/`. Use this for the business types that cross the IPC boundary.
- `error/` — the feature's typed errors (e.g. `error/file-not-found.ts`).

This keeps the application concerns visibly distinct: use cases orchestrate, ports declare the contracts they need, `logic/` holds the pure calculations they reuse, and `data/` holds the plain domain types they operate on. Create a role folder only when the feature has something to put in it; a feature with a single use case and no shared logic does not need every folder up front.

**Ports** are interfaces a use case depends on. Name the file `*.port.ts` and the interface with a `Port` suffix (e.g. `port/file-writer.port.ts` exporting `FileWriterPort`). The Effect `Context` tag for the port may keep a plain service name (e.g. `FileWriter`).

**Tests** live in a `__tests__/` folder next to the code they cover (e.g. `application/file/usecase/__tests__/create-file.test.ts`), not as siblings of the source file.

### Result at the IPC boundary

Use cases work in Effect, carrying typed errors in the error channel. Effect types do **not** cross IPC. Each IPC endpoint runs its use case and serializes the outcome into a plain discriminated union:

```ts
type Result<T, E extends { _tag: string }> = { ok: true; value: T } | { ok: false; error: E }
```

Every endpoint returns a `Result`. Never throw across the IPC boundary; convert the Effect's success/failure into `ok: true | false`.

**Every error value carries a discriminating tag.** The `error` in `ok: false` is never a free-form string — it is a typed object with a `_tag` (or `code`) that identifies the failure, plus any data needed to render it. For example: `{ _tag: 'NoteNotFound'; id: string }`. This lets the frontend map each tag to a translated message; the backend never sends user-facing prose. Define these errors as Effect tagged errors (e.g. `Data.TaggedError`) in the application layer, and serialize the tag and its fields into the `Result`.

### Repositories

Persistence is accessed through the **Repository pattern**, expressed as a port.

- The **repository port** lives in the application layer and exposes **collection-like operations** over a domain entity — think of it as an in-memory set, not a database API. Typical operations: `add`, `remove`, `contains`, `getById`, `all`, and `findBy` criteria. Avoid leaking SQL, table names, or query language into the port.
- The **repository adapter** lives in the adapters layer, implements the port, and is the only place that touches the database.
- Use cases depend on the repository port, never on a concrete adapter.
- For tests, provide an **in-memory repository** that implements the same port (e.g. backed by a `Map`). Use-case tests run against it — no real database.

The concrete database is not chosen yet; keep the port database-agnostic so the adapter can change without touching the application.

## Code structure

Classify code into three categories (per _Grokking Simplicity_, Eric Normand):

- **Data** — plain values and records with no behavior. Prefer for modeling domain facts and for passing information across boundaries (IPC, props, JSON).
- **Calculations** — pure functions: the same input always produces the same output, with no side effects. Put business logic and transformations here. They are trivial to test and safe to call anywhere.
- **Actions** — anything that depends on _when_ or _how many times_ it runs: I/O, mutation, network, the filesystem, `Date.now()`, randomness, Electron IPC, React effects. Keep these at the edges and as thin as possible.

Default to calculations. When you must write an action, extract its logic into a calculation that the action calls, so the testable part stays pure. Do not bury business rules inside actions or React components.

In Effect terms: actions live in the Effect runtime (ports/adapters), calculations stay pure. Domain and application logic is mostly calculations over data.

## Code style

These rules are enforced with ESLint. Write code that already complies.

- **No `let`.** Use `const`. Model change through new values, recursion, or Effect, never reassignment.
- **No global mutable variables.** State is passed explicitly or held by Effect services.
- **One export per file.** This is the strong default. The only allowed exceptions are a type/interface co-located with the single export it describes, and barrel `index.ts` files that only re-export. Do not split these artificially.
- **One responsibility per file.** A file does one thing; if it grows a second concern, split it.
- **No inline comments.** Do not write comments in the middle of code — the code should read clearly on its own.
- **No file-header comments.** Do **not** start a file with a header comment explaining what it is about. A source file carries no prose about its own purpose; rely on clear naming and the plans to convey intent.

## Tooling and enforcement

The ESLint config is split by concern under `eslint/` and composed in `eslint.config.mjs` (prettier last, so it disables conflicting formatting rules). Each module owns one set of rules:

- `eslint/base.mjs` — global ignores (`node_modules`, `dist`, `out`, `coverage`, `.references`, HTML) plus the TypeScript and React recommended configs.
- `eslint/style.mjs` — the functional style and type-safety rules below. Exports `baseRestrictedSyntax`, the shared `no-restricted-syntax` selectors.
- `eslint/architecture.mjs` — hexagonal layer boundaries and the view/controller/plain component rules.
- `eslint/limits.mjs` — size and complexity limits.
- `eslint/comments.mjs` — bans ESLint disable directives.
- `eslint/effect.mjs` — Effect-specific rules.
- `eslint/react.mjs` — React hooks and fast-refresh rules.

Alongside ESLint, a **pre-commit commit-size hook** (`.husky/check-commit-size.sh`) is enforced — see "Commit-size budget" at the top. It is a hard gate just like a lint rule: never loosen its thresholds or exclude a file to slip a large commit through; split the commit instead.

### What each rule enforces

- **No `let` / no `var`** — `no-var`, `prefer-const`, and a `no-restricted-syntax` selector that bans `let`. _Why:_ reassignment hides state changes and breaks the functional model; model change with new values, recursion, or Effect. A second selector flags reassignment of outer-scope identifiers to discourage hidden mutable state.
- **No input mutation** — `no-param-reassign` (`props: true`). _Why:_ keeps "Data = plain values" honest: functions do not mutate their arguments.
- **No type-safety escape hatches** — `@typescript-eslint/ban-ts-comment` (no `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`), `@typescript-eslint/no-non-null-assertion` (no `x!`), and `no-restricted-syntax` selectors banning `x as T` (except `as const`) and `<T>x`. _Why:_ closes the hole that `no-explicit-any` and type-coverage leave — you can have 95% type-coverage and still lie with an `as`.
- **No disable directives** — `@eslint-community/eslint-comments/no-use` bans every ESLint directive comment (`eslint-disable`, `eslint-disable-next-line`, `eslint-enable`, …), and `reportUnusedDisableDirectives: 'error'` flags any dead ones. _Why:_ rules must not be silenced line by line. If a rule is wrong, change it in config; do not suppress it inline.
- **Export discipline** — `import-x/no-default-export` (prefer named exports) and `import-x/group-exports`. _Why:_ approximates "one export per file" / one responsibility per file. A true single-export rule does not exist as a built-in, so named-only is the enforceable proxy; entry points and config files are exempted.
- **Layer boundaries** — `import-x/no-restricted-paths`. _Why:_ enforces hexagonal dependencies. `application` may not import `adapters`/`ipc`; the renderer may not import `src/main` internals. Dependencies point inward only.
- **View / controller / plain enforcement** — `no-restricted-syntax`, scoped by filename. `*.view.tsx` may not call hooks (`use*`) or touch `window.api`. Plain components (any renderer `*.tsx` that is not a controller, view, or adapter) may not touch `window.api`. _Why:_ makes the component-type split mechanical — a view with a hook fails lint. Only controllers (through hooks) and renderer adapters may reach IPC.
- **Size and complexity limits** — `max-params` (2), `max-lines-per-function` (75), `max-lines` (250), `max-statements` (12), `max-depth` (3), `complexity` (8), `max-nested-callbacks` (3), `max-classes-per-file` (1). _Why:_ pushes toward small, single-purpose functions and files. `max-params` is 2 rather than 1 because Electron event callbacks (`(_, window)`) and array reducers (`(acc, item)`) need two; prefer one in your own functions.
- **No barrel imports of Effect** — `@effect/no-import-from-barrel-package` for `effect`, `@effect/platform`, `@effect/platform-node`. _Why:_ importing from the package barrel pulls in and defeats tree-shaking; import the specific module instead.

On top of the rules above, the config inherits several recommended rule sets, which are also enforced:

- **TypeScript** — `@electron-toolkit/eslint-config-ts` (the `@typescript-eslint` recommended set): no unused vars, no `any` (`no-explicit-any`), no floating promises, and the rest of the recommended TypeScript rules.
- **React** — `eslint-plugin-react` recommended + `jsx-runtime` (no need to import React in scope).
- **React Hooks** — `react-hooks/rules-of-hooks` (hooks only at the top level of components/hooks) and `react-hooks/exhaustive-deps` (effect/callback dependency arrays must be complete).
- **React Refresh** — `react-refresh/only-export-components` (a component file should export only components, for fast refresh). This aligns with the one-export discipline; for non-component renderer modules it is not a concern.
- **Prettier** — `@electron-toolkit/eslint-config-prettier` runs last and owns all formatting; formatting issues surface as lint warnings fixable with `prettier --write`.

`no-restricted-syntax` is not merged across overlapping flat-config blocks (the last matching block wins), so the scoped view/plain blocks spread in `baseRestrictedSyntax` to keep the global bans. When adding a selector for a scoped file set, spread `baseRestrictedSyntax` too.

The `@effect/eslint-plugin` `dprint` formatter rule is intentionally **not** enabled — formatting is owned by Prettier.

### Rules deliberately not yet enforced

These were considered and left out for now to avoid new dependencies or false-positive noise; they remain conventions until added:

- **No hardcoded UI strings** — would need `eslint-plugin-i18next` (`no-literal-string`). Until then, the "always use `t`" rule is enforced by review, not lint.
- **Deep data immutability** — `no-param-reassign` covers argument mutation, but enforcing readonly data structures would need `eslint-plugin-functional` (`immutable-data`).

### Test and type coverage

- `npm run test` / `npm run test:coverage` — Vitest. The backend runs in a `node` project, the renderer in a `jsdom` project. Coverage is gated at **80%** (lines, functions, branches, statements); dropping below fails the run.
- `npm run type-coverage` — `type-coverage --strict`, gated at **95%**. _Why:_ catches implicit/explicit `any` that the type system would otherwise let through.

### Git hooks (husky)

- **commit-msg**: refuses a commit made on a trunk branch (`main`/`master`/`develop`) or from a branch whose name is not a valid Conventional Branch name; validates the subject against Conventional Commits (type, optional scope/`!`, 1–100 char description); and rejects any authored/attribution footer — `Co-authored-by`, `Signed-off-by`, `Generated with`, and the like.
- **pre-commit**: `check-commit-size` → `lint-staged` (eslint --fix + prettier on staged files) → `veto` (the reviewer gate, see below).
- **pre-push** (heavy): `test:coverage` → `type-coverage` → `build`.

`start` (the Electron preview) is never run in a hook — it does not exit. Run it manually.

### Reviewer gate (veto)

The final pre-commit step runs `npx veto .veto/ --staged`: an LLM reviewer (`.veto/architect.yaml`) that judges the staged diff against the team's **semantic** rules — the architecture and working-agreement calls that pass ESLint but still break the design (layering, CQS, the IPC `Result` boundary, Effect-not-throw, actions-vs-calculations, the component-type split, design tokens, …). It deliberately does **not** re-litigate anything the linters and type-coverage already own; those run before it.

This gate is intentionally not fast, and that is fine — with an agent writing the code, the constraint is no longer cycle time but confidence that the change is correct, so a per-commit judgment review is time well spent. **If a commit is blocked by the reviewer, read `.veto/runs/latest.md` (or `latest.json`) for the findings, fix the underlying code, then commit again** — never route around the gate, exactly as with every other check.

## Frontend

The frontend mirrors the backend's ports-and-adapters approach so it is highly testable. Code lives under `src/renderer/src/`, organized **feature-first** (see below).

### Folder structure (feature-first)

Group renderer code **by feature, then by role** — the same shape the backend uses for `application/<feature>/...`. A feature owns everything it needs in one folder:

```
src/renderer/src/
  editor/                       ← a feature; owns its whole slice
    extensions/                 ← pure logic for this feature (with __tests__/)
    Editor.controller.tsx       ← role is in the filename suffix, not the folder
    Editor.view.tsx
    useManuscriptEditor.ts       ← the feature's hooks live with the feature
    useEditorZoom.ts
    editor-zoom-logic.ts         ← extracted pure calculations
    __tests__/
  components/                   ← ONLY genuinely cross-feature visual primitives
    Scrollable.tsx
  i18n/  App.css  App.tsx  main.tsx
```

Rules:

- **Feature folders, not role folders.** Do not create top-level `hooks/` or `components/` buckets for feature code — they become junk drawers as features multiply. A hook, view, controller, or pure module that belongs to one feature lives inside that feature's folder. Only things shared across features (a generic `Scrollable`, design-system wrappers) go in a top-level `components/`.
- **Role is encoded in the filename suffix** (`*.view.tsx`, `*.controller.tsx`, `*.ts`), which is what the eslint rules key off — so role folders add nothing.
- **`ports/` and `adapters/`** appear inside a feature only when it actually talks to `window.api` (e.g. an IPC-backed feature). A feature with no IPC (like the editor) needs neither. When a feature has a repository port, follow the port/adapter/context pattern below.

### Styling and design tokens

All styling uses the design tokens defined in `src/renderer/src/App.css`. **Never invent a new token, color, font, or one-off value.** If a token you need does not exist, stop and ask — do not add an ad-hoc value.

The only allowed tokens are those exposed by the `@theme inline` block in `App.css`:

- **Surface colors**: `surface-1`, `surface-2`, `surface-3`
- **Text colors**: `text-primary`, `text-secondary`, `text-muted`, `text-on-accent`
- **Action colors**: `action-primary`, `action-secondary`, `action-destructive`
- **Feedback colors**: `feedback-success`, `feedback-warning`, `feedback-error`, `feedback-info`
- **Structural**: `border`, `overlay`
- **Fonts**: `font-ui`, `font-editor`

Use them through the Tailwind utilities they generate (`bg-surface-2`, `text-text-muted`, `border-border`, `font-editor`, …) or via `var(--color-…)` in CSS. These tokens already adapt to light/dark; never hardcode a hex/oklch/rgb color in a component.

**No arbitrary or fractional values.** These are forbidden:

- Arbitrary values in brackets: `px-[3.5px]`, `w-[417px]`, `text-[13px]`, `bg-[#fff]`. Forbidden — there is always a token or a step on the scale to use instead.
- Fractional spacing steps: `px-3.5`, `gap-2.5`, `mt-1.5`. Forbidden — use a whole step (`px-3`, `px-4`).

Spacing, sizing, and radius come from the standard Tailwind scale in whole steps. If the design seems to need a value the scale and tokens cannot express, that is a signal to ask, not to reach for an arbitrary value.

### Component types

Every component is exactly one of three kinds, and the kind is visible in the filename:

- **View** — `*.view.tsx`. Pure layout. Receives everything through props; no hooks, no side effects. Testable by rendering with plain props.
- **Controller** — `*.controller.tsx`. Wires hooks (the side effects) to a view. Holds no layout of its own; it reads data/commands from hooks and passes them to its view.
- **Plain / visual** — `Name.tsx`. A self-contained visual component. May use `useState` only for local UI state (a dropdown's open/closed, a hover, etc.). No data fetching or mutations.

Example: `Editor.controller.tsx` owns the hooks, renders `Editor.view.tsx`; `Header.tsx` is a plain component.

A view must not call hooks or touch `window.api` (lint-enforced on `*.view.tsx`). When a view needs a value a hook would normally compute (a `useMemo`, a context value), the controller computes it and passes it as a prop, or the view inlines the plain expression — it never reaches for the hook.

### Module and export conventions

These apply to all renderer modules and are partly lint-enforced (`import-x/group-exports`, `no-restricted-syntax`):

- **Consolidate exports.** A module declares its symbols internally (no inline `export` keyword) and exposes them with a **single `export { … }`** and, if it has exported types, a **single `export type { … }`**, both at the bottom of the file. Scattering `export const`/`export function`/`export type` through the file fails `group-exports`. Prefer one export per file; when a cohesive module legitimately exposes several symbols (e.g. a ProseMirror extension plus its command functions and types), the bottom-of-file block is the way.
- **No module-level mutable state — ever, including "clever" workarounds.** A `let counter = 0` at module scope is banned; so is the `const ref = { n: 0 }; ref.n++` trick that only exists to satisfy lint. If you need sequential ids or accumulating state, **hold it in the relevant state container** (e.g. a ProseMirror plugin's `apply`-threaded state object), where it is a pure function of previous state → next state. Ids that an agent echoes back stay short and sequential (`r_1`, `a_1`, `p_1`); do not switch to UUIDs to dodge a counter.
- **`satisfies` is allowed; `as` is not.** `x satisfies T` is a checked assertion the compiler verifies — use it to constrain object/metadata literals (e.g. ProseMirror `setMeta` payloads). `x as T` overrides the checker and is banned (except `as const`). To read an `unknown` (e.g. `transaction.getMeta(...)`), write a small type-guard (`value is T`) — a pure, testable calculation — not a cast.
- **Extract pure calculations from hooks/actions.** Keep DOM/`localStorage`/event math out of the hook body: put it in a sibling `*-logic.ts` as pure functions the hook calls, so the logic is unit-testable without a DOM. (`editor-zoom-logic.ts` is the model.)
- **Custom CSS properties without a cast.** To set a CSS variable in a `style` prop, type the object as `CSSProperties & { '--my-var': T }` rather than casting to `CSSProperties`.

### Hooks: commands and queries

All renderer data access goes through **TanStack Query** (`@tanstack/react-query`, already a dependency). Never hand-roll fetching/caching with `useState` + `useEffect` over `window.api`; a `useEffect` that calls a port and stuffs the result into state is a query written the wrong way — use `useQuery`/`useQueries`. The `QueryClient` is provided once at the app root.

This is **CQS in the renderer**: a hook is either a query or a command, never both. They are **separate hooks with separate exports** — do not return a `useQuery` and a `useMutation` from one hook. Reads and writes stay on distinct paths against the same store, mirroring the backend's command/query use-case split.

Hooks come in two kinds, one export each:

- **Query** — reads/fetches data. Wraps `useQuery`/`useQueries` (TanStack Query); its `data` is a `Result<T, E>`, and the UI branches on `data.ok`. Side-effect-free. Examples: `useNotes`, the explorer's `useFolderListings`.
- **Command** — performs a mutation. Wraps `useMutation`; the result is a `Result`, and it **invalidates the affected query keys** when it returns `ok: true` (never on `ok: false`). Examples: `useAddNote`, the explorer's `useCreateEntry` / `useDeleteEntry`.

**Query keys** are a per-resource tuple from one shared pure helper so the query hook and every command that invalidates it agree on the same key (e.g. the explorer's `folderListingKey(path)` → `['folder', path]`). Do not inline ad-hoc key arrays at call sites.

A hook never talks to Electron directly. It obtains a **repository port** and calls it. The explorer feature (`src/renderer/src/explorer/`) is the worked reference for this whole section: reader/writer ports split by CQS, an IPC adapter, `RepositoriesProvider`/`useRepos`, query + command hooks, and an in-memory fake in tests.

### Ports and adapters in the renderer

- A **repository port** is a plain interface returning `Promise<Result<T, E>>` (e.g. `NotesRepository` with `all`, `getById`, `add`, `remove`). It carries the `Result` but never `window.api`. Where it clarifies the CQS split, separate the read and write ports — a reader port for queries and a writer port for commands — rather than one port that both reads and writes (the explorer splits `FolderReaderPort` / `FolderWriterPort`).
- Ports are supplied through a React **context** (`RepositoriesProvider` / `useRepos`). The app root provides the real adapters; tests provide fakes.
- The **real adapter** implements the port over `window.api` and **passes the IPC `Result` through unchanged**. `ok: false` is a value, not an error — the adapter never throws on it. The query/mutation resolves with the `Result`; the UI reads `data.ok`. React Query's `isError` is reserved for genuine infrastructure failures (the IPC channel itself failing), not for `ok: false`.
- The **test adapter** is an in-memory implementation of the same port (e.g. `Map`-backed) that likewise returns `Result` values. Use-case-style tests and hook tests run against it; Electron never runs.

When a query/mutation resolves with `ok: false`, the UI reads `error._tag` and maps it to a translation key (via `t`) to show a correct, localized message. Never render `error` as raw text — switch on its tag. Keep one translation key per error tag.

### Frontend testing

- **Views**: render with props, assert on output. No providers needed.
- **Hooks**: `renderHook` wrapped in a `QueryClientProvider` and a `RepositoriesProvider` supplying in-memory fake ports. Assert the hook's data/mutation behavior without IPC.
- **Controllers**: render with a fake-port provider; assert the view receives the right data and that interactions invoke the command.

The port is the single seam: real = `window.api` adapter, test = in-memory adapter.

No `let` in tests either. To scope a resource (e.g. a headless editor) to a single test without a shared mutable binding, use a `withResource(args, (resource) => { … })` helper that creates it, runs the body, and disposes it in `finally` — not a `let` + `beforeEach`/`afterEach` pair. The editor tests use `withEditor` for exactly this.

ProseMirror's view layer calls DOM APIs jsdom omits (`document.elementFromPoint`, `Range.getClientRects`). These are polyfilled once in `vitest.setup.ts`, guarded by `typeof document !== 'undefined'` so the node test project is unaffected. Any editor test builds a real headless editor with the full extension set (see the editor test harness) so plugin state and dispatch behave as in the app.

### Base UI components

All interactive UI must use Base UI primitives directly.

Do not use raw `<button>`, `<input>`, `<select>`, or `<textarea>` when a Base UI primitive exists.

**Any scrollable region uses the shared `Scrollable` component** (`src/renderer/src/components/Scrollable.tsx`, built on the Base UI `ScrollArea` primitive) so the scrollbar matches our design. Never make content scroll with a native scrollbar — no `overflow-y-auto` / `overflow-auto` / `overflow-scroll` (or the inline `style` equivalent) on a div to get scrolling. This applies to every list, menu, or panel that can overflow (e.g. a dropdown's option list). `overflow-hidden` purely to clip is fine.

Check Base UI documentation before creating new interactive components:

`https://base-ui.com/llms.txt`

Available Base UI components (fetch the relevant page before using one you have not used before):

- [Accordion](https://base-ui.com/react/components/accordion.md): A high-quality, unstyled React accordion component that displays a set of collapsible panels with headings.
- [Alert Dialog](https://base-ui.com/react/components/alert-dialog.md): A high-quality, unstyled React alert dialog component that requires a user response to proceed.
- [Autocomplete](https://base-ui.com/react/components/autocomplete.md): A high-quality, unstyled React autocomplete component that renders an input with a list of filtered options.
- [Avatar](https://base-ui.com/react/components/avatar.md): A high-quality, unstyled React avatar component that is easy to customize.
- [Button](https://base-ui.com/react/components/button.md): A high-quality, unstyled React button component that can be rendered as another tag or focusable when disabled.
- [Checkbox](https://base-ui.com/react/components/checkbox.md): A high-quality, unstyled React checkbox component that is easy to customize.
- [Checkbox Group](https://base-ui.com/react/components/checkbox-group.md): A high-quality, unstyled React checkbox group component that provides a shared state for a series of checkboxes.
- [Collapsible](https://base-ui.com/react/components/collapsible.md): A high-quality, unstyled React collapsible component that displays a panel controlled by a button.
- [Combobox](https://base-ui.com/react/components/combobox.md): A high-quality, unstyled React combobox component that renders an input combined with a list of predefined items to select.
- [Context Menu](https://base-ui.com/react/components/context-menu.md): A high-quality, unstyled React context menu component that appears at the pointer on right click or long press.
- [Dialog](https://base-ui.com/react/components/dialog.md): A high-quality, unstyled React dialog component that opens on top of the entire page.
- [Drawer](https://base-ui.com/react/components/drawer.md): A high-quality, unstyled React drawer component with swipe-to-dismiss gestures.
- [Field](https://base-ui.com/react/components/field.md): A high-quality, unstyled React field component that provides labeling and validation for form controls.
- [Fieldset](https://base-ui.com/react/components/fieldset.md): A high-quality, unstyled React fieldset component with an easily stylable legend.
- [Form](https://base-ui.com/react/components/form.md): A high-quality, unstyled React form component with consolidated error handling.
- [Input](https://base-ui.com/react/components/input.md): A high-quality, unstyled React input component.
- [Menu](https://base-ui.com/react/components/menu.md): A high-quality, unstyled React menu component that displays list of actions in a dropdown, enhanced with keyboard navigation.
- [Menubar](https://base-ui.com/react/components/menubar.md): A menu bar providing commands and options for your application.
- [Meter](https://base-ui.com/react/components/meter.md): A high-quality, unstyled React meter component that provides a graphical display of a numeric value.
- [Navigation Menu](https://base-ui.com/react/components/navigation-menu.md): A high-quality, unstyled React navigation menu component that displays a collection of links and menus for website navigation.
- [Number Field](https://base-ui.com/react/components/number-field.md): A high-quality, unstyled React number field component with increment and decrement buttons, and a scrub area.
- [OTP Field](https://base-ui.com/react/components/otp-field.md): A high-quality, unstyled React OTP field component for one-time password and verification code entry.
- [Popover](https://base-ui.com/react/components/popover.md): A high-quality, unstyled React popover component that displays an accessible popup anchored to a button.
- [Preview Card](https://base-ui.com/react/components/preview-card.md): A high-quality, unstyled React preview card component that appears when a link is hovered, showing a preview for sighted users.
- [Progress](https://base-ui.com/react/components/progress.md): A high-quality, unstyled React progress bar component that displays the status of a task that takes a long time.
- [Radio](https://base-ui.com/react/components/radio.md): A high-quality, unstyled React radio button component that is easy to style.
- [Scroll Area](https://base-ui.com/react/components/scroll-area.md): A high-quality, unstyled React scroll area that provides a native scroll container with custom scrollbars.
- [Select](https://base-ui.com/react/components/select.md): A high-quality, unstyled React select component for choosing a predefined value in a dropdown menu.
- [Separator](https://base-ui.com/react/components/separator.md): A high-quality, unstyled React separator component that is accessible to screen readers.
- [Slider](https://base-ui.com/react/components/slider.md): A high-quality, unstyled React slider component that works like a range input and is easy to style.
- [Switch](https://base-ui.com/react/components/switch.md): A high-quality, unstyled React switch component that indicates whether a setting is on or off.
- [Tabs](https://base-ui.com/react/components/tabs.md): A high-quality, unstyled React tabs component for toggling between related panels on the same page.
- [Toast](https://base-ui.com/react/components/toast.md): A high-quality, unstyled React toast component to generate notifications.
- [Toggle](https://base-ui.com/react/components/toggle.md): A high-quality, unstyled React toggle component that displays a two-state button that can be on or off.
- [Toggle Group](https://base-ui.com/react/components/toggle-group.md): A high-quality, unstyled React toggle group component that provides shared state to a series of toggle buttons.
- [Toolbar](https://base-ui.com/react/components/toolbar.md): A high-quality, unstyled React toolbar component that groups a set of buttons and controls.
- [Tooltip](https://base-ui.com/react/components/tooltip.md): A high-quality, unstyled React tooltip component that appears when an element is hovered or focused, showing a hint for sighted users.

Use lucide-react icons for common UI iconography when an icon exists.

### Animation (Motion)

All animation and interactivity uses the **Motion** library (open-source, formerly Framer Motion). We want motion everywhere — even simple interactions (hovers, taps, mounts/unmounts, layout shifts) should be animated, not static.

**Never assume you know the Motion API. Consult the docs before writing any animation.** The reference index is [docs/motion.dev.react.llms.txt](docs/motion.dev.react.llms.txt) — it lists every Motion page; fetch the specific page you need before using a feature for the first time.

**New Motion syntax only — never old Framer Motion v11.**

- Import from `motion/react`, **never** `framer-motion`. The package is `motion`.
- Use the current open-source API (v12+). Do not reach for deprecated v11 patterns; when unsure whether something changed, check the [Upgrade Guide](https://motion.dev/docs/react-upgrade-guide).

**Core patterns** (see the docs for full detail):

- **Tailwind + Motion** ([guide](https://motion.dev/docs/react-tailwind)): static and responsive styling stays in `className`; animation lives in Motion props (`initial`, `animate`, `exit`, `whileHover`, `whileTap`, `layout`). Do not put `transition-*` utility classes on a Motion-animated element — Motion's inline styles and Tailwind transitions conflict.
- **Base UI + Motion** ([guide](https://motion.dev/docs/base-ui)): animate Base UI primitives through their `render` prop, swapping the default element for a `motion.*` component (e.g. `<Menu.Trigger render={<motion.button … />} />`). For exit animations, wrap in `AnimatePresence`; for primitives that own their own mounting (Popover, Context Menu), hoist `open`/`onOpenChange`, add `keepMounted` to the Portal, and conditionally render it inside `AnimatePresence`. Animate `opacity`/`transform`/`filter`/`clipPath` so exits run hardware-accelerated and unmount cleanly.
- **Accessibility:** respect reduced-motion (`useReducedMotion` / `MotionConfig`) — see the [accessibility page](https://motion.dev/docs/react-accessibility).

Motion lives in the renderer and is animation, not data — it sits in views/plain components and obeys all the rules above (no `as`, design tokens only, one export per file).

### Translation

Always use the `t` hook from react-i18next for user-facing text when the surrounding code is localized or the text belongs to product UI.

The app is built to be translatable and is intended for English and Spanish users. All user-facing UI must be written translation-ready (no hardcoded strings). Only the English locale (`en.json`) exists today; do not assume a Spanish locale file is present.

## Testing

Every use case must have tests. A use case is not complete without them.

Because use cases depend only on ports, test them by providing in-memory or fake adapter implementations of those ports — no real filesystem, network, or OS access in use-case tests. Cover both outcomes: success (`ok: true`) and each typed failure value (`ok: false`).

Pure calculations should also be tested directly; they need no setup. Adapter tests are the place to exercise real I/O against the resource they wrap (e.g. a temp directory for a filesystem adapter).

Tests live in a `__tests__/` folder beside the code under test.

## End-to-end testing

Every user-facing feature and every user-triggered operation must be covered by an end-to-end test that drives the **real desktop app**. This is non-negotiable and it is mechanically enforced (see the audit below). Unit/jsdom tests (Vitest) cover logic, views, hooks, and use cases; e2e covers the app as a user actually uses it.

### Drive the real app — never mock `window.api`

- e2e uses **Playwright's Electron driver** (`_electron.launch`) against the **built** app (`out/main/index.js`). This runs the real main process, the real preload, the real `window.api`/IPC, the real use cases, and the real OS watcher. A spec interacts with the first window exactly as a user would.
- **Do not mock or stub `window.api`, IPC, the filesystem, or any use case in e2e.** Mocking the wire would test a fiction and would not reflect reality. If you find yourself wanting to fake the backend in an e2e test, that test belongs in Vitest instead.
- **The one and only sanctioned stub is a native OS dialog** a human would otherwise click and Playwright cannot drive (e.g. the folder chooser). Override it in the **main process** via `electronApp.evaluate` (see `e2e/support/stub-folder-picker.ts`). Everything the stub feeds into — the real `FolderPicker` port, `list-folder`, the watcher — still runs for real. Do not extend this exception to anything that is application behavior.
- Real resources are created on disk and cleaned up: use a `withTempFolder(seeds, (folder) => …)`-style helper (no `let`), and always `await app.close()` in a `finally`.

### Layout and naming

- Specs and harness live in `e2e/`. Spec files are named `*.e2e.ts`; shared helpers live in `e2e/support/`. The e2e folder is its own TypeScript project (`tsconfig.e2e.json`, run by `npm run typecheck:e2e`) and has its own ESLint block (`eslint/e2e.mjs`) — it is **not** renderer/main source, so the view/controller/IPC rules do not apply, but the hard bans (no escape hatches, no `as`, no disable directives, no `let`) still do.
- `npm run test:e2e` runs the real-app suite (Playwright). It is slow (it builds and launches Electron) and is run on demand / for UI work, **not** in the pre-push hook.

### Locators

Prefer **role/label locators** (`getByRole('button', { name: … })`, `getByPlaceholder`, `getByText`) over test ids — the UI is already accessibility-labelled (`aria-label`, placeholders via `t`), and role locators double as an accessibility check. Add a **`data-testid`** only when there is no stable accessible handle (e.g. a container, or a row that must be located by its file path). Test-id convention: `feature-thing:key` (e.g. `file-row:<absolute-path>`, `explorer`). Never assert on Tailwind/structural classes except where a class encodes state with no accessible equivalent.

### Forced coverage (the audit)

There is no honest line-coverage metric for an externally driven Electron process, so we enforce **existence and a declared claim** instead, and let the real-app spec do the validating:

- `e2e/coverage-manifest.ts` is the single source of truth: it lists every **shipped** feature (`FEATURES`) and every **shipped** user-facing operation (`OPERATIONS`, one id per real IPC channel a user can trigger).
- Each spec declares what it covers with `@e2e` header tags: `@e2e feature:<id>` and `@e2e operation:<id>`.
- `e2e/__tests__/audit.test.ts` (a fast Vitest test, part of `npm run test`) fails if any manifest id is not claimed by some spec.
- **Do not pre-list unbuilt features in the manifest.** When a feature or IPC channel ships, the _same change_ adds its id(s) to the manifest **and** a real-app spec that claims and exercises them. This keeps the gate green incrementally while making it impossible to ship UI or a new channel without an e2e test. Adding a manifest id without a spec (or vice versa) turns the gate red — that is the point; satisfy it by writing the real spec, never by removing the id.

## Commits

Use Conventional Commits:

```txt
<type>(<scope>): <description>
```

Allowed types are `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, and `test`.

Use an optional scope when it clarifies the affected area.

Keep the description short, imperative, and lowercase when possible.

Do not end the subject with a period.

Use `!` for breaking changes.

**Never add any authorship or attribution metadata, and never mention Claude, an AI, or an agent anywhere in a commit or PR.** No `Co-authored-by`, no `Signed-off-by`, no "Generated with…", no "🤖", no "Claude", no "AI-generated" — not in a commit message, commit footer, PR title, or PR body. Commits and PRs read as if a human authored them. This is enforced by the `commit-msg` hook, but the rule is absolute regardless of what the hook catches.

**Always work on a branch — never commit on a trunk branch (`main`/`master`/`develop`).** Every plan and every change gets its own branch, and branch names follow [Conventional Branch](https://conventionalbranch.org): `<type>/<description>`, where `type` is one of `feat`, `fix`, `hotfix`, `release`, or `chore`, and the description is lowercase letters, digits, and hyphens (dots only for release version numbers). Examples: `feat/chat-panel`, `fix/null-response`, `release/1.2.0`. This is enforced by the `commit-msg` hook, which refuses a commit made on a trunk branch or from a branch whose name does not match the grammar. Create the branch before you start the work.

**A plan is worked entirely on its branch, then opened as a PR for review.** Commit through the plan's steps on the branch — including the final commit that removes the completed plan file (see "When a plan is done"). Before opening the PR, **rebase the branch onto the latest `main`** so it is up to date (see "Worktrees and parallel work"). When the plan is finished and the checks are green, push the branch and open a **pull request into `main`** with a structured description: what was done, the files involved and their purpose, how to validate it manually in the running app, what tests were run, and any open questions. The human reviews the PR and gives final approval — **do not merge it yourself.** The `finish-plan` skill runs this whole closing sequence (verify done → run checks → draft the PR body → remove the plan → push → open the PR); invoke it when a plan is complete.

**A PR that has been open a while can develop merge conflicts** as parallel work lands on `main`. When that happens, rebase onto the latest `main`, resolve the conflicts, re-run the checks green, and push again.

Keep each commit within the **commit-size budget** (see "How we work" → "Commit-size budget"); it is enforced at pre-commit. If a change is too big, that is a planning signal — split it into the plan's next step, not a workaround.

**Docs travel with the code.** The relevant `docs/plans/` entry is part of the change, not a separate chore: a commit that advances a feature updates that feature's plan. `.md` weight is excluded from the commit-size budget, so this never pushes a commit over the limit.
