# Pluma — Project Rules

A shared reference for every rule we follow, taken from `.agents/` and `eslint/`. This is the contract: most of it is enforced by lint, types, tests, and git hooks, but the conventions matter just as much. Read it once, keep it nearby.

---

## 1. Working agreement

**Definition of done.** A task is done only when `npm run lint`, `npm run test`, `npm run type-coverage`, and `npm run build` all pass. Run them yourself and report them green before calling anything finished. `npm run test` includes the e2e coverage audit, so a new UI feature or IPC channel is not done until its manifest entry and real-app spec exist. Any task that ships or changes user-facing UI also needs `npm run test:e2e` (the real desktop suite) green — it is the gate for UI work even though, being slow, it is not in the pre-push hook.

**Smallest thing that works.** Prefer the smallest implementation that satisfies the current requirement (YAGNI). Do not invent business behavior — if a rule is not explicit in the code or the request, ask before implementing it.

**Minimal diff.** Change only what the task requires. Do not reformat, rename, or refactor unrelated code, and do not touch files outside the scope of the request.

**No new dependencies without approval.** Do not add a runtime or dev dependency without asking first, and justify each one.

**Never weaken a check to make it pass.** Do not delete or skip tests, loosen an assertion, lower a coverage threshold, or relax a lint rule to go green. If a check fails, fix the cause. If a rule genuinely needs to change, stop and ask.

**No escape hatches.** No `eslint-disable` of any kind, no `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`, no `as` casts (except `as const`), no non-null `!`. These are lint errors.

**Never game a rule.** A check exists to be satisfied by correct code, not routed around. The only acceptable responses to a blocking rule are: fix the code so it passes honestly, or stop and ask a human to change the rule. The following all count as forbidden hacks even though none is a disable or a cast — type-dodging through permissive APIs (e.g. `Object.assign(window, …)` to avoid fixing the `Window` type), weakening a rule's options, scoping a file out of a ban via `ignores`, or renaming/relocating code purely to fall outside a selector. The test: after your change, is the thing the rule protects against actually gone, or just unreported? If only unreported, it's a hack.

---

## 2. Architecture — hexagonal + Effect

We use ports and adapters with functional programming via [Effect](https://effect.website). Dependencies point inward only: IPC → application. The application defines ports; adapters implement them; nothing inner imports anything outer.

**There is no separate domain layer.** Business types, pure logic, and typed errors live in the application layer alongside the use cases that own them.

**The three layers.**

Application — use cases plus the business types, pure logic, and typed errors they own. A use case orchestrates logic and depends only on ports (interfaces), never on concrete adapters. Written in Effect.

Adapters — concrete implementations of ports (filesystem, persistence, OS, external services), wired in at the edge.

IPC — the endpoints. Each calls one application use case. This is where Effect is executed and the outcome serialized.

**Commands vs queries.** Keep read and write paths apart. At the method level (CQS): a method either returns data with no side effects (query) or changes state and returns void/an ack (command), never both. At the use-case level (lightweight CQRS over the same store): query use cases and command use cases are distinct objects, and where it helps, distinct ports — e.g. a `FolderReader` for queries and a `FolderWriter` for commands rather than one port that does both.

**Result at the IPC boundary.** Effect types never cross IPC. Every endpoint runs its use case and serializes the outcome into a plain discriminated union: `{ ok: true; value: T } | { ok: false; error: E }`. Never throw across the boundary. Every error value carries a discriminating `_tag` (or `code`) plus the data needed to render it — never a free-form string. Define these as Effect tagged errors in the application layer; the frontend maps each tag to a translated message.

**Repositories.** Persistence is accessed through the Repository pattern as a port. The port lives in the application layer and exposes collection-like operations (`add`, `remove`, `contains`, `getById`, `all`, `findBy`) — think in-memory set, not a database API; no SQL or table names leak in. The adapter lives in the adapters layer and is the only place that touches the database. Tests use an in-memory repository implementing the same port. The concrete database is not chosen yet; keep the port database-agnostic.

**Target main-process layout.** `src/main/application/` (use cases, their types/logic/errors, and port interfaces), `src/main/adapters/` (port implementations), `src/main/ipc/` (endpoints). Group a feature under the application layer (e.g. `application/file/`) and split it by role: `usecase/` (with `__tests__/`), `port/` (`*.port.ts` files, interfaces with a `Port` suffix), `logic/` (pure shared calculations), `data/` (plain Data records that cross IPC), `error/` (typed errors). Create a role folder only when there's something to put in it.

---

## 3. Code structure — Data / Calculations / Actions

Classify all code into three categories (per _Grokking Simplicity_):

Data — plain values and records with no behavior. Use it to model domain facts and to pass information across boundaries (IPC, props, JSON).

Calculations — pure functions: same input, same output, no side effects. Business logic and transformations live here. Default to this.

Actions — anything that depends on when or how many times it runs: I/O, mutation, network, filesystem, `Date.now()`, randomness, Electron IPC, React effects. Keep these thin and at the edges.

When you must write an action, extract its logic into a calculation it calls, so the testable part stays pure. Never bury business rules inside actions or React components. In Effect terms: actions live in the runtime (ports/adapters), calculations stay pure.

---

## 4. Code style (lint-enforced)

**No `let`, no `var`.** `const` only — model change through new values, recursion, or Effect. (`no-var`, `prefer-const`, plus a selector banning `let` and one flagging reassignment of outer-scope identifiers.)

**No input mutation.** Functions do not mutate their arguments. (`no-param-reassign` with `props: true`.)

**No type-safety escape hatches.** No `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`, no `x!`, no `x as T` (except `as const`), no `<T>x`. `x satisfies T` is allowed — it's checked. To read an `unknown`, write a type-guard, not a cast.

**No `throw`.** Return a `Result` for recoverable failures, or in Effect code fail with a typed error. The one sanctioned exception is `invariant()` from `src/shared/invariant.ts` for unrecoverable wiring invariants.

**No `console`.** Logging is an action; surface failures as values (Result) or through an explicit logging port.

**One export per file** is the strong default, approximated by lint as "named exports only" (`import-x/no-default-export`) plus consolidated exports (`import-x/group-exports`). A file declares symbols internally and exposes them with a single `export { … }` (and a single `export type { … }`) at the bottom. Exempt from the default-export ban: entry points and config files (`main.tsx`, `*.config.*`, `electron.vite.config.ts`).

**One responsibility per file.** If a file grows a second concern, split it.

**No global / module-level mutable state — ever**, including the `const ref = { n: 0 }; ref.n++` trick that only exists to satisfy lint. Hold sequential ids or accumulating state in the relevant state container as a pure previous-state → next-state function.

**Comments.** No inline comments in the middle of code — it should read clearly on its own. Start each file with a short one-or-two-line header comment saying what it is about.

**No hand-rolled SVG icons.** Use an icon from lucide-react (preferred) or `@base-ui/react`. The JSX tags `<svg> <path> <circle> <rect> <polyline> <polygon> <line> <ellipse>` are banned.

**No raw HTML widgets with a Base UI equivalent.** `<button>` → `Button`, `<input>` → `Input`, `<hr>` → `Separator`, `<select>` → `Select`, `<dialog>` → `Dialog`, all from `@base-ui/react`.

---

## 5. Size & complexity limits (lint-enforced, under `src`)

Max params per function: 2 (two only because Electron callbacks `(_, window)` and reducers `(acc, item)` need it — prefer one in your own functions). Max lines per function: 75. Max lines per file: 250. Max statements per function: 12. Max nesting depth: 3. Cyclomatic complexity: 8. Max nested callbacks: 3. Max classes per file: 1.

---

## 6. Layer-boundary rules (lint-enforced)

`application` may not import `adapters` or `ipc`. `application` and `adapters` may not import `src/shared` (the wire layer — only IPC handlers map between domain and wire types). The renderer may not import any `src/main` internals — it talks to main only through the preload `window.api` bridge. These are enforced both by `import-x/no-restricted-paths` and by resolver-free specifier bans, so a relative path into `main/` or `shared/` is rejected regardless of resolver setup.

---

## 7. Frontend

The renderer mirrors the backend's ports-and-adapters approach and lives under `src/renderer/src/`, organized **feature-first**.

**Feature folders, not role folders.** Each feature owns its whole slice — views, controllers, hooks, and pure modules — in one folder. Role is encoded in the filename suffix (`*.view.tsx`, `*.controller.tsx`, `*.ts`), not in a folder. Do not create top-level `hooks/` or `components/` buckets for feature code; they become junk drawers. Only genuinely cross-feature primitives (a generic `Scrollable`, design-system wrappers) go in a top-level `components/`. A feature gets `ports/` and `adapters/` only when it actually talks to `window.api`.

**Component types — exactly one of three, visible in the filename.**

View (`*.view.tsx`) — pure layout, everything via props, no hooks, no side effects. Lint-enforced: a view may not call hooks (`use*`) or touch `window.api`. When a view needs a computed value, the controller computes it and passes it as a prop.

Controller (`*.controller.tsx`) — wires hooks (the side effects) to a view. No layout of its own.

Plain / visual (`Name.tsx`) — a self-contained visual component. May use `useState` for local UI state only (open/closed, hover). No data fetching or mutations. Lint-enforced: plain components may not touch `window.api` either — only controllers (via hooks) and renderer adapters may.

**Hooks: commands and queries.** All data access goes through TanStack Query — never hand-roll fetching/caching with `useState` + `useEffect` over `window.api`. CQS applies in the renderer too: a hook is either a query or a command, never both, and they are separate hooks with separate exports. Query hooks wrap `useQuery`/`useQueries`, are side-effect-free, and their `data` is a `Result<T, E>` the UI branches on. Command hooks wrap `useMutation`, return a `Result`, and invalidate the affected query keys only when `ok: true`. Query keys come from one shared pure helper (e.g. `folderListingKey(path)`), never inlined at call sites.

**Ports and adapters in the renderer.** A repository port is a plain interface returning `Promise<Result<T, E>>`; it carries the `Result` but never `window.api`. Split reader and writer ports where the CQS split helps. Ports are supplied through React context (`RepositoriesProvider` / `useRepos`) — real adapters at the app root, fakes in tests. The real adapter passes the IPC `Result` through unchanged: `ok: false` is a value, not an error — never throw on it, and reserve React Query's `isError` for genuine infrastructure failures. When a result is `ok: false`, the UI switches on `error._tag` and maps it to a translation key; never render `error` as raw text. The explorer feature (`src/renderer/src/explorer/`) is the worked reference for this whole section.

**Custom CSS variables without a cast.** Type the `style` object as `CSSProperties & { '--my-var': T }` rather than casting.

**Extract pure calculations from hooks.** Keep DOM / `localStorage` / event math out of the hook body in a sibling `*-logic.ts` so it's unit-testable without a DOM (`editor-zoom-logic.ts` is the model).

---

## 8. Styling & design tokens

All styling uses the design tokens in `src/renderer/src/App.css`. Never invent a new token, color, font, or one-off value — if one you need doesn't exist, stop and ask.

The allowed tokens (from the `@theme inline` block): surfaces `surface-1/2/3`; text `text-primary/secondary/muted/on-accent`; actions `action-primary/secondary/destructive`; feedback `feedback-success/warning/error/info`; structural `border`, `overlay`; fonts `font-ui`, `font-editor`. Use them through the generated Tailwind utilities (`bg-surface-2`, `text-text-muted`, …) or `var(--color-…)` in CSS. They already adapt to light/dark — never hardcode a hex/oklch/rgb color.

**No arbitrary or fractional values** (lint-enforced in className). Forbidden: bracketed arbitrary values like `px-[3.5px]`, `w-[417px]`, `text-[13px]`, `bg-[#fff]`; and fractional spacing like `px-3.5`, `gap-2.5`, `mt-1.5`. Use a token or a whole step on the standard scale. If the design seems to need a value the scale can't express, that's a signal to ask.

---

## 9. Animation — Motion

All animation and interactivity uses the **Motion** library (open-source, formerly Framer Motion). We want motion everywhere — hovers, taps, mounts/unmounts, layout shifts should be animated, not static.

Never assume the Motion API — consult the docs before writing any animation. The reference index is `docs/motion.dev.react.llms.txt`; fetch the specific page before first use of a feature.

New syntax only. Import from `motion/react`, never `framer-motion` (the package is `motion`). Use the current v12+ API; no deprecated v11 patterns.

Tailwind + Motion: static styling stays in `className`, animation in Motion props (`initial`, `animate`, `exit`, `whileHover`, `whileTap`, `layout`). Don't put `transition-*` utility classes on a Motion-animated element — they conflict. Base UI + Motion: animate primitives through their `render` prop with a `motion.*` component; wrap in `AnimatePresence` for exits. Respect reduced-motion (`useReducedMotion` / `MotionConfig`). Motion is animation, not data — it sits in views/plain components and obeys every rule above.

---

## 10. Base UI

All interactive UI must use Base UI primitives directly — no raw `<button>`, `<input>`, `<select>`, `<textarea>` when a primitive exists. Check the Base UI docs (`https://base-ui.com/llms.txt`) before creating a new interactive component, and fetch the relevant component page before using one for the first time. Use lucide-react icons for common iconography.

---

## 11. Translation

Always use the `t` hook from react-i18next for user-facing text. The app targets English and Spanish, so all UI must be written translation-ready — no hardcoded strings. Only `en.json` exists today; do not assume a Spanish locale file is present. (Not yet lint-enforced — caught in review.)

---

## 12. Testing

**Use cases.** Every use case must have tests — it is not complete without them. Test through in-memory/fake port implementations (no real filesystem, network, or OS). Cover both outcomes: success (`ok: true`) and each typed failure (`ok: false`).

**Calculations** are tested directly — no setup. **Adapter tests** are the place to exercise real I/O against the resource they wrap (e.g. a temp directory).

**Frontend.** Views: render with props, assert on output, no providers. Hooks: `renderHook` wrapped in `QueryClientProvider` + `RepositoriesProvider` with in-memory fake ports. Controllers: render with a fake-port provider; assert the view gets the right data and interactions invoke the command. The port is the single seam — real = `window.api` adapter, test = in-memory adapter.

**No `let` in tests either.** To scope a resource to a single test, use a `withResource(args, (resource) => …)` helper that disposes in `finally` — not `let` + `beforeEach`/`afterEach`. The editor tests use `withEditor`.

Tests live in a `__tests__/` folder beside the code under test.

**Coverage gates.** Vitest coverage is gated at 80% (lines, functions, branches, statements). `type-coverage --strict` is gated at 95% — this catches implicit/explicit `any` the type system would otherwise let through.

---

## 13. End-to-end testing

Every user-facing feature and every user-triggered operation must be covered by an e2e test that drives the **real desktop app**. This is non-negotiable and mechanically enforced.

**Drive the real app — never mock `window.api`, IPC, the filesystem, or any use case.** e2e uses Playwright's Electron driver against the built app (`out/main/index.js`): real main process, real preload, real IPC, real use cases, real OS watcher. Mocking the wire would test a fiction. The one and only sanctioned stub is a native OS dialog a human would click and Playwright can't drive (the folder chooser), overridden in the main process via `electronApp.evaluate` (see `e2e/support/stub-folder-picker.ts`) — everything downstream still runs for real. Create real resources on disk and clean them up with a `withTempFolder`-style helper; always `await app.close()` in a `finally`.

**Layout & naming.** Specs and harness live in `e2e/`; spec files are `*.e2e.ts`, helpers in `e2e/support/`. It's its own TypeScript project (`tsconfig.e2e.json`, `npm run typecheck:e2e`) with its own ESLint block (`eslint/e2e.mjs`): the view/controller/IPC rules don't apply, but the hard bans (no escape hatches, no `as`, no disable directives, no `let`) still do. Two app rules are relaxed here only — `no-param-reassign` (for the dialog stub) and default exports (Playwright entry points). `npm run test:e2e` is slow and run on demand for UI work, not in pre-push.

**Locators.** Prefer role/label locators (`getByRole('button', { name })`, `getByPlaceholder`, `getByText`) over test ids — they double as an accessibility check. Add a `data-testid` only when there's no stable accessible handle, using the convention `feature-thing:key` (e.g. `file-row:<absolute-path>`). Never assert on Tailwind/structural classes unless a class encodes state with no accessible equivalent.

**The audit (forced coverage).** There's no honest line-coverage for an externally driven Electron process, so we enforce existence and a declared claim instead. `e2e/coverage-manifest.ts` is the single source of truth listing every shipped feature (`FEATURES`) and every shipped user-facing operation (`OPERATIONS`, one id per real IPC channel). Each spec declares coverage with `@e2e feature:<id>` / `@e2e operation:<id>` header tags. `e2e/__tests__/audit.test.ts` (fast, part of `npm run test`) fails if any manifest id is unclaimed. Do not pre-list unbuilt features — when a feature or channel ships, the same change adds its manifest id(s) and a real spec that exercises them.

---

## 14. Tooling reference

The ESLint config is split by concern under `eslint/` and composed in `eslint.config.mjs` (prettier last, so it disables conflicting formatting rules). `base.mjs` — global ignores + TypeScript/React recommended sets. `style.mjs` — functional style and type-safety rules (exports `baseRestrictedSyntax`, the shared selectors). `architecture.mjs` — layer boundaries and the view/controller/plain rules. `limits.mjs` — size and complexity. `comments.mjs` — bans disable directives. `effect.mjs` — Effect rules (barrel-import ban). `react.mjs` — hooks + fast-refresh. `tailwind-classnames.mjs` — the arbitrary/fractional className ban. `e2e.mjs` — the e2e harness block.

Inherited recommended sets that are also enforced: TypeScript (`@typescript-eslint` recommended — no unused vars, no `any`, no floating promises), React recommended + `jsx-runtime`, React Hooks (`rules-of-hooks`, `exhaustive-deps`), React Refresh (`only-export-components`), and Prettier (owns all formatting). Note: `no-restricted-syntax` is not merged across overlapping flat-config blocks, so a scoped block that adds selectors must spread `baseRestrictedSyntax` in too.

**Rules deliberately not yet enforced** (conventions until added, to avoid new deps / false positives): no hardcoded UI strings (would need `eslint-plugin-i18next`) and deep data immutability (would need `eslint-plugin-functional`).

**Git hooks (husky).** pre-commit (fast): `format` → `lint` → `test`. pre-push (heavy): `test:coverage` → `type-coverage` → `build`. The Electron preview (`start`) is never run in a hook — it doesn't exit.

---

## 15. Commits

Conventional Commits: `<type>(<scope>): <description>`. Allowed types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`. Scope is optional, used when it clarifies the affected area. Keep the description short, imperative, and lowercase; no trailing period. Use `!` for breaking changes. Do not add `Co-authored-by` or other footers.

This is a solo project: no feature branches — commit directly to `main`. There is no PR or merge step.
