# Plan: Humanize the agent activity / step log

## What & why

The rail's per-turn activity timeline today is technical: each tool step is labelled with the **raw**
namespaced tool name the SDK reports (`mcp__frontend__list_open_files`, `mcp__backend__read_file`, …) and,
when a result lands, its **meta** line shows the tool's serialized JSON output verbatim (and the raw error
string on failure). That reads like a debug log, not something a writer wants to watch.

This change makes the step log writer-friendly, with three pieces, all **renderer-only**:

1. **Friendly, translated labels** — map each internal tool name to a human, present-tense phrase in both
   locales (e.g. `list_open_files` → "Viendo qué archivos tienes abiertos…" / "Checking which files you have
   open…", `read_file` → "Reading the file…" / "Leyendo el archivo…"). Unknown tool names fall back to a
   generic phrase so a new tool never shows a raw `mcp__…` name.
2. **Hide the raw JSON by default** — a settled step shows only its friendly label and a success/failure
   check; the technical input/output/error JSON is hidden.
3. **An optional reveal toggle** — a lucide `Eye` / `EyeOff` button per step (or per timeline) reveals the
   technical detail (the tool's args **and** its serialized result/error) for power users.

The tool names already arrive at the renderer as `mcp__<serverKey>__<toolName>` (serverKey ∈
`frontend`/`backend`); nothing on the wire or in the backend changes. Note the existing memory constraint:
the activity header renders **only for tool turns**, never for text-only replies — this change must not make
a text-only turn grow a header.

## Done

- In the rail, each agent tool step shows a friendly, localized phrase instead of the raw `mcp__…` name —
  verified in both `en` and `es`.
- A settled step shows **no raw JSON** by default — only the friendly label + the success/failure glyph.
- Each step (or its timeline) has an eye toggle that, when activated, reveals the technical input args and
  the serialized output/error; toggling again hides it. The toggle is keyboard-accessible and labelled via
  `t()` in both locales.
- An unknown / unmapped tool name renders the generic fallback phrase, never a raw name.
- A text-only assistant reply still shows no activity header (the tool-turn-only rule holds).
- `npm run lint`, `npm run test` (incl. the e2e coverage audit), `npm run type-coverage`, `npm run build`
  green; `npm run test:e2e` green (UI change).

## Anchors (real code, read these — don't reinvent)

- Projection that builds the steps: `src/renderer/src/rail/conversation-rows.ts` — `createConversationRows(labels)`
  maps each `RawStep` to a `LogEntry` via `StepLabels.calling/done/failed(toolName)`. `toolName` here is the
  **raw** `mcp__…` name; `meta` is the tool's serialized result string. This is where the friendly label is
  selected and where the per-step **input args** are currently dropped (only `meta`/result is kept).
- Step labels source: `src/renderer/src/rail/ChatRail.controller.tsx` — `stepLabels(t)` wires
  `t('rail.calling'|'done'|'toolFailed', { tool })`; `activityLabels(t)` wires the header labels.
- Status/data vocabulary: `src/renderer/src/rail/step.ts` — `LogEntry { id, status, text, meta?, toolName? }`,
  `LogStatus`, `RunStatus`.
- Row views: `src/renderer/src/rail/LogRow.view.tsx` (per-step glyph + the `meta` mono line — today shows raw
  JSON), `src/renderer/src/rail/Activity.view.tsx` (collapsible header + `Timeline`),
  `src/renderer/src/rail/AssistantRow.view.tsx`, `src/renderer/src/rail/Conversation.view.tsx`.
- Read hook: `src/renderer/src/rail/useRailConversation.ts` — calls `createConversationRows(labels)(agent.messages)`.
- The raw tool names to map come from two catalogs (read for the exact `name`s):
  `src/renderer/src/agent/tools/specs.ts` (`list_open_files`, `get_current_selection`, `create_annotation`,
  `propose_edit`, `insert_at`, `insert`) and `src/main/adapters/agent/tools/backend/` (`read_file`,
  `list_folder`, `create_file`, `rename_file`, `delete_file`). The MCP prefix is assembled in
  `src/main/adapters/agent/claude/logic/build-options.ts` as `mcp__${serverKey}__${name}`.
- i18n: `src/renderer/src/i18n/locales/en.json` + `es.json`, `rail.*` block (existing `calling`/`done`/
  `toolFailed`/`thinking`/`worked`/`runFailed`, etc.). Add a `rail.tool.*` map and a `rail.reveal`/`rail.hide`
  label, in BOTH files (locale-parity test enforces parity).
- lucide-react for icons (hand-rolled `<svg>` is lint-banned). `Eye`/`EyeOff` exist there.

## Design decisions

- **Strip the MCP prefix, then map by bare tool name.** A small pure calc takes a raw `mcp__frontend__insert`
  and yields the bare `insert`; the label map is keyed by bare name. Keeping the calc pure and tested means a
  rename of the prefix scheme can't silently break the mapping.
- **Three states per tool → one translated key family.** A friendly tool entry needs a _calling_ (present
  progressive) and a _done_ (past/neutral) phrase. The simplest shape that keeps both locales in parity is a
  per-tool key under `rail.tool.<name>.{calling,done}` plus a shared `rail.tool.fallback.{calling,done}`. The
  failed state reuses `done` text styled as failed by the existing glyph/dim, so we do **not** invent a third
  per-tool string (avoids a 3× key explosion and matches today's behavior where failure is shown by the glyph,
  not new copy).
- **Reveal is renderer-local view state, not persisted.** Power-user detail is ephemeral; a per-row override
  map mirrors the existing `overrides` pattern in `ChatRail.controller.tsx` (the timeline-expand map). v1
  reveals at the **timeline** granularity (one eye per assistant row's timeline, next to the existing
  chevron) — simpler than per-step toggles and enough to satisfy "reveal the technical input/output". (A
  per-step toggle is noted in Open questions as a possible follow-up; not built here.)
- **Carry the input args through the projection.** `conversation-rows.ts` currently keeps only the result as
  `meta`. To reveal _input_, the projection must also keep each call's `arguments` string on the entry (new
  optional field, e.g. `input?`). This is pure data plumbing — no new behavior.
- **No backend / no shared change.** The names already reach the renderer; the mapping and toggle are purely
  view concerns. Hexagonal layering is untouched.

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[frontend]` Tool-label calc — map a raw tool name to a friendly label key.
   - `src/renderer/src/rail/tool-label.ts` (new, pure calc): `bareToolName(raw)` strips a leading
     `mcp__<server>__` prefix (passthrough if absent); `toolLabelKey(bareName)` returns the i18n key suffix
     for a known tool or the `fallback` suffix for an unknown one. Keyed by the bare names from the two
     catalogs (`list_open_files`, `get_current_selection`, `create_annotation`, `propose_edit`, `insert_at`,
     `insert`, `read_file`, `list_folder`, `create_file`, `rename_file`, `delete_file`). No React, no IO.
   - `src/renderer/src/rail/__tests__/tool-label.test.ts`: prefix stripping (frontend + backend + no-prefix),
     a known name → its key, an unknown name → fallback.
   - Delivers the name→key resolution the label wiring will use; lands green standalone (pure module + test).

2. `[frontend]` Friendly labels in both locales.
   - `src/renderer/src/i18n/locales/en.json` + `es.json`: under `rail`, add a `tool` map with one entry per
     bare tool name plus `fallback`, each with `calling` and `done` phrases, e.g.
     `rail.tool.read_file.calling = "Reading the file…"` / `.done = "Read the file"`; Spanish
     `"Leyendo el archivo…"` / `"Leyó el archivo"`. Add `rail.reveal` / `rail.hide` (eye toggle labels) and a
     `rail.toolDetailInput` / `rail.toolDetailOutput` caption pair for the revealed block. BOTH files, in
     parity (the parity test guards this). Copy only — no code, weight 0.
   - Delivers the translated vocabulary; no behavior yet, so the app is unchanged and green.

3. `[frontend]` Wire friendly labels into the projection.
   - `src/renderer/src/rail/ChatRail.controller.tsx`: rewrite `stepLabels(t)` so `calling`/`done`/`failed`
     resolve via `toolLabelKey(bareToolName(tool))` to `t('rail.tool.' + key + '.calling'|'.done')` — `failed`
     reuses the `.done` phrase (glyph conveys failure). The `StepLabels` contract (`conversation-rows.ts`)
     stays the same signature, so no projection change is required for labelling.
   - Update `src/renderer/src/rail/__tests__/conversation-rows.test.ts` only if its inline `labels` fake needs
     the new phrasing (it injects its own labels, so likely untouched — keep the diff minimal).
   - Add/extend a controller-level or `tool-label` integration assertion that a raw `mcp__backend__read_file`
     step renders the friendly phrase, not the raw name.
   - After this step the timeline shows friendly labels; raw `meta` JSON is still shown (removed in step 5).
     Green: the only behavior change is the visible label text.

4. `[frontend]` Carry tool input through the projection (data plumbing for reveal).
   - `src/renderer/src/rail/step.ts`: add optional `input?: string` to `LogEntry` (the call's raw
     `arguments`).
   - `src/renderer/src/rail/conversation-rows.ts`: keep each call's `arguments` on its `RawStep`
     (`stepsFromCalls` reads `call.function.arguments`) and thread it onto the `LogEntry` as `input`.
   - Extend `src/renderer/src/rail/__tests__/conversation-rows.test.ts`: a call's `arguments` lands on the
     entry's `input`; an empty/absent arguments yields no `input`.
   - Pure data only; nothing renders the new field yet, so visuals are unchanged and green.

5. `[frontend]` Reveal toggle + hide raw JSON by default.
   - `src/renderer/src/rail/LogRow.view.tsx`: stop rendering the raw `meta` line unconditionally; gate the
     technical block behind a `revealed` prop. When `revealed`, render a captioned detail block showing the
     step's `input` (under `rail.toolDetailInput`) and `meta` (under `rail.toolDetailOutput`, or the error on
     failure) in the existing mono style. Default (not revealed) shows only label + glyph.
   - `src/renderer/src/rail/Activity.view.tsx`: add an `Eye`/`EyeOff` toggle button (lucide) beside the
     chevron in `Header`, driven by new `revealed` + `onToggleReveal` props; pass `revealed` down to each
     `LogRow`. Label the button via `t('rail.reveal')` / `t('rail.hide')` (passed in as a label prop, keeping
     the view pure). Animate the detail block's appearance with Motion (`motion/react`), respecting
     reduced-motion; tokens only.
   - Thread `revealed`/`onToggleReveal` through `AssistantRow.view.tsx` → `Conversation.view.tsx`, and own a
     per-row `revealOverrides` map in `ChatRail.controller.tsx` mirroring the existing expand `overrides`
     (reset on submit/new-chat like the expand map). Add the reveal labels to `activityLabels`/the labels
     object the views receive.
   - Tests: `src/renderer/src/rail/__tests__/LogRow.view.test.tsx` (new) — hidden by default, revealed shows
     input+output captions, failure shows the error; extend
     `src/renderer/src/rail/__tests__/Activity.view.test.tsx` — toggle button present, click fires
     `onToggleReveal`, `revealed` propagates to rows. Keep each file ≤15 and code-over-30-lines lands a test.
   - This is the largest step; if it crosses the budget, split into 5a (LogRow reveal + its test) and 5b
     (Activity toggle + wiring through AssistantRow/Conversation/controller + its tests).
   - After this step the default log is clean (label + check only) and the eye reveals technical detail.

6. `[e2e]` Real-app coverage.
   - Add a coverage-manifest id (e.g. `feature:agent-step-log-humanized`) to `e2e/coverage-manifest.ts` and a
     `*.e2e.ts` spec (pattern: an existing rail/agent e2e) in the SAME commit: drive a turn that triggers a
     tool step, assert the timeline shows the friendly phrase (not a `mcp__` name) and that no raw JSON shows
     by default, click the eye, assert the technical input/output appears. Manifest id + spec together so the
     audit never goes red.
   - If a live agent run is too flaky/expensive for e2e, fall back to asserting the projection→view path with
     a seeded `agent.messages` fixture in the real app shell (still a real-app spec). Decide in Open questions.

7. `[docs]` Remove this plan file in its own `docs:` commit once all steps ship (performed by `finish-plan`).

## Constraints

- **Renderer-only.** No `src/shared` and no `src/main` changes — the mapping and toggle are pure view
  concerns; hexagonal layering and the IPC `Result` boundary are untouched.
- **No new dependency.** `Eye`/`EyeOff` come from the already-present `lucide-react`; animation uses the
  already-present `motion/react`. No hand-rolled SVG.
- **View/controller split holds.** `*.view.tsx` stays pure props (no hooks, no `window.api`); the reveal
  override map and `t()` resolution live in the controller; label strings are passed in as props.
- **Both locales.** Every new `rail.tool.*`, `rail.reveal`, `rail.hide`, `rail.toolDetail*` key lands in
  `en.json` AND `es.json`; the locale-parity test enforces it.
- **Tool-turn-only header preserved.** Don't render an activity header / eye on a text-only reply
  (`AssistantRow.view` already gates the timeline on `steps.length > 0 || working || error`).
- **Tokens + Motion + `t()`** for all UI; comments explain _why_, not _what_, and cite no plan IDs.
- **Minimal diff / YAGNI.** Don't restyle or refactor the timeline beyond the label/reveal change; failure
  copy reuses the `done` phrase rather than inventing a third per-tool string.
- **Don't invent business behavior.** Friendly phrasing is presentation only; it must not change which tools
  run, their results, or the success/failure status the glyph already encodes.

## Open questions

- **OPEN — toggle granularity.** v1 reveals at the timeline (one eye per assistant row). Acceptable, or does
  the user want a per-step eye? (Per-step is a step-5 variant; affects `LogRow` props and the override map.)
- **OPEN — exact friendly copy.** Need the user's preferred English + Spanish phrasing for all 11 tools (the
  prompt gives two Spanish examples). Blocks step 2's final strings; the keys/structure can land first with
  placeholder copy only if the user approves filling them later.
- **OPEN — failure copy.** Confirm reusing the `done` phrase (glyph conveys failure) is acceptable, vs. a
  distinct "couldn't …" phrase per tool. Defaulting to reuse to avoid a key explosion; blocks step 2/3 wording.
- **OPEN — e2e shape.** Live-agent run vs. seeded-`agent.messages` fixture for step 6 (see the memory on
  flaky live-stream settle races and the rail-abort no-op). Pick the cheapest faithful real-app spec.
- **SETTLED — no backend/shared change.** The raw names already reach the renderer (`mcp__<server>__<name>`),
  so the mapping is renderer-only.
