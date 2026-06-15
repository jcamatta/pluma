# Agent write-amplification — handoff & learnings

A handoff for the next agent picking up the agent's write capabilities. It captures what the
`feat/agent-insert` branch (PR #55) actually delivers, the ground-truth mechanics of the proposal
system, the hard limitation that made the work "not good enough" (no real multi-paragraph / markdown
drafting), the approaches that were tried and rejected, the recommended approach, and — important — how
to **test agent-facing changes** so they're actually proven and not just green on unit tests.

This document is written to be read cold. File references are repo-relative with line numbers as of the
`feat/agent-insert` branch; verify them before relying on them (the tree moves).

---

## 1. Status of PR #55 (`feat/agent-insert`)

**Decision: not merged.** It works for what it does, but it does not reach the goal (authoring a full,
multi-paragraph proposal in one shot). Treat the branch as a reference, not a base to build on blindly —
the recommended approach below changes the accept path, which is the core of #55.

What #55 delivers, validated end-to-end against the real app (live Claude runs, see §7):

- `propose_edit` gained an `operation` field: `replace` (the original behavior) and `insert` (new).
- **replace**: `{ path, operation: "replace", passage, text }` — swaps `passage` (exact existing text)
  for `text`.
- **insert**: `{ path, operation: "insert", after?, text }` — inserts `text` immediately after the
  `after` passage, or at the **document start** when `after` is omitted (this is how it authors into an
  empty document).
- Both resolve their anchor text to a document span via the shared resolver (§3).

This is **single-span / single-paragraph** insert and replace. That is the ceiling of #55.

---

## 2. Ground truth: the proposal data model and the accept path

Everything hinges on this. Read it before designing anything.

`src/renderer/src/editor/extensions/proposals.ts`:

```ts
type Proposal = {
  id: string
  from: number // ProseMirror position
  to: number // ProseMirror position
  originalText: string // the text currently between [from, to)
  replacementText: string // the agent's new text
  status: 'ready' | 'conflicted'
}
```

Key facts derived from the code (not guesses):

- **An insert is the degenerate span.** `from === to` (a zero-width point) and `originalText === ''`.
  The data model already represents an insert; **no new type is needed** for that. proposals.ts and the
  decoration code were byte-for-byte unchanged by #55.
- **`createProposal` overlap guard** (`proposals.ts:79`): rejects a proposal whose span strictly
  overlaps an existing one (`proposal.from < existing.to && existing.from < proposal.to`). Strict
  interior — adjacent or same-point inserts are allowed.
- **`acceptProposal` applies the edit with `insertText`** (`proposals.ts:127`):
  ```ts
  editor.state.tr.insertText(proposal.replacementText, proposal.from, proposal.to)
  ```
  This is the crux of the limitation (§4). `insertText` inserts **flat inline characters into the
  current text block**. It does not create block structure.
- **The conflict check is dead for inserts** (`proposals.ts:115`): accept compares
  `doc.textBetween(from, to) !== originalText`. For an insert, `from === to` so `textBetween` is always
  `''` and `originalText` is always `''` → `'' !== ''` is false → **an insert can never conflict**. That
  is a latent correctness gap: an insert point that drifts under concurrent edits is not detected the way
  a replace's drift is.
- **`mapProposal`** (`proposals.ts:134`) remaps positions through every transaction (`from` bias `1`,
  `to` bias `-1`), so a proposal survives edits outside its span and is invalidated inside it. This
  position-mapping concurrency model is good and should be preserved.

`src/renderer/src/editor/extensions/proposal-decorations.ts`:

- Renders the active proposal as a **word-level diff** via `diffWords(originalText, replacementText)`
  from the `diff` package (`proposal-decorations.ts:46`): added words become inline insert widgets,
  removed words become strike decorations.
- **For an insert, `diffWords('', text)` is all-additions** → the whole thing renders green. Fine for a
  sentence; wrong altitude for a multi-paragraph block (see §4/§5).

---

## 3. The anchor resolver (shared, do not break its raw contract)

`src/renderer/src/agent/tools/resolve-anchor.ts` — `resolveAnchor(editor, text)`:

- Builds a flat `char -> ProseMirror position` index over all text nodes, finds every occurrence of
  `text`, and returns:
  - `{ ok: true, from, to, text }` when exactly one match (`to` = position just after the last char),
  - `{ ok: false, error: 'not_found' }` when zero matches,
  - `{ ok: false, error: 'ambiguous\n<previews>' }` when more than one.
- It is **shared by `propose_edit` and `create_annotation`**. Keep its raw `not_found`/`ambiguous`
  contract intact; tools dress up the message at their own seam (see `tool-propose-edit.ts` `NOT_FOUND`).

Consequence — **the chaining wall**: you cannot anchor on text that lives in a _pending_ (un-accepted)
proposal, because that text is not in the document yet, so `resolveAnchor` returns `not_found`. The agent
cannot author paragraph-by-paragraph by inserting after its own previous, still-pending insert. This is
the single biggest reason single-span insert feels weak for drafting, and the reason the goal needs a
**one-shot multi-paragraph proposal**, not a chain.

---

## 4. The hard limitation: no real multi-paragraph / markdown drafting

This is why #55 is "not good enough." The agent _can_ put multi-paragraph text or markdown in `text`
(it is just a string), but **on Accept it collapses**, because `acceptProposal` uses `insertText`:

- `'first paragraph\n\nsecond paragraph'` → accepted as **one** paragraph block. The blank line does not
  become a paragraph boundary (paragraphs are ProseMirror _nodes_, not newline-delimited text).
- `'## Heading'` / `'**bold**'` → inserted **literally** as those characters, not rendered.

There is a unit test that pins this on purpose, in
`src/renderer/src/agent/tools/__tests__/tool-propose-edit.test.ts`:

```ts
it('flattens an inserted multi-paragraph text into one block', () => {
  // proposeEdit(..., { operation: 'insert', text: 'first paragraph\n\nsecond paragraph' })
  // acceptProposal(...)
  expect(editor.state.doc.childCount).toBe(1) // insertText does not reconstruct paragraph nodes
})
```

When you build real drafting, **that test should flip** (a multi-paragraph insert should accept into
multiple block nodes). Leaving it as-is is the marker that the limitation is unaddressed.

---

## 5. Recommended approach: "drafting as additions" (one-shot multi-paragraph proposal)

The good news: the **markdown machinery already ships** in the editor, used for file load/save in
`src/renderer/src/editor/useEditorFileSync.ts`:

- doc → markdown: `editor.getMarkdown()` (`useEditorFileSync.ts:44,54,59`).
- markdown → real nodes: `editor.commands.setContent(disk, { contentType: 'markdown', emitUpdate: false })`
  (`useEditorFileSync.ts:47`).

So the parser that turns the agent's markdown into real paragraph/heading nodes is already in the build.
The recommended design reuses it rather than inventing a new one:

1. **Add a discriminator to `Proposal`** — e.g. `kind: 'edit' | 'draft'` (or `contentType: 'text' |
'markdown'`). An `edit` is today's inline literal replace/insert; a `draft` carries markdown the agent
   authored as a block of new content. Keep the **storage type single** — do not split `Proposal` into
   two types; the span model already holds an insert. Only behavior diverges.
2. **Branch the accept path** (`acceptProposal`): for a `draft` insert, do not `insertText`. Instead
   parse `replacementText` as markdown into a slice/fragment and insert **nodes** at `from`. The cleanest
   route is to reuse the same markdown→nodes path `setContent` uses (investigate the tiptap markdown
   extension's parser so you can produce a `Slice`/`Fragment` and `tr.replaceRange`/`tr.insert` it,
   rather than calling `setContent` which replaces the whole doc). For an `edit`, keep `insertText`
   (literal, inline) exactly as now — inline replaces must stay literal.
3. **Branch the rendering** (`proposal-decorations.ts`): a `draft` should render as a **block-level
   added region** (the whole new block shown as inserted), not a word-level `diffWords` green run. A
   word diff of `'' → <500 words>` is the wrong altitude.
4. **Decide the param surface**: a `draft` is naturally an insert (`after?` + markdown `text`), but you
   may want an explicit signal so the model commits to "write a block" vs "tweak a span." Options: a
   third `operation` value, or a `format: 'markdown'` flag on insert. Lean toward the **flat schema**
   rule in §6 — do not model this with a JSON Schema `oneOf`.
5. **Fix the conflict gap for inserts** (§2) if drafting makes drift more likely — at minimum decide
   intentionally whether a drifted insert point should conflict.

Scope/altitude guidance to put in the system prompt: a `draft` is for "write/continue a scene, add
several paragraphs"; an `edit` is for "tighten this sentence." Match operation to ask.

---

## 6. Approaches tried and rejected (do not repeat these)

- **JSON Schema `oneOf` discriminated on `operation`** (one tool, two branch schemas). _Rejected — it
  broke the tool._ The model **dropped the shared `path`** nested inside each `oneOf` branch, so every
  call failed `no_open_editor:undefined`. Lesson: **agent tool wire schemas must be flat** — top-level
  `required` fields, simple `properties`. Models reliably fill flat top-level required fields and
  unreliably fill fields buried in `oneOf`/`if-then`. The fix flattened it: `path`/`operation`/`text`
  top-level required, `passage`/`after` top-level optional, handler picks by `operation`. The
  per-operation distinction lives in the **field names and the handler**, not the schema shape.
- **Two separate tools (`insert_text` + `propose_edit`).** Considered for reliability (tool-choice is the
  most reliable discriminator). _Not taken_ because a required, flat `operation` field already
  discriminates and one tool keeps the model/handler/prompt single. Revisit only if real-agent testing
  shows the flat `operation` field is unreliable — it was not in validation.
- **Prompt advice to "insert paragraph-by-paragraph" / chain inserts.** _Actively wrong_ — it walks the
  agent into the chaining wall (§3): each new insert anchors on still-pending text → `not_found` cascade.
  The prompt now tells the agent **not** to chain inserts and to anchor only on text already in the
  document. The real fix is the one-shot multi-paragraph proposal (§5), not chaining.

---

## 7. How to actually test agent-facing changes (the most important section)

The mistake worth not repeating: **unit tests, lint, type-coverage, and build passing do NOT prove an
agent-facing change works.** They exercise the _handler_ with hand-written args. They say nothing about
whether the live model fills the _schema_ correctly. The `oneOf` bug was green on all of that and still
failed on first real use.

What actually validates an agent tool change:

- **Run the real-agent e2e** (`e2e/insert.e2e.ts` is the template). It builds the app, launches Electron
  (`e2e/support/launch-app.ts` — real main/preload/IPC, only the native folder dialog is stubbed), and
  makes a **live Claude run**. Run a single spec: `npm run test:e2e -- e2e/<spec>.e2e.ts`.
- **Capture the exact wire args the model emits.** Subscribe to the public `agent:tool-call` IPC event
  (preload-exposed `window.api.on`; contract in `src/shared/ipc/ipc-event-contract/agent.ts`) — the same
  payload the renderer tool bridge consumes. This is how you verify _what the model actually sent_
  (e.g. whether `path` was present), not just the end state. This technique caught/confirmed the `path`
  regression directly.
- **Use the `change-validator` agent** for independent, black-box proof before a PR. It derives expected
  behavior from the brief (not the diff), drives the real app, and writes an evidence report. It is part
  of the `finish-plan` workflow — do not skip it for agent-facing work. (This attempt skipped it once
  and shipped a broken schema; running it surfaced the empty-doc scenario the one-off e2e missed.)
- **Cover the empty-document path explicitly.** The omit-`after` / empty-doc insert is a distinct case
  the model and handler treat differently; it is the case the user actually hit. Have a real-agent
  scenario for it.

Validation already done on `feat/agent-insert` (all PASS, via `change-validator` driving live runs):
insert-after-a-passage, **insert into an empty document** (path present, `after` omitted, paragraph
applied on Accept), and replace-a-passage. In every run the model emitted `path` as a top-level field.
None of those runs exercised multi-paragraph drafting — that is unbuilt (§4).

---

## 8. Known bugs / loose ends to fold into the next pass

- **Placeholder overlaps the proposal decoration in an empty editor.** When a proposal is shown in an
  otherwise-empty document, the editor's empty-state placeholder text and the proposal insert widget
  render on top of each other. Visual bug; fix when drafting touches the empty-doc render path.
- **Inserts never conflict** (§2) — the dead `textBetween`/`originalText` check.
- **Insert diff renders all-green at word altitude** (§2/§5) — wrong for a block-sized draft.
- **The flatten test** in `tool-propose-edit.test.ts` (§4) encodes the limitation; flip it when fixed.

---

## 9. File map

- `src/renderer/src/agent/tools/specs.ts` — AG-UI `Tool` JSON Schemas (the surface the model reads).
  Keep flat (§6).
- `src/renderer/src/agent/tools/tool-propose-edit.ts` — the handler; resolves anchor, stages a proposal.
- `src/renderer/src/agent/tools/resolve-anchor.ts` — shared anchor resolver (§3).
- `src/renderer/src/editor/useEditorTools.ts` — wires specs↔handlers; `assertWire` boundary; `path`→editor.
- `src/renderer/src/editor/extensions/proposals.ts` — `Proposal` type, `createProposal`,
  **`acceptProposal` (the accept path to branch)**, `mapProposal` (§2).
- `src/renderer/src/editor/extensions/proposal-decorations.ts` — diff rendering (§2).
- `src/renderer/src/editor/useEditorFileSync.ts` — the markdown↔nodes machinery to reuse (§5).
- `src/main/adapters/agent/claude/logic/agent-system-prompt.ts` — the agent's instructions for the tools.
- `e2e/insert.e2e.ts`, `e2e/support/launch-app.ts` — the real-agent e2e harness (§7).
- `src/shared/ipc/ipc-event-contract/agent.ts` — `agent:tool-call` event (capture wire args here, §7).

---

## 10. Suggested slicing for the next plan

Per the repo's commit-size budget (≤300 weighted `src/` lines, ≤15 files, code >30 lines lands with a
test), roughly:

1. `[shared/frontend]` Add the `kind`/`contentType` discriminator to `Proposal` + plumb it through
   `createProposal` (default to today's behavior; no accept change yet). Tests stay green.
2. `[frontend]` Branch `acceptProposal`: parse markdown→nodes for a draft insert (reuse the existing
   markdown parser), keep `insertText` for edits. Flip the flatten test to assert multiple block nodes.
3. `[frontend]` Branch `proposal-decorations` to render a draft as a block-added region.
4. `[frontend]` Fix the empty-editor placeholder/proposal overlap.
5. `[backend]` Teach the system prompt when to draft vs edit (altitude/scope).
6. `[e2e]` Real-agent spec: agent authors a multi-paragraph draft in one proposal; Accept yields multiple
   paragraph nodes. Capture wire args; cover the empty-doc case.

Validate every agent-facing step with the `change-validator` / real-agent e2e (§7), not unit tests alone.
