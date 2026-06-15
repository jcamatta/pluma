# Amplify `propose_edit` — insert, not just replace

Today the agent's only mutation primitive is **replace a matched passage** (`propose_edit({ path, text,
replacementText })`): the agent names existing text and swaps it for new text. That cannot express an
**insertion** — adding text where there is nothing to replace — so the agent cannot insert a sentence
between paragraphs, and cannot author into an **empty** document at all (there is no passage to anchor on).

This plan amplifies `propose_edit` so one proposal can also **insert**. It is deliberately small: the
proposal **data model and rendering do not change** — they already express an insert — so the work is
entirely the tool surface plus teaching the agent.

> This refines the Track 1 approach sketched in [agent-write-amplification.md](agent-write-amplification.md):
> instead of a whole-document diff feed (`propose_document` + `extractProposal`), the agent sends ordinary
> per-change proposals, and we simply give `propose_edit` an insert operation. The whole-doc diff, the
> markdown/plain-text contract it needed, and any multi-proposal "run" review surface are **out of scope**
> here (see below) — this PR ships only the insert capability.

## Why no model or rendering change

`Proposal = { id, from, to, originalText, replacementText, status }` and `acceptProposal`'s
`insertText(replacementText, from, to)` already express every case — only the **tool** can't ask for an
insert:

| operation       | from / to               | originalText | result of `insertText` |
| --------------- | ----------------------- | ------------ | ---------------------- |
| replace (today) | `from < to`             | the passage  | swaps the range        |
| **insert**      | `from === to` (a point) | `''`         | pure insertion         |

Verified end-to-end: at `from === to` the drift check passes (`textBetween(p,p) === '' === originalText`),
`insertText` inserts at the point, and `diffWords('', text)` renders an all-green insert widget
([proposals.ts](../../src/renderer/src/editor/extensions/proposals.ts),
[proposal-decorations.ts](../../src/renderer/src/editor/extensions/proposal-decorations.ts)). So those
files are untouched.

## The amplified tool surface

```ts
propose_edit({
  path: string,
  operation?: 'replace' | 'insert',  // default 'replace'
  anchor?: string,   // the existing passage to locate. replace: required. insert: insert AFTER it;
                     //   omit to insert at the document start (also the empty-document case).
  text: string       // the agent's new text — the replacement, or the inserted text
})
```

Naming: the old `text`/`replacementText` pair is renamed to `anchor` (the **document** text we locate) and
`text` (the **agent's** text) — for an insert nothing is "replaced", so `replacementText` was a misnomer.

Two deliberate simplifications, settled in design:

- **Only `insert` (always after the anchor)** — "insert before X" is expressed as "insert after the passage
  preceding X" (e.g. to put a word before "pizza" in "I like pizza", anchor on `"like"`). No
  `insert_before`.
- **Omit the anchor to insert at the start** — _not_ an empty-string sentinel. An omitted field is
  self-documenting and can't be produced by an agent that merely failed to choose an anchor; `anchor: ""`
  would silently dump text at the top, so we avoid it.

Handler (in [tool-propose-edit.ts](../../src/renderer/src/agent/tools/tool-propose-edit.ts)), reusing
[resolve-anchor.ts](../../src/renderer/src/agent/tools/resolve-anchor.ts) unchanged. `start` is the first
valid insertion position inside the document's opening text-block — ProseMirror position **1** (i.e.
`editor.state.selection.from` on a fresh empty doc), **not** `0` (which is before the doc node and would
throw):

```ts
// insert at start / empty document
if (operation === 'insert' && anchor === undefined)
  return createProposal({ from: start, to: start, originalText: '', replacementText: text })

// replace needs an anchor
if (operation !== 'insert' && anchor === undefined) return { ok: false, error: 'anchor_required' }

const r = resolveAnchor(editor, anchor) // not_found / ambiguous — same contract as today
if (!r.ok) return r

return operation === 'insert'
  ? createProposal({ from: r.to, to: r.to, originalText: '', replacementText: text }) // after anchor
  : createProposal({ from: r.from, to: r.to, originalText: anchor, replacementText: text }) // replace
```

## Scope

- **In:** insert text after a passage; insert at the document start (authoring into an empty document);
  the `propose_edit` rename + `operation`; and teaching the agent (tool spec description **and** system
  prompt).
- **Out (not this PR):**
  - The whole-document diff feeder (`propose_document` / `extractProposal`) and its text-representation
    contract — dropped in favor of per-change proposals.
  - Any multi-proposal **run** review surface (grouped/inline/checklist rendering) — N proposals render
    with today's machinery (a card each, one decorated inline at a time). A nicer run surface is a future
    presentation PR.
  - Structural / markdown / mark-applying edits, and a `delete` operation (expressible as a replace with
    empty `text` if ever needed — not exposed now).

## Done

- The agent can call `propose_edit` with `operation: 'insert'` to add text after a named passage, or with
  the anchor omitted to insert at the document start / into an empty document.
- Accepting an insert proposal inserts the text at the point via the **existing** accept path; the replace
  path is byte-for-byte unchanged.
- The tool spec description and the system prompt teach replace-vs-insert, the anchor-after semantics, and
  omit-anchor-for-start.
- Green: `lint`, `test` (incl. the e2e coverage audit), `type-coverage`, `build`; and `test:e2e` for the
  new insert spec.

## Steps

### 1. `[frontend]` Amplify `propose_edit` (spec + handler + tests)

- [specs.ts](../../src/renderer/src/agent/tools/specs.ts): rename params to `anchor`/`text`, add optional
  `operation` (`'replace' | 'insert'`, default replace), make `anchor` optional; descriptions teach insert
  - omit-anchor-for-start, and that **omitting `anchor` is only valid for `operation: 'insert'`** (a
    replace without an anchor returns `anchor_required`).
- [tool-propose-edit.ts](../../src/renderer/src/agent/tools/tool-propose-edit.ts): the three-way branch
  above; `anchor_required` for a replace with no anchor; `resolveAnchor` reused unchanged. **Rename only the
  wire args** — the model field stays `Proposal.replacementText`, so the handler keeps calling
  `createProposal({ …, replacementText: text })`. Do **not** touch the artifact/model layer.
- Tests ([tool-propose-edit.test.ts](../../src/renderer/src/agent/tools/__tests__/tool-propose-edit.test.ts)):
  replace unchanged; insert-after a passage lands text at the right point; insert at start of an **empty**
  document (assert the resolved position is `1`); `anchor_required`; `not_found`/`ambiguous` still surface.
  Do **not** assert that an insert adjacent to (or sharing a point with) an existing proposal is rejected —
  the overlap guard is a strict-interior test, so adjacent/same-point inserts are _allowed_. The
  insert-at-start test also records the one fidelity finding below.
- **Fidelity finding (resolve here):** confirm whether `insertText` of multi-paragraph `text` at the start
  reconstructs paragraph nodes or flattens to one block. If it flattens, document it and note the
  workaround (the agent authors paragraph-by-paragraph with successive inserts); a paragraph-aware insert
  in the shared accept path is a **possible follow-up**, not this PR (it would touch `acceptProposal` and
  must keep replace byte-for-byte). No model change unless this proves blocking.
- **Files:** `specs.ts`, `tool-propose-edit.ts`, `tool-propose-edit.test.ts`, **and the wire-arg callers
  the rename touches** — `editor/useEditorTools.ts` (the production `assertWire<{ path, text,
replacementText }>` → `{ path, operation?, anchor?, text }`), plus tests
  `editor/__tests__/useEditorTools.test.tsx`, `editor/__tests__/EditorToolsBridge.test.tsx`,
  `agent/__tests__/tool-round-trip.integration.test.tsx`. No `proposals.ts` / `proposal-decorations.ts` /
  artifact / i18n changes. (Still under the 15-file / 300-line budget — the extra files are low-weight,
  mostly tests.)

### 2. `[backend]` Teach the system prompt

- [agent-system-prompt.ts](../../src/main/adapters/agent/claude/logic/agent-system-prompt.ts): update the
  `propose_edit` teaching — it now replaces _or_ inserts; for an insert, give the passage to insert after
  (omit it to write at the document start / into an empty document); the params are `anchor` + `text`. If
  the step-1 finding is that `insertText` flattens paragraphs, also teach the agent to **author multiple
  paragraphs as successive single-paragraph inserts** rather than one insert with embedded blank lines. No
  emojis. Update its test.
- **Files:** `agent-system-prompt.ts` + its test. `[backend]` — dispatch the backend engineer.

### 3. `[e2e]` Insert spec

- Add a real-app test (pattern: [artifacts.e2e.ts](../../e2e/artifacts.e2e.ts)) driving the agent to
  **insert** a sentence after a named passage, accept it, and assert the inserted text appears in the
  document. Insert rides the existing agent-run + artifacts surfaces, so it is tagged under the existing
  `feature:artifacts` manifest id — **no new manifest id** (no new UI region or IPC channel). Confirm the
  coverage audit stays green.

### 4. `[docs]` Remove this plan

- Delete `docs/plans/agent-insert.md` in its own `docs:` commit once the steps ship (handled by
  `finish-plan`).

## Constraints

- **Minimal diff.** No change to `proposals.ts`, `proposal-decorations.ts`, the artifact layer, or
  rendering. The replace path is byte-for-byte preserved (`operation` defaults to replace).
- No new dependency. No new user-facing UI strings expected (tool descriptions and the system prompt are
  not `t()` strings), so no `en.json`/`es.json` change; if any UI string is added, both locales.
- Hexagonal: the system prompt (step 2) is a `logic` calculation; the tool handler stays a renderer
  adapter; `resolveAnchor` is reused, not reshaped.

## Open questions

- **Multi-paragraph insertion fidelity** (resolved in step 1) — flatten vs paragraph nodes; the workaround
  and the possible follow-up are noted above.
- **Reconcile the roadmap.** [agent-write-amplification.md](agent-write-amplification.md) still describes
  Track 1 as a whole-document diff feed. After this ships, that section should be rewritten to "amplify
  `propose_edit`; runs are a presentation follow-up." Out of scope for this PR — flag for a later `docs:`
  pass.
