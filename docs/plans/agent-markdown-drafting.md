# Agent text authoring — insert anywhere + multi-paragraph

**v1 goal (the only goal):** the writing agent can reliably **add text wherever it wants** in a file —
at the **start**, the **end**, or the **middle (after a named passage)** — and **edit existing text**,
with **more than one paragraph** supported everywhere. Form follows function: this branch does whatever
makes that work and reliable, even new tools and refactors, and is **not** constrained by the current
Review-panel UI (which the team is reworking separately). Limitations that result are documented at the
bottom so the next pass can pick them up. We simplify/polish _after_ it works.

Two things block this today:

1. **No insert capability.** The only acting edit tool is `propose_edit`, which _replaces_ an existing
   passage. There is no way to add text at a point — so the agent cannot write into an empty document
   or append/insert without consuming existing text.
2. **Inserted/replaced content collapses.** `acceptProposal` applies every proposal with
   `tr.insertText` (`proposals.ts:127`), which writes flat inline characters: `'a\n\nb'` becomes one
   paragraph and `'# H'` becomes literal `#`. Multi-paragraph and structure are impossible.

The fix is proven. `@tiptap/markdown@3.26.0` (already in the build) exposes a typed
`editor.markdown.parse(md): JSONContent` returning real nodes (`{ type:'doc', content:[…] }`; confirmed
in `node_modules/@tiptap/markdown/dist/index.d.ts` line 86). Parsing the agent's `text` as markdown and
inserting the resulting **nodes** gives real paragraphs/headings/lists. It is the same parser the app
already uses to load files (`useEditorFileSync.ts:47`), and `get_content` already returns the document
as markdown — so markdown is the consistent currency end to end.

## Tool surface (reliability first — what the model must get right)

Reliability comes from **tool choice and unconditionally-required fields**, never from an optional field
whose presence silently changes meaning. `text` means the same thing in every tool — **the content you
are writing, as markdown.**

- **`insert_at`** — `{ path, text, position }`, `position` enum `"start" | "end"`. Insert `text` at the
  document start or end. (Covers **beginning** and **end**, incl. drafting into an empty doc.)
- **`insert_after`** — `{ path, text, anchor }`. Insert `text` immediately after the block containing
  the exact `anchor` passage. (Covers **middle**.)
- **`propose_edit`** — `{ path, passage, text }`. Replace the exact `passage` with `text`. (Covers
  **edit existing text**, including replacing one paragraph with several.) Renamed from today's
  `{ text, replacementText }` so `text` is the new content in every tool.

Every tool stages a **proposal** the user reviews and Accepts/Rejects, and every proposal applies as
**real nodes** on Accept. `insert_*` are new mutating tools; adding them to `agentToolSpecs` auto-grants
them via `build-options.ts` (`mcp__frontend__<name>`) with no main-process wiring.

## Internal model (uniform — no per-proposal branching)

One `Proposal`, every proposal content-based:

- `content: JSONContent` — the parsed nodes (parsed **once**, at proposal creation). Drives both the
  preview and the applied result, so they cannot diverge.
- `originalText: string` — the replaced span's text (`''` for a pure insert), kept for the
  conflict/drift check.
- `replacementText: string` — the raw markdown source, retained only so the (interim) rail card isn't
  blank; not used for applying.

`from === to` is a pure insert; `from < to` replaces that span. **`acceptProposal`** inserts `content`
over `[from, to)` via TipTap content-insertion (`insertContentAt`/`insertContent` with the JSON), in one
atomic dispatch that also removes the proposal — replacing the `tr.insertText` path entirely. A single
inline-only paragraph inserts as its inline fragment (small edits stay inline); multi/block content
lands as blocks. The conflict pre-check (`proposals.ts:117`) is kept: a replace whose span text drifted
conflicts; a zero-width insert never conflicts (documented).

**Decoration (the red/green preview):** replaced span `[from, to)` is shown struck/red; the new
`content` is rendered **formatted and green** via the editor schema
(`DOMSerializer.fromSchema(editor.schema).serializeFragment`) in a widget. The `ProposalsExtension`
plugin closes over `this.editor` to reach the schema. This replaces the `diffWords` word-level path
(`proposal-decorations.ts`) with block/span-level red-green that supports structure. (Word-level
precision within a sentence is a documented follow-up.)

## Done

A writer can: draft a multi-paragraph chapter into an **empty** file (one proposal → multiple paragraph
nodes on Accept); **append** paragraphs at the **end**; **insert** a paragraph in the **middle** after a
named sentence; and **rewrite** a paragraph (including into several). `npm run lint`, `npm run test`
(incl. the e2e coverage audit), `npm run type-coverage`, `npm run build` green; `npm run test:e2e` green
incl. the new real-agent spec. The independent **change-validator** proves the four scenarios in
"Validation" against the real app with live Claude runs.

## Steps

Each step is one mini-commit, independently green, within budget (≤300 weighted `src/` lines, ≤15
files, code >30 lines lands with a test). Renderer-only except step 6 (`src/main`) and step 7 (`e2e/`).

### 1. [frontend] Make the proposal apply as nodes (core mechanic)

- `src/renderer/src/editor/extensions/proposals.ts` — add `content: JSONContent` to `Proposal`;
  `createProposal` stores it; `mapProposal` carries it unchanged (the JSON is position-free — do not map
  inside it). Rewrite `acceptProposal` to insert `content` over `[from, to)` via content-insertion in a
  single dispatch that removes the proposal, keeping the conflict pre-check; remove the `insertText`
  path.
- `src/renderer/src/agent/tools/tool-propose-edit.ts` — parse the new text via `editor.markdown`
  (null-guard; never cast), store `content` (+ `replacementText` = source). Keep `not_found`/`ambiguous`
  /overlap recoverable.
- Tests — `proposals` accept test: `'first\n\nsecond'` → two paragraph nodes, `'# H'` → a `heading`;
  `tool-propose-edit` test updated; a multi-paragraph replace applies multiple blocks.
- Delivers: proposals apply real nodes; multi-paragraph replace works. Tests green.

### 2. [frontend] Rename `propose_edit` to the consistent `{ path, passage, text }`

- `src/renderer/src/agent/tools/specs.ts` — `proposeEditTool` params `{ path, passage, text }`;
  description: replace the exact `passage` with markdown `text`.
- `tool-propose-edit.ts` — args `{ path, passage, text }` (`passage` resolved, `text` is the content).
- `src/renderer/src/editor/useEditorTools.ts` — update the `propose_edit` `assertWire` shape.
- Tests/prompt updated. Delivers: one consistent `text` meaning. Tests green. (The live `artifacts.e2e`
  still passes — same replace, the agent reads the new spec.)

### 3. [frontend] Add `insert_at` and `insert_after`

- `specs.ts` — `insertAtTool` (`path`, `text`, `position` enum) and `insertAfterTool` (`path`, `text`,
  `anchor`); add both to `agentToolSpecs`.
- `src/renderer/src/agent/tools/tool-insert-text.ts` — handlers: parse `text` via `editor.markdown`;
  `insert_at` resolves the point (`start` ⇒ doc start; `end` ⇒ doc end); `insert_after` resolves
  `anchor` via `resolveAnchor` then lifts to the **end of the anchor's containing block** (`$pos.after`),
  not the raw char position, so the new block lands after the block (not splitting it). Create a
  content proposal at the zero-width point. Recoverable on `not_found`/`ambiguous`.
- `useEditorTools.ts` — register both entries + `assertWire` shapes.
- Tests — `tool-insert-text.test.ts`: start-into-empty, end, after-anchor lands after the block;
  recoverable failures.
- Delivers: insert anywhere, multi-paragraph. Tests green.

### 4. [frontend] Block/span red-green decoration for the proposal

- `src/renderer/src/editor/extensions/proposal-decorations.ts` — render the replaced span `[from, to)`
  struck/red and the new `content` formatted/green via `DOMSerializer` in a widget; remove the
  `diffWords` path. Keep the conflicted styling.
- `proposals.ts` — the plugin closes over `this.editor` so `activeDecorations` can reach the schema.
- Editor stylesheet (`App.css`) — added-block / dimmed-removed styles using existing tokens.
- Test — the builder produces the widget for a content proposal.
- Delivers: red/green preview that supports structure. Tests green.

### 5. [frontend] Fix the empty-editor placeholder / proposal overlap

- `placeholder.ts` and/or the editor stylesheet — suppress/position the empty-state placeholder while a
  proposal occupies an otherwise-empty document (today they render on top of each other).
- Delivers: clean empty-doc insert render (covered by the step-7 e2e + validator).

### 6. [backend] Teach the agent the three acting tools

- `src/main/adapters/agent/claude/logic/agent-system-prompt.ts` — describe `insert_at` / `insert_after`
  (add content at start/end or after a passage; write a whole multi-paragraph draft in **one** call as
  markdown — never chain inserts) and `propose_edit` (`passage` + markdown `text`). **Remove** the
  blanket "no markdown headings, no bullets" prohibition (line 25) for drafted content; keep
  voice-matching and scope-matching. Update `__tests__/agent-system-prompt.test.ts`.
- Delivers: the model uses the tools correctly. Tests green.

### 7. [e2e] Real-agent spec: insert multi-paragraph, empty and mid-document

- `e2e/agent-text-authoring.e2e.ts` (template `e2e/artifacts.e2e.ts`): (a) empty file → ask for a
  several-paragraph draft → assert one proposal → Accept → assert multiple paragraph nodes; (b) non-empty
  file → insert after a named sentence → assert it lands between the right blocks. Capture wire args via
  `agent:tool-call` (`src/shared/ipc/ipc-event-contract/agent.ts`, `window.api.on` in the page);
  assert `path` present and `text` carries markdown. Settle on the **proposal card appearing**, not the
  "Worked" header (which only renders for tool turns).
- `e2e/coverage-manifest.ts` — add the manifest id (e.g. `feature:agent-text-authoring`) with the
  `@e2e` tag in the spec.
- Delivers: the headline capability proven on the real app. e2e + coverage audit green.

### 8. [docs] Remove the plan

- Delete `docs/plans/agent-markdown-drafting.md` in its own `docs:` commit (via `finish-plan`).

## Constraints

- **No new dependencies** — `@tiptap/markdown`, `@tiptap/pm` already present.
- **No escape hatches** — null-guard `editor.markdown` (typed `MarkdownManager | undefined`); no `as`
  (except `as const`), no `!`, no `eslint-disable` / `@ts-*`.
- **Don't change the shared resolver's contract** — `resolveAnchor` stays exact/single-block;
  `create_annotation` and the acting tools depend on it.
- **Both locales** — any new user-facing string in `en.json` **and** `es.json` (parity test).
- **No IPC contract change** — `agent:tool-call`/`agent:tool-result` already carries any frontend tool.
- **No emojis / no attribution footers.** Branch `feat/agent-text-authoring`; never commit on a trunk
  branch; never self-merge.

## Validation (agent-facing — green checks are not proof)

The `change-validator` + the step-7 e2e must drive **live Claude runs** and prove, capturing wire args
each time (confirm `path` present, `text` carries markdown):

1. Multi-paragraph **insert into an empty doc** (`insert_at` `start`) ⇒ Accept ⇒ multiple paragraph
   nodes.
2. Multi-paragraph **append at the end** (`insert_at` `end`).
3. **Insert in the middle** (`insert_after` + `anchor`) after the right block.
4. **Edit existing text** via `propose_edit` (incl. one paragraph → several).

## Limitations & follow-ups (hand-off for the next pass)

These are intentionally out of v1 — the branch achieves the goal; these are where to pick up:

- **Review-panel cards need rework.** The interim card ([ProposalCard.view.tsx](../../src/renderer/src/artifacts/ProposalCard.view.tsx)) renders `originalText`/`replacementText` as plain strings; for a draft/insert it will show the raw markdown source (or, for a pure insert, just the new text) — not the formatted preview. The in-editor decoration is the real preview. Card redesign is owned separately (already planned).
- **Word-level diff precision.** v1 shows block/span-level red-green. Per-word red/green _within_ an edited sentence (today's `diffWords`) is removed; reintroduce as a refinement if the precise small-edit diff is wanted.
- **Multi-block region replace.** Replacing a region spanning several blocks (e.g. H1+H2+list) in one call is out — the resolver matches single-block text only. Needs a second anchor or a block-aware resolver.
- **`before` position.** Only `start`/`end`/`after` ship; add an explicit "before a passage" insert if a real need appears.
- **Pure inserts never conflict** (`from === to` makes the drift check vacuous) — fine for v1; revisit if insert-point drift becomes a problem.

## Settled decisions

- **Split insert tools** (`insert_at` + `insert_after`) over a single tool with a conditional `anchor` —
  tool choice + always-required fields is the reliable discriminator.
- **Uniform content-based proposals** (no `edit`/`draft` kind) — one accept path, one decoration path.
- **`propose_edit` renamed** to `{ path, passage, text }` (wire only; internal `replacementText`/
  `originalText` field names unchanged to bound the diff).
