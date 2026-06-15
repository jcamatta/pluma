# Agent write amplification

Today the agent can only **replace one tracked range in an open file**. That single point-operation is the right tool for surgical edits, but it cannot author a draft, insert text at a point, review many edits as one unit, or touch any file that is not open. This plan adds two capabilities that, together, close those gaps while keeping the human-in-the-loop proposal model intact: a **whole-document diff feed** that derives a reviewable batch of proposals from a rewritten document, and **backend filesystem tools** that let the agent read any file (directly) and create/rename/move/delete files (under an approval gate).

This is a **roadmap** doc covering both additions. It is large for one branch, so it is split into a precursor refactor (**PR 0.0**) plus two tracks (~8 PR-sized plans total), each its own branch sliced into mini-commits. PR 0.0 simplifies the tool surface both additions build on; Track 1 (frontend) and Track 2 (backend-first) are otherwise independent and can proceed in parallel. When a PR ships, lift its slice into a standalone plan file (or work it directly off this doc) and check it off here.

---

## Why: the four failure clusters

The only mutation primitive is `propose_edit(rangeId, replacementText)`, and `rangeId` comes from `get_ranges(text)`, which requires **existing, unique** text in an **open** editor ([tool-propose-edit.ts](../../src/renderer/src/agent/tools/tool-propose-edit.ts), [tool-get-ranges.ts](../../src/renderer/src/agent/tools/tool-get-ranges.ts), [useEditorTools.ts](../../src/renderer/src/editor/useEditorTools.ts)). That shape fails in four ways:

| #   | Scenario                                          | Read need                      | Write need               | Works today?                                   | Cluster       |
| --- | ------------------------------------------------- | ------------------------------ | ------------------------ | ---------------------------------------------- | ------------- |
| 1   | Empty doc → "write a draft of chapter 3"          | nothing                        | insert a whole document  | **✗** `get_ranges` fails on empty text         | A — authoring |
| 2   | Big doc → "fix any typo"                          | whole doc                      | many tiny replaces       | **△** per-span works; no batch, ambiguity pain | C — pervasive |
| 3   | "Rewrite this paragraph" (selected)               | selection                      | one span replace         | **✓**                                          | —             |
| 4   | "Past → present tense across the chapter"         | whole doc                      | pervasive small edits    | **△** same as #2                               | C — pervasive |
| 5   | "Insert a new scene between two paragraphs"       | local                          | **insertion at a point** | **✗** `propose_edit` only replaces             | B — insertion |
| 6   | "Move chapter 5's opening into chapter 2"         | another, maybe **closed** file | cross-file + move        | **✗** open-only; no move                       | D — scope     |
| 7   | "Rename Anna → Elena across the manuscript"       | **all** files incl. closed     | cross-file batch         | **✗** open-only                                | D — scope     |
| 8   | "Create a new chapter file and write the opening" | n/a                            | create file + author     | **✗** no file creation, no anchor              | A + D         |
| 9   | "Summarize this chapter"                          | whole doc                      | none                     | **✓**                                          | —             |
| 10  | "Flag weak spots in this scene"                   | local                          | annotations              | **✓**                                          | —             |

- **A — No anchor (authoring):** #1, #8. Nothing existing to `get_ranges` against.
- **B — Pure insertion:** #5. `propose_edit` can only replace, never insert.
- **C — Pervasive multi-span:** #2, #4. Works per-span but no grouped review and `get_ranges` errors on ambiguous repeated text.
- **D — Out-of-open-file scope:** #6, #7, #8. Closed/other files, cross-file batch, file-tree ops.

## What we are NOT changing

- **Concurrency is already solved — do not redesign it.** A proposal's range is position-mapped through the user's concurrent edits ([proposals.ts](../../src/renderer/src/editor/extensions/proposals.ts) `mapProposal`): edits **outside** the span remap and the proposal survives; edits **inside** the span conflict it (`acceptProposal` re-checks `originalText`), and the agent re-resolves. This is optimistic concurrency at span granularity — narrower than a CLI's whole-file re-read. The whole-document feed below is deliberately the _escape hatch_, not the default, because a full-document snapshot is invalidated by **any** concurrent edit and because regenerating untouched prose manufactures spurious diffs.
- **Anchor disambiguation stays "grow the text until unique"** — the proven matching logic. PR 0.0 moves it _inside_ the acting tools (the agent passes anchor text directly) instead of through a separate `get_ranges` handle, but the algorithm and its `ambiguous`/`not_found` contract are unchanged. We never adopt before/after context fields.
- **The span `propose_edit` stays the default** for small localized edits. Everything below is additive.

---

## The two additions

### Addition 1 — Whole-document diff feed (Track 1, frontend)

> **This is the hard one. It is not a small addition — it reshapes the review UI, so it needs a design spike before slicing.** Fixes clusters **A, B, C**: a new tool lets the agent return a **rewritten document** (arg named `content`, not `newMarkdown` — the tool name says it's content), and a pure diff derives the change(s). The open design question is _how the change is modelled and rendered_ (Model A vs B below).

- **A:** diff of `"" → content` is one insertion — no anchor needed.
- **B:** a diff natively expresses insertion (`from === to`) — the thing `propose_edit` cannot say.
- **C:** the diff yields all changed spans at once, reviewed together, no manual disambiguation.

**Current UI reality (the constraint that makes this hard).** Proposals and annotations surface as **cards in an Artifacts panel** ([ArtifactsPanel.controller.tsx](../../src/renderer/src/artifacts/ArtifactsPanel.controller.tsx)), folded across every open editor into one flat list by [useOpenArtifacts.ts](../../src/renderer/src/artifacts/useOpenArtifacts.ts) (`useSyncExternalStore` over each editor's `transaction` event; composite key `path::id`). The load-bearing invariant: **exactly one artifact is active at a time**, and only the active one renders its inline word-diff decoration ([proposals.ts](../../src/renderer/src/editor/extensions/proposals.ts) `activeDecorations` → single `activeId`; [proposal-decorations.ts](../../src/renderer/src/editor/extensions/proposal-decorations.ts) renders `diffWords(original, replacement)` via the existing `diff` dep). A "group of proposals" breaks that single-active invariant — that is the core difficulty, not the diffing.

**The unresolved fork — decide before slicing:**

- **Model A — group of span-proposals.** `propose_document` → diff → N small proposals sharing a `groupId`. _Keeps partial accept_ (reject the one wrong fix), reuses per-span decorations. _Costs:_ a `groupId` in plugin state, group accept/reject in the reducer, **multi-active decorations** (render a whole group inline at once — replaces single-active), and a **group card** abstraction in the artifacts panel that can expand to members and show/hide a path's proposals together. Significant UI surgery.
- **Model B — one proposal per file.** A whole-file change is one ordinary `Proposal` (`from` = doc start, `to` = doc end, `original` = whole doc, `replacement` = new doc). `proposalDecorations` already renders that word-diff inline, so this **reuses nearly everything** — one card per file, existing decoration, existing accept/reject, no new state. _Costs:_ accept is **all-or-nothing** (no partial accept) and the inline diff can be large. Closest to "model proposal-per-path; the card is the file."

**The tradeoff:** partial-accept granularity (A, expensive, breaks single-active) vs whole-file accept (B, cheap, reuses the machinery, all-or-nothing). "Fix all typos" wants A's partial reject; "write a draft" is naturally B. A hybrid is possible (per-file card over A's spans) but is strictly more than A. **A spike must pick one** — likely starting at B for cost, with A as a later refinement only if partial accept proves necessary.

**Exists / add / change (Model-B baseline; A adds the bracketed items):**

- **Exists:** the proposals extension, per-span decorations, the artifacts panel + card interactions, the `diff` dependency (`diffWords`), the tool registry, `useEditorTools`, and the SDK tool server — all reusable as-is for B.
- **Add:** the pure document-diff calculation; a `propose_document` tool (arg `content`); for B, a helper that builds a whole-file `Proposal`; [for A: `groupId` state, group ops, multi-active decorations, a group card].
- **Change:** the system prompt to teach _when_ to use `propose_document` vs `propose_edit`; [for A: `activeDecorations`/the single-active invariant; the artifacts fold to group by `groupId`/path].

### Addition 2 — Backend filesystem tools (Track 2, backend-first)

Fixes cluster **D**, and the "author a new file" half of **A**. **These tools are nothing but our existing application use cases, invoked by the agent** — so the agent goes through the same business logic as the UI (path validation, markdown-extension rules, typed errors), enforced by the ports, not re-implemented in the tool. The backend **already has** them — `create-file`, `read-file`, `rename-file`, `write-file`, `delete-file`, `list-folder` ([application/file](../../src/main/application/file), [application/folder](../../src/main/application/folder)). This addition **exposes them as agent tools**, split by CQS:

> **Open investigation before slicing Track 2:** the blocking human-in-the-loop mechanism is _assumed_, not verified. We must check (a) how the **Claude Agent SDK** wants permissioned/long-running tools handled — its `canUseTool`/permission callback and `PreToolUse` hooks may be the sanctioned gate rather than a hand-rolled suspend; and (b) what **AG-UI** offers for HITL/tool approval over the run stream. The bridge reuse below is a fallback, not a decision. See open questions.

- **Reads (queries) run directly** — no gate, including closed files. A backend SDK tool runs the use case in-process and returns the `Result`. Solves the read side of D.
- **Writes (commands) run under a blocking human-in-the-loop gate** — the tool suspends, emits an approval request to the renderer, and resumes on approve/reject. Reviewed via a **confirmation card in the rail** (no text span to decorate), batched under one approval. `write-file`/`create-file` also give the agent greenfield authoring into a _new_ file (the new-file half of A; authoring into an _open empty_ file is Track 1's `propose_document`).

**Exists / add / change:**

- **Exists:** all the file/folder use cases, ports, and adapters; the bridge suspend/resume keyed by `toolCallId` ([tool-bridge.ts](../../src/main/adapters/agent/claude/runtime/tool-bridge.ts)); `submit-tool-result`; the `Result` IPC boundary.
- **Add:** a backend tool layer that maps these use cases to SDK tools (separate from the renderer-supplied frontend tools, since they run in-process); the approval round-trip channel + a `submit-approval`-style resume; the rail approval card; possibly a `move-file` use case (only `rename-file` exists today — see open questions).
- **Change:** the run wiring to register backend tools alongside the frontend tool server; the system prompt to describe the new tools and the approval contract.

---

## PR breakdown

Each PR is one branch, sliced into mini-commits sized to the budget (≤ ~300 weighted `src/` lines, ≤ 15 source files, code > 30 lines lands with a test). Order within a track is dependency order; the two tracks are independent. PR 0.0 is a precursor Track 1 builds on.

### PR 0.0 — Collapse `get_ranges` into the acting tools _(frontend refactor, precursor)_ — ✅ shipped

> **Landed** on `chore/collapse-get-ranges` across 5 mini-commits, all checks green (lint, 690 unit tests, type-coverage, build) and the `artifacts` + `editor-tabs` e2e specs passing against the real app. The agent now annotates and proposes edits by passing the exact passage text; `get_ranges`, the `rangeId` handle, and the whole `RangesExtension` are gone, and `get_current_selection` is a pure `{ path, text }` read. The text→span resolution lives in one shared [resolve-anchor.ts](../../src/renderer/src/agent/tools/resolve-anchor.ts) that `propose_edit` and `create_annotation` both call, surfacing the same `not_found` / `ambiguous` contract. The system prompt teaches the text-first flow.

Today the agent resolves text → `rangeId` (`get_ranges`) and then acts (`propose_edit`/`create_annotation`) with that handle, and `get_current_selection` mints a `rangeId` too. Nothing consumes the selection's `rangeId`, and the handle is speculative indirection. Collapse it to the proven one-call `Edit` shape: the acting tools take **anchor text** directly and resolve it internally.

**Why first:** it makes the two feeders symmetric — span edits resolve-by-text inline, whole-doc edits diff to spans, and _neither_ leaks a `rangeId` to the agent. Doing it before `propose_document` (PR 1.3) means there is one mental model, not a handle that exists for some tools and not others.

**Change:**

- `propose_edit` and `create_annotation` take `{ path, text, … }` instead of `{ path, rangeId, … }`; the resolve-text logic from [tool-get-ranges.ts](../../src/renderer/src/agent/tools/tool-get-ranges.ts) (`createDocumentTextIndex` + `findMatches`) moves into a shared pure module both call. The acting tools surface the full `ambiguous` (with previews) / `not_found` contract — with a **selection-aware message** when the text came from a selection ("the selected text appears N times; I'll use more context").
- `get_current_selection` becomes a pure read returning `{ path, text }` (bare selected text — _not_ uniquified, to keep `propose_edit`'s "replace exactly what matched" semantics clean). It no longer dispatches a transaction / `setRange`, so it stops mutating editor state — a genuine query.
- Delete the `get_ranges` tool + spec, and the `RangesExtension` / `rangeId` concept once no consumer remains ([ranges.ts](../../src/renderer/src/editor/extensions/ranges.ts), its registration in [extensions/index.ts](../../src/renderer/src/editor/extensions/index.ts), and the wiring in [useEditorTools.ts](../../src/renderer/src/editor/useEditorTools.ts)).
- Update the system prompt ([agent-system-prompt.ts](../../src/main/adapters/agent/claude/logic/agent-system-prompt.ts)): act with anchor text directly; on `ambiguous`, grow the text until unique.

**What we trade:** when selected text is _not unique_, the system no longer acts on the exact highlighted span — it returns `ambiguous` and the agent grows context. Accepted: "rewrite this" selections are effectively unique, acting on the wrong occurrence would be worse than failing, and the error is recoverable. (See the discussion — text-first chosen over keeping a position handle.)

**Slices (mini-commits):**

1. Extract the resolve-text logic into a shared pure module (`*-logic.ts`) + tests (move, no behavior change).
2. `create_annotation` takes `text`, calls the shared resolver, surfaces `ambiguous`/`not_found` (+ updated tests).
3. `propose_edit` takes `text`, same treatment (+ updated tests).
4. `get_current_selection` → pure `{ path, text }` read; drop `setRange` (+ updated tests).
5. Remove the `get_ranges` tool/spec and `RangesExtension`/`rangeId`; update `useEditorTools`, specs, prompt (+ test cleanup). Confirm no remaining consumer first.

These tools are not in the e2e manifest as separate ids (they back existing `propose_edit`/`annotate` features), so no manifest change — but re-run `test:e2e` for the editor/agent specs since the tool surface changed.

### Track 1 — Whole-document diff proposals (frontend)

> Track 1 is gated on a design decision. **PR 1.0 (spike) is non-negotiable** — it picks Model A vs B and validates the chosen render against the real Artifacts UI. The PRs below are written for the **Model-B baseline** (cheapest, reuses the machinery); if the spike picks A, re-slice for `groupId` state + multi-active decorations + a group card before proceeding. Do not assume the slicing until the spike lands.

**PR 1.0 — Design spike (no production code)** _(spike)_

- Decide Model A (group of span-proposals, partial accept, multi-active decorations) vs Model B (one proposal per file, all-or-nothing, reuses single-active). Validate the chosen inline rendering against a realistic whole-doc rewrite in the running app (how a big diff _looks_; whether the Artifacts card list stays legible). Produce a short written decision + a throwaway render check (mockup or a scratch branch), not merged feature code.
- Output: the chosen model recorded here, and the re-sliced PR list if A.

**PR 1.1 — Document-diff pure calculation** _(frontend, pure logic)_

- Add a pure `*-logic.ts`: diff `(oldText, content)` → the change(s) the chosen model needs (B: one `{ from, to, replacement }` spanning the doc; A: minimal disjoint spans with offsets). **Use the existing `diff` dependency** (`diffWords`, already powering `proposal-decorations`) — no new dep. Fully unit-tested: identical → no change; pure insertion (`from === to`); deletion; replacement; empty `oldText` → single insert; (A only) multiple disjoint spans.
- One commit, logic + tests, no UI — green alone.

**PR 1.2 — `propose_document` tool** _(frontend, tool)_

- Add `tool-propose-document.ts` + spec in [specs.ts](../../src/renderer/src/agent/tools/specs.ts): args `{ path, content }`. Handler reads the live editor markdown, runs the diff, and (B) creates one whole-file `Proposal` / (A) stages the span batch. Wire into [useEditorTools.ts](../../src/renderer/src/editor/useEditorTools.ts) as a mutating acting tool; register in [build-tool-server.ts](../../src/main/adapters/agent/claude/runtime/build-tool-server.ts) **not** in the read-only set.
- Update the system prompt ([agent-system-prompt.ts](../../src/main/adapters/agent/claude/logic/agent-system-prompt.ts)): `propose_edit` (text-anchored) for small localized edits, default; `propose_document` only for authoring into an empty/near-empty doc or a sweeping rewrite; never regenerate unchanged prose.
- Tests over a headless editor: empty doc → insert; small change → minimal change; identical → friendly no-op.

**PR 1.3 — Group state + ops** _(frontend, editor state — **Model A only**; skip for B)_

- Only if the spike chose A: `groupId` on `Proposal`; atomic batch staging; `acceptGroup`/`rejectGroup`; step navigation; multi-active decorations replacing single-active. Tests: atomic batch; accept-all/reject-all; step cycles; a conflicted member doesn't block the rest; the single-active invariant's replacement holds across editors.

**PR 1.4 — Review UI + e2e** _(frontend, view/controller + e2e)_

- B: ensure the whole-file proposal renders as one legible Artifacts card + inline diff (likely small changes to labels/sizing, since the card path already exists). A: a group card with accept-all / reject-all / step.
- `en.json` keys, Base UI, design tokens, Motion, `t()`, view/controller split.
- Add the e2e manifest id (`feature:agent-document-rewrite`) + a real-app `*.e2e.ts` driving the agent to a whole-doc rewrite and accepting it. Manifest id + spec in the **same** commit.

### Track 2 — Backend filesystem tools (backend → frontend)

**PR 2.0 — HITL mechanism investigation (no production code)** _(spike)_

- Determine how the **Claude Agent SDK** ([build-tool-server.ts](../../src/main/adapters/agent/claude/runtime/build-tool-server.ts) already uses `tool()`/`createSdkMcpServer`) wants gated tools handled — `canUseTool`, permission modes, `PreToolUse` hooks — vs reusing the renderer round-trip ([tool-bridge.ts](../../src/main/adapters/agent/claude/runtime/tool-bridge.ts) + [submit-tool-result.ts](../../src/main/application/agent/usecase/submit-tool-result.ts)). Check what **AG-UI** (`@ag-ui/*` 0.0.55) exposes for tool approval over the run stream. Output: the chosen approval mechanism recorded here; PR 2.2 re-sliced to match. PR 2.1 (reads, no gate) does **not** depend on this and can proceed first.

**PR 2.1 — Backend read tools** _(backend, queries)_ — ✅ shipped

> **Landed** on `feat/backend-read-tools`. The agent now has two in-process read tools — `read_file`
> (reads any `.md` file by absolute path, including closed ones) and `list_folder` (lists one level from
> the run's `cwd` by default, returning each entry's name/type/absolute path). They invoke the existing
> `readFile`/`listFolder` use cases (no business logic in the tool, no gate — reads are queries). All
> tool code was consolidated under `src/main/adapters/agent/tools/` (SDK-neutral: specs, run handlers,
> catalog, the shared bridge), with the `createSdkMcpServer` binding kept under `adapters/agent/claude/`.
> Validated against the real tool server with a real temp workspace (closed-file read, typed errors,
> absolute-path listing, `cwd` default, `no_workspace`, `readOnlyHint`, no bridge).

- A backend tool layer under `src/main/adapters/agent/claude/runtime/` (or `application/agent`) that maps `read-file` and `list-folder` use cases to SDK `tool()`s running in-process (no bridge), returning the use case `Result` serialized as tool content. Mark `readOnlyHint: true`. Register alongside the frontend tool server in the run wiring.
- Tests: use-case-backed tool returns content for an existing file / typed error for a missing one; list returns entries; closed files are reachable (no editor needed).
- No gate, no UI — green on its own. Solves the read side of D.

**PR 2.2 — Approval round-trip + gated write tools** _(backend, commands + HITL)_

- Add the approval channel: a backend "request approval" that suspends (reuse the bridge pattern keyed by an approval id) and a `submit-approval` resume path mirroring [submit-tool-result.ts](../../src/main/application/agent/usecase/submit-tool-result.ts). On approve, run the use case; on reject, return a typed "declined" result to the agent.
- Map `create-file`, `write-file`, `rename-file`, `delete-file` (and `move-file` if added) to gated SDK tools. Batch a multi-file op under one approval payload (a manifest of paths/actions).
- Tests: approve → use case runs, `Result` returned; reject → declined, no filesystem effect; abort/teardown settles pending approvals (no hang); batch approval covers all members.

**PR 2.3 — Rail approval card + e2e** _(frontend, view/controller + e2e)_

- A confirmation card in the rail rendering the pending approval (action + path(s)) with Approve / Reject, wired to `submit-approval`. Base UI + tokens + Motion + `t()`. View/controller split.
- Add manifest ids — `feature:agent-filesystem-approval`, plus `operation:` ids for each newly user-triggerable channel — and a real-app `*.e2e.ts` that drives the agent to a file create, approves it, and asserts the file appears in the explorer. Ids + spec in the same commit.

### Final step

- Each PR ends by checking its slice off in this doc. When **all** PRs ship, delete this file in its own `docs:` commit ("remove agent-write-amplification plan, complete").

---

## Constraints

- Hexagonal layering: IPC → application; adapters at the edge; `application` never imports `adapters`/`ipc`. Backend tools live in the adapter/runtime layer and depend on use cases through ports.
- CQS: read tools are queries (no gate, direct); write tools are commands (gated). Keep them as distinct tools and paths.
- The IPC `Result` boundary holds: tool outcomes serialize to `{ ok }` discriminated unions with tagged errors; nothing throws across IPC.
- Frontend rules: design tokens only, Base UI primitives, Motion for animation, `t()` for every string, view/controller/plain split, `Scrollable` for any overflow.
- **No new dependency needed for diffing** — `diff` v9 is already a direct dep (`diffWords` powers `proposal-decorations`). Use it.
- e2e: a new user-facing feature or user-triggered channel ships its manifest id **and** real-app spec in the same step.

## Open questions

- **[BLOCKS Track 1] Model A vs B (PR 1.0 spike):** group of span-proposals with partial accept + multi-active decorations (A, expensive, breaks the single-active invariant) vs one proposal per file, all-or-nothing, reusing the existing card + decoration (B, cheap). Recommendation: start at B; add A only if partial accept proves necessary. Decided by the spike. — _open_
- **[BLOCKS Track 1] Whole-doc rewrite legibility:** does a large inline word-diff (and one Artifacts card) actually read well in the current UI, or does it need a different surface? Resolve in the PR 1.0 spike against the running app. — _open_
- **[BLOCKS Track 2 writes] HITL mechanism (PR 2.0 spike):** SDK `canUseTool`/`PreToolUse` vs reusing the renderer bridge round-trip; and what AG-UI offers for tool approval. The bridge reuse is only a fallback. — _open_
- **`move-file` use case:** only `rename-file` exists. Is "move chapter 5's opening into chapter 2" in scope (a cross-directory move and/or partial-content move), or deferred? The cross-_file content_ move is a read + propose composition, not one filesystem op — likely a later plan. — _open_
- **Approval granularity:** per-operation vs a session "allow filesystem writes" toggle. Default per-operation (safest); a remembered allow is a later refinement. — _open_

## Out of scope (deferred)

- **Read windowing / outline-addressed read.** Reading a whole doc into context is a _cost_ concern only (not correctness, unlike whole-doc _write_), so it is an optimization for later — a Pluma-native "list sections / read section N" rather than line offsets. Some tasks (typo sweep, consistency) are irreducibly whole-read regardless.
- **Persisting proposals/annotations across crash/close.** Durability, not capability — it does not raise the write ceiling and is tracked separately.
- **Cross-file content moves and manuscript-wide rename as atomic operations.** Compositions over the primitives above; revisit once both tracks land.
