## General rules

Prefer the smallest implementation that satisfies the current requirement. Follow YAGNI.

Do not invent business behavior. If a business rule is not explicit in the code or request, ask before implementing it.

### Working agreement

- **Definition of done.** A task is done only when `npm run lint`, `npm run test`, `npm run type-coverage`, and `npm run build` all pass. Run them yourself and report them green before saying a task is complete. Never declare something finished without the checks passing.
- **Minimal diff.** Change only what the task requires. Do not reformat, rename, or refactor unrelated code, and do not touch files outside the scope of the request.
- **Never weaken the checks to pass.** Do not delete or skip tests, loosen an assertion, lower a coverage threshold, or relax a lint rule to make a build go green. If a check fails, fix the cause. If a rule genuinely needs to change, stop and ask.
- **No new dependencies without approval.** Do not add a runtime or dev dependency without asking first, and justify why each one is needed. This is the counterpart to YAGNI.
- **No escape hatches.** Do not silence the tools: no `eslint-disable` / `eslint-disable-next-line`, no `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`, no `as` casts (except `as const`), no non-null `!`. These are lint errors. If the types or rules are fighting you, fix the underlying code or ask.

## Architecture

We follow **hexagonal architecture** (ports and adapters) and **functional programming with [Effect](https://effect.website)**.

### Layers

There is **no separate domain layer**. Business types, pure logic (calculations), and typed errors live in the **application** layer alongside the use cases that own them.

- **Application** — use cases plus the business types, pure logic, and typed errors they own. A use case orchestrates this logic and depends only on **ports** (interfaces), never on concrete adapters. Use cases are written in Effect.
- **Adapters** — concrete implementations of ports (filesystem, persistence, OS, external services). The application depends on the port; the adapter is wired in at the edge.
- **IPC** — the endpoints. Each endpoint calls an application use case. This is the boundary where Effect is executed and the outcome is serialized.

Dependencies point inward: IPC → application. The application defines ports; adapters implement them; nothing inner imports anything outer.

### Target folder layout

As the app grows, place code as follows (create folders as needed):

- `src/main/application/` — use cases, the business types/pure logic/typed errors they own, and the port interfaces they depend on
- `src/main/adapters/` — port implementations
- `src/main/ipc/` — IPC endpoints that invoke use cases

Group a feature's files together under the application layer (e.g. `application/file/`), with its typed errors under an `error/` subfolder and its tests under a `__tests__/` subfolder.

**Ports** are interfaces a use case depends on. Name the file `*.port.ts` and the interface with a `Port` suffix (e.g. `file-writer.port.ts` exporting `FileWriterPort`). The Effect `Context` tag for the port may keep a plain service name (e.g. `FileWriter`).

**Tests** live in a `__tests__/` folder next to the code they cover (e.g. `application/file/__tests__/create-file.test.ts`), not as siblings of the source file.

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
- **One file-header comment.** Start each file with a short comment explaining what the file is about. Keep it to a line or two.

## Tooling and enforcement

The ESLint config is split by concern under `eslint/` and composed in `eslint.config.mjs` (prettier last, so it disables conflicting formatting rules). Each module owns one set of rules:

- `eslint/base.mjs` — global ignores (`node_modules`, `dist`, `out`, `coverage`, `.references`, HTML) plus the TypeScript and React recommended configs.
- `eslint/style.mjs` — the functional style and type-safety rules below. Exports `baseRestrictedSyntax`, the shared `no-restricted-syntax` selectors.
- `eslint/architecture.mjs` — hexagonal layer boundaries and the view/controller/plain component rules.
- `eslint/limits.mjs` — size and complexity limits.
- `eslint/comments.mjs` — bans ESLint disable directives.
- `eslint/effect.mjs` — Effect-specific rules.
- `eslint/react.mjs` — React hooks and fast-refresh rules.

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

- **pre-commit** (fast): `format` (prettier --write, then `git add -u` to restage) → `lint` → `test`.
- **pre-push** (heavy): `test:coverage` → `type-coverage` → `build`.

`start` (the Electron preview) is never run in a hook — it does not exit. Run it manually.

## Frontend

The frontend mirrors the backend's ports-and-adapters approach so it is highly testable. Code lives under `src/renderer/src/` in `ports/`, `adapters/`, `hooks/`, and `components/`.

### Styling and design tokens

All styling uses the design tokens defined in `src/renderer/src/App.css`. **Never invent a new token, color, font, or one-off value.** If a token you need does not exist, stop and ask — do not add an ad-hoc value.

The only allowed tokens are those exposed by the `@theme inline` block in `App.css`:

- **Surface colors**: `surface-1`, `surface-2`, `surface-3`, `surface-inverse-1`
- **Text colors**: `text-primary`, `text-secondary`, `text-muted`, `text-inverse-primary`
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

### Hooks: commands and queries

Hooks come in two kinds, one export each:

- **Query** — reads/fetches data. Wraps `useQuery` (TanStack Query); its `data` is a `Result<T, E>`, and the UI branches on `data.ok`. Example: `useNotes`.
- **Command** — performs a mutation. Wraps `useMutation`; the result is a `Result`, and queries are invalidated when it returns `ok: true`. Example: `useAddNote`.

A hook never talks to Electron directly. It obtains a **repository port** and calls it.

### Ports and adapters in the renderer

- A **repository port** is a plain interface returning `Promise<Result<T, E>>` (e.g. `NotesRepository` with `all`, `getById`, `add`, `remove`). It carries the `Result` but never `window.api`.
- Ports are supplied through a React **context** (`RepositoriesProvider` / `useRepos`). The app root provides the real adapters; tests provide fakes.
- The **real adapter** implements the port over `window.api` and **passes the IPC `Result` through unchanged**. `ok: false` is a value, not an error — the adapter never throws on it. The query/mutation resolves with the `Result`; the UI reads `data.ok`. React Query's `isError` is reserved for genuine infrastructure failures (the IPC channel itself failing), not for `ok: false`.
- The **test adapter** is an in-memory implementation of the same port (e.g. `Map`-backed) that likewise returns `Result` values. Use-case-style tests and hook tests run against it; Electron never runs.

When a query/mutation resolves with `ok: false`, the UI reads `error._tag` and maps it to a translation key (via `t`) to show a correct, localized message. Never render `error` as raw text — switch on its tag. Keep one translation key per error tag.

### Frontend testing

- **Views**: render with props, assert on output. No providers needed.
- **Hooks**: `renderHook` wrapped in a `QueryClientProvider` and a `RepositoriesProvider` supplying in-memory fake ports. Assert the hook's data/mutation behavior without IPC.
- **Controllers**: render with a fake-port provider; assert the view receives the right data and that interactions invoke the command.

The port is the single seam: real = `window.api` adapter, test = in-memory adapter.

### Base UI components

All interactive UI must use Base UI primitives directly.

Do not use raw `<button>`, `<input>`, `<select>`, or `<textarea>` when a Base UI primitive exists.

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

### Translation

Always use the `t` hook from react-i18next for user-facing text when the surrounding code is localized or the text belongs to product UI.

The app is built to be translatable and is intended for English and Spanish users. All user-facing UI must be written translation-ready (no hardcoded strings). Only the English locale (`en.json`) exists today; do not assume a Spanish locale file is present.

## Testing

Every use case must have tests. A use case is not complete without them.

Because use cases depend only on ports, test them by providing in-memory or fake adapter implementations of those ports — no real filesystem, network, or OS access in use-case tests. Cover both outcomes: success (`ok: true`) and each typed failure value (`ok: false`).

Pure calculations should also be tested directly; they need no setup. Adapter tests are the place to exercise real I/O against the resource they wrap (e.g. a temp directory for a filesystem adapter).

Tests live in a `__tests__/` folder beside the code under test.

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

Do not add `Co-authored-by` or other authored footers.

This is a solo project. Do not create feature branches: commit directly to `main`. There is no PR or merge step.
