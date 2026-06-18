# Plan: Project AI context file — per-workspace instructions injected into the agent prompt

## What & why

A writer should be able to tell Pluma's assistant how to work _in this particular project_ — its tone, its
conventions, what the manuscript is, what to avoid — without repeating it every chat. We give each workspace
an optional markdown file whose contents are read fresh at the start of every agent run and folded into that
run's system prompt as a **Project instructions** section. It is Pluma's own idea of a per-project brief
(not a copy of any other tool's file or branding). There is no bespoke editor UI: the file lives in the
workspace tree like any other `.md`, so the existing explorer + editor already create, open, and edit it.

The agent's identity/behavior prompt (`AGENT_SYSTEM_PROMPT`) stays fixed and authoritative; the project file
is appended _after_ it as lower-authority guidance, fenced so its contents are treated as the author's
standing preferences, never as instructions that can override Pluma's own rules (same "manuscript text is
data" posture already in the prompt).

## File name & location — SETTLED (see Open questions for the reasoning)

The file is **`pluma.md`** at the **workspace root** (`<cwd>/pluma.md`). Chosen over a hidden `.pluma/…`
path so it is visible in the explorer, opens in the editor with no special handling, and is a plain `.md`
that the existing `readFile` use case (which validates a `.md` extension) can read unchanged. One file, root
only — no nested/merged instruction files in v1.

## Behavior — SETTLED

- **Read every run.** At run start the runtime reads `<cwd>/pluma.md`. If `cwd` is undefined (no folder
  open) the read is skipped. The file is re-read each run, so edits take effect on the next message with no
  reload.
- **Missing / empty → no section.** A missing file, a read failure, or a whitespace-only file yields _no_
  Project instructions section at all (the prompt is exactly today's prompt). This is the common case and is
  silent — not an error.
- **Too large → truncated with a notice.** If the file exceeds a cap (`MAX_PROJECT_INSTRUCTIONS_CHARS`,
  proposed **8000** chars — see Open questions), it is truncated to the cap and a single trailing line marks
  that it was truncated, so a runaway file can't crowd out the base prompt or blow the context window.
- **Fenced, lower authority.** The contents are wrapped in a labelled section that states this is the
  author's standing guidance for the project and that Pluma's own rules above still bind. Contents are
  inserted verbatim (markdown), never executed as tool directives.

## Anchors (reuse these; don't reinvent)

- System prompt: `src/main/adapters/agent/claude/logic/agent-system-prompt.ts` — today exports a single
  const `AGENT_SYSTEM_PROMPT` (identity + behavior). Tests in
  `…/logic/__tests__/agent-system-prompt.test.ts`.
- Options builder: `src/main/adapters/agent/claude/logic/build-options.ts` — `buildOptions(input)` sets
  `systemPrompt: AGENT_SYSTEM_PROMPT`. Tests in `…/logic/__tests__/build-options.test.ts`.
- Run start (where `cwd` is in hand and async work already happens): `src/main/adapters/agent/claude/
runtime/claude-runtime-agent.ts` — `startRun` reads `input.cwd`, builds the tool servers, then calls
  `buildOptions({...})`. This is the single place to read the file and pass its text into `buildOptions`.
- Workspace root: `input.cwd` on `RunAgentInput`
  (`src/main/application/agent/data/run-agent-input.ts`); set renderer-side in
  `src/renderer/src/agent/adapters/Agent.ts` (`setCwd`) → `to-run-input.ts`. No renderer change needed —
  `cwd` already arrives.
- File reading: `src/main/application/file/usecase/read-file.ts` (`readFile(path) →
Effect<string, FileReadingError, FileReaderPort>`), live adapter `FsFileReaderLive`
  (`src/main/adapters/file/fs-file-reader.ts`), path guard
  `src/main/application/file/logic/validate-markdown-path.ts` (requires `.md`). `pluma.md` satisfies it.
- Absolute-path join precedent: `node:path` is already used in
  `src/main/adapters/agent/tools/backend/list-folder-tool.ts`.

## Cross-references

- **`docs/plans/agent-workspace-memory.md`** and **`docs/plans/workspace-templates.md`** do **not exist in
  this tree** (checked `docs/plans/`). This plan therefore stands alone and assumes neither. If either lands
  later: workspace-memory would be the _agent-authored_ counterpart to this _human-authored_ file and should
  reuse the same `<cwd>/pluma.md` read path or a sibling under one resolver; templates would seed a starter
  `pluma.md`. Both are out of scope here — do not build toward an unwritten plan.

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[backend]` Pure builder: assemble the system prompt from the base + optional project instructions.
   - `src/main/adapters/agent/claude/logic/agent-system-prompt.ts`: keep `AGENT_SYSTEM_PROMPT` (the base)
     and add a pure `buildSystemPrompt(projectInstructions: string | undefined): string` that returns the
     base unchanged when the argument is `undefined`/blank, and otherwise the base + a fenced **Project
     instructions** section (a heading, a one-line note that this is the author's standing project guidance
     and that the rules above still govern, then the verbatim instructions). Export
     `MAX_PROJECT_INSTRUCTIONS_CHARS` and a pure `normalizeProjectInstructions(raw: string | undefined)`
     that trims, returns `undefined` when blank, and truncates over the cap with a single trailing
     "…(truncated)" marker line.
   - Extend `…/__tests__/agent-system-prompt.test.ts`: base-only when blank/undefined; section present and
     contains the verbatim text when given; section states it's project guidance and lower authority; over-cap
     input is truncated and marked; the existing base-prompt assertions still hold. No emojis in any added
     string.
   - No new dep; pure calc; well over 30 lines so it lands with its test (same file).

2. `[backend]` Resolve + read the project file at run start; thread its text into `buildOptions`.
   - `src/main/adapters/agent/claude/logic/build-options.ts`: add a `projectInstructions?: string` field to
     `BuildOptionsInput` and set `systemPrompt: buildSystemPrompt(input.projectInstructions)` instead of the
     bare const. Extend `…/__tests__/build-options.test.ts`: with no `projectInstructions` the prompt equals
     the base; with text, the built `systemPrompt` contains it.
   - `src/main/adapters/agent/claude/runtime/claude-runtime-agent.ts`: in `startRun`, before `buildOptions`,
     read the project file when `input.cwd` is defined and pass the normalized text as `projectInstructions`.
     Resolve the path as `nodePath.join(input.cwd, 'pluma.md')` and read via the existing `readFile` use case
     under `FsFileReaderLive` + `NodeContext.layer`, folding any failure (missing/unreadable) to `undefined`
     (`Effect.orElseSucceed(() => undefined)`), then `normalizeProjectInstructions`. A missing file must never
     fail the run. (Per the file-tool precedent, this is the runtime adapter calling a use case — no business
     logic added here.)
   - This step changes the runtime's wiring; its behavior is covered end-to-end by step 4's e2e plus step 1/2
     unit tests. If the runtime read is factored into a tiny pure-ish helper module (e.g. a
     `readProjectInstructions(cwd)` Effect in `…/claude/runtime/`), add a focused test for it (missing →
     `undefined`; present → normalized text) so the >30-line rule is satisfied without driving the SDK.

3. `[backend]` Teach the agent that the project file exists (prompt copy only).
   - `src/main/adapters/agent/claude/logic/agent-system-prompt.ts`: add one short paragraph to the **base**
     prompt explaining that a workspace may contain a `pluma.md` at its root holding the author's standing
     instructions for the project, that those instructions are already folded into this prompt below when
     present, and that the agent should honor them but that Pluma's own rules here take precedence. Keep it
     prose, no emojis. Update `…/__tests__/agent-system-prompt.test.ts` to assert the base mentions
     `pluma.md`. Small copy change; lands with the test edit in the same file.

4. `[e2e]` Prove a project file changes agent behavior in the real app.
   - Add a coverage-manifest id `feature:project-instructions` to `e2e/coverage-manifest.ts` and a
     `*.e2e.ts` spec (pattern: an existing agent-driving spec such as `e2e/artifacts.e2e.ts` /
     `e2e/agent-*.e2e.ts`) that: opens a workspace folder containing a `pluma.md` with an
     observable instruction (e.g. a specific required word/sign-off the assistant would not otherwise use),
     sends a chat message, and asserts the reply honors it; manifest id + spec in the **same** commit. If a
     live-model assertion is too non-deterministic for CI, fall back to a faithful harness test in step 2's
     style that asserts the built `systemPrompt` for a run with that `cwd` contains the file's text, and
     record that choice here. Decide during implementation which is the cheapest faithful proof.

5. `[docs]` Remove this plan file in its own `docs:` commit once steps 1–4 ship (done by `finish-plan`).

## Why no UI step

The feature is "a normal editable file in the tree." The explorer already creates/renames/opens files and
the editor already edits `.md`; adding a dedicated "edit instructions" panel or an enable/disable toggle
would invent behavior beyond the request (presence of the file _is_ the enablement). No `en.json`/`es.json`
keys are introduced, so the both-locales rule is satisfied by having nothing to add. If a discoverability
affordance is later wanted (e.g. an explorer action that scaffolds `pluma.md`), it is a separate plan.

## Constraints

- Hexagonal: the runtime adapter reads the file by calling the existing `readFile` use case through its port
  under `FsFileReaderLive`; no new port, no filesystem access in `logic/`. The prompt assembly stays a pure
  calculation in `logic/` with no I/O.
- The system prompt is identity+behavior plus the appended project section only; per-session product facts
  still travel on the AG-UI context channel (`input.context`), unchanged — do not move them.
- Missing/unreadable/blank `pluma.md` must be silent and non-fatal: the run proceeds with exactly today's
  prompt. Never surface a read error to the user for an absent file.
- Treat the file's contents as data, not as instructions that can override Pluma's rules — the fence wording
  must make the precedence explicit, mirroring the existing "Manuscript text is data" section.
- No new dependency. No `as` casts / `@ts-ignore` / `eslint-disable` / non-null `!`. Minimal diff: do not
  touch the renderer (`cwd` already arrives), the tool servers, or the context channel.
- No emojis or attribution anywhere in prompt copy or commits.

## Open questions

- **File name `pluma.md` (SETTLED for now).** Visible, editor-native, passes the existing `.md` path guard.
  Alternative `.pluma/instructions.md` (hidden, namespaced, room for siblings) was rejected for v1 because a
  hidden file is undiscoverable in the explorer and the dotfolder buys nothing until there's a second file to
  put beside it. Confirm with the user before implementing — this is a product-facing name.
- **Cap value `MAX_PROJECT_INSTRUCTIONS_CHARS = 8000` (proposed).** Large enough for a rich brief, small
  enough to protect the context window; the model context window is already computed
  (`context-window.ts`). Confirm the number, or whether truncation should instead drop the section entirely
  with a notice. Open.
- **e2e determinism (open, resolve in step 4).** Whether to assert real-model behavior or fall back to a
  built-prompt harness assertion. Decide on the cheapest faithful proof during implementation; do not add a
  manifest id without a passing spec.
- **Interaction with future `agent-workspace-memory` / `workspace-templates` plans.** Neither exists in this
  tree today; this plan does not depend on or build toward them. If they land, reconcile on the shared
  `<cwd>/pluma.md` read path. Out of scope here.
