# Chat model & effort selector

Let the user pick the **AI model** and the **reasoning effort** from the chat (rail) composer, and have those choices drive the next agent run. The backend already accepts a per-run `state: { model?, effort? }` and feeds it to the Claude SDK — today the renderer simply never sends it. This feature adds the two composer controls and the thin plumbing that carries the selection from the UI into the existing `agent:run` `state`.

Scope is deliberately narrow:

- **Models:** Opus 4.8 (`claude-opus-4-8`, the current default) and Sonnet 4.6 (`claude-sonnet-4-6`). Only these two.
- **Effort:** Low, Medium, High — Medium default. Only these three. The wire `EffortLevel` union still allows `xhigh`/`max`, but the UI must not offer them.

## Done

The feature is done when, in the running app:

- The chat composer shows a **model selector** (Opus 4.8 / Sonnet 4.6, default Opus 4.8) and an **effort selector** (Low / Medium / High, default Medium) in its footer.
- Sending a message runs the agent with the selected model and effort: the chosen values arrive in the `agent:run` input's `state`, and `build-options` maps them to the SDK options (verified by unit tests on the wire mapping; the selector presence/interaction verified by e2e).
- All labels are translation-ready (`t()` keys in `en.json`); UI uses Base UI + design tokens only.
- `npm run lint`, `npm run test` (incl. the e2e coverage audit), `npm run type-coverage`, `npm run build` are green, and `npm run test:e2e` is green (UI feature).

## Steps

### 1. Widen the model type and export the wire unions — `feat`

- **`src/shared/ipc/ipc-contract/agent.ts`** — add `'claude-sonnet-4-6'` to the `Model` union; **export `Model` and `EffortLevel`** (today only `RunAgentState` is exported) so the renderer can type its option lists against the wire types.
- **`src/main/application/agent/data/run-agent-state.ts`** — mirror: add `'claude-sonnet-4-6'` to its `Model` union (this file already exports `Model`/`EffortLevel`). The two declarations are duplicated and must stay in sync.
- **`src/main/adapters/agent/claude/logic/__tests__/build-options.test.ts`** — extend the existing test to assert: a `state` with `model: 'claude-sonnet-4-6'` and an explicit `effort` is honored (passed through to the built options), and that the defaults (`claude-opus-4-8` / `medium`) still apply when `state` is omitted.

Delivers the type widening the rest builds on; `build-options` itself needs no code change (it already reads `state.model`/`state.effort`). Small, type-only + test.

### 2. Carry the run state from the renderer into `agent:run` — `feat`

- **`src/renderer/src/agent/to-run-input.ts`** — add a `forwardedRunState(forwardedProps)` guard sibling to the existing `forwardedCwd`, and lift `state` onto the IPC input the same way `cwd` is lifted (omitted entirely when absent). This is the pure mapping seam.
- **`src/renderer/src/agent/adapters/Agent.ts`** — mirror the `workspaceCwd`/`setCwd` pattern: add a mutable run-state field and a `setRunState(state: RunAgentState)` method, and stamp `state` onto `forwardedProps` inside `startRun` alongside `cwd` (class-field mutation through `this`, the established pattern here — not a `let`).
- **`src/renderer/src/agent/__tests__/to-run-input.test.ts`** — assert `state` is lifted from `forwardedProps` when present and omitted when absent / malformed.
- **`src/renderer/src/agent/__tests__/Agent.test.ts`** — assert a value set via `setRunState` appears in the payload `startRun` sends to `AGENT_RUN_CHANNEL`.

Delivers the full wire path; nothing yet calls `setRunState`, so behavior is unchanged until step 4. Each test lands with its code.

### 3. Curated UI option lists + defaults (pure module) — `feat`

- **`src/renderer/src/rail/run-controls.ts`** (new pure data/calc module) — export the curated `MODEL_OPTIONS` (`claude-opus-4-8` → "Opus 4.8", `claude-sonnet-4-6` → "Sonnet 4.6") and `EFFORT_OPTIONS` (`low`/`medium`/`high` → label keys), the defaults (`DEFAULT_MODEL`, `DEFAULT_EFFORT`), and the type guards (`isModel`, `isEffort`) that narrow a stray Select string back to the wire union. Option `value`s are typed against the exported wire `Model`/`EffortLevel`, so a typo won't compile. Labels are i18n **keys**, resolved with `t()` at the view boundary, not literal strings.
- **`src/renderer/src/rail/__tests__/run-controls.test.ts`** — assert the option lists hold exactly the in-scope values and that the guards accept valid values / reject strays.

Delivers the single source of truth for what the selectors offer, independently testable without a DOM. No UI yet.

### 4. Composer selectors + wiring + i18n — `feat`

- **`src/renderer/src/rail/RailComposer.view.tsx`** — add a model `Select` and an effort `Select` (Base UI Select — fetch https://base-ui.com/react/components/select.md first) in the footer row, to the left of the `ml-auto` Send/Stop button. New props: current `model`/`effort` values, `onModelChange`/`onEffortChange`, and the (already-label-resolved) option lists. Stays a pure `.view.tsx` (no hooks, no `window.api`); the type-guarded `onValueChange` pattern from `SettingsDialog` drops stray values. Design tokens only; animate with Motion where natural.
- **`src/renderer/src/rail/ConversationRail.view.tsx`** — thread the new composer props through to `RailComposer`.
- **`src/renderer/src/rail/ChatRail.controller.tsx`** — hold `model`/`effort` in `useState` (defaults from `run-controls`), resolve option labels with `t()`, pass values + change handlers down, and call `agent.setRunState({ model, effort })` in `submit()` before `runAgent()`.
- **`src/renderer/src/i18n/en.json`** — add the model/effort label keys and the two selector `aria-label`s.
- **`src/renderer/src/rail/__tests__/RailComposer.view.test.tsx`** (new) — render with props, assert both selectors show their options and that `onModelChange`/`onEffortChange` fire with the chosen value. Extend **`ConversationRail.view.test.tsx`** / **`ConversationRail.controller.test.tsx`** as needed for the threaded props and the `setRunState`-on-submit wiring.

Delivers the visible feature end to end. Watch the budget — if the view + controller + tests approach the limit, split the controller wiring into its own commit after the view.

### 5. Extend the rail e2e spec — `test`

- **`e2e/rail.e2e.ts`** — assert the model and effort selectors render in the composer with their default values (Opus 4.8 / Medium) and that each can be opened and a different option selected. Rides the **existing** manifest ids `rail` (feature) and `agent.run` (operation) — **no `e2e/coverage-manifest.ts` change needed** (the selection rides the already-covered `agent:run` channel). Keep the e2e to presence/interaction; the wire is covered by the step 1–2 unit tests.

### 6. Remove the plan — `docs`

When every step above is shipped and green, delete `docs/plans/chat-model-effort-selector.md` as its own `docs:` commit (handled by `finish-plan`).

## Constraints

- **Layering / no business invention.** Pure passthrough of an existing per-run `state`; no new use case, port, or IPC channel. The only contract change is widening the `Model` union (kept in sync across the two duplicated declarations) and exporting the wire unions.
- **Component types.** `RailComposer.view.tsx` stays a pure view (lint-enforced: no hooks, no `window.api`); selection state lives in `ChatRail.controller.tsx`. Selectors use Base UI Select; any overflowing option list would use `Scrollable` (two/three options won't overflow).
- **Tokens / Motion / i18n.** Design-token palette only, no arbitrary/fractional Tailwind values; Motion for interaction; every user-facing string via `t()`.
- **No new dependencies.** Base UI Select, Motion, react-i18next, TanStack Query are all already present.
- **Commit-size budget.** ≤300 weighted `src/` lines, ≤15 source files, tests land with their code. Steps are sliced to fit; split step 4 further if it approaches the limit.

## Open questions

- **Persistence of the selection.** Should the model/effort choice persist across sessions (like the theme in `useSettings`) or stay per-session? **SETTLED for now:** in-memory in the chat controller, no persistence; defaults `claude-opus-4-8` / `medium`. Revisit if the user wants it remembered (would move the state into `useSettings` / a settings store and is a separate, additive change).
- **Per-thread vs global selection.** The choice currently applies to the whole session via `agent.setRunState`. Whether a resumed thread should restore the model/effort it last ran with is out of scope here.
