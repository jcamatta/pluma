# Path-addressable editor tools

Make the agent's editor tools act on an **explicit open file**, resolved through the editor registry,
instead of always "whatever editor is active right now". This kills the race where the user switches
files while the agent is mid-turn and a tool silently hits the wrong document. The editor-per-file
architecture already mounts one editor per open path and keys them in `ActiveEditorContext.editors`, so
the registry is the resolution table.

## What "done" looks like

- The agent can discover the open files and which one is active (`list_open_files`), and **must** address
  a specific open file by `path` on every acting tool. A `path` that is not an open editor returns a
  recoverable error that tells the agent to re-check `list_open_files` — it never silently acts on the
  wrong file, because no action can default to "whatever is active now".
- The read tools report **which file** they read (`path` in their result), so the agent learns the file
  identity it must pass back to the acting tools — usually for free, from the read it already does.
- The system prompt explains that the open set / active file can change between turns and how to recover
  from a path error.

## Design decisions (settled)

- **Resolver, not the registry.** Tools depend on a narrow `EditorResolverPort = (path: string) => Editor | null`
  (one capability: resolve a path to its editor), not the `editors` map or the `ActiveEditor` context.
  The registry is one adapter of it; tests pass a `Map`-backed fake. This keeps least-privilege and puts
  the "no editor for this path" decision in one place.
- **`path` is required on the acting tools** (`get_ranges`, `create_annotation`, `propose_edit`). Every
  step of the mutation chain is pinned to a named file, so no action can fall back to the racy "active
  editor" — this is the whole point of the plan, and a required schema field enforces it mechanically
  rather than relying on the prompt to persuade the model. A `path` that is not open → recoverable error.
- **Reads are the asymmetric exception.** `get_current_selection` is parameterless (a selection exists
  only in the focused editor) and `get_current_document` takes an **optional** `path` (default active).
  Reading is side-effect-free and its result carries the `path` it read, so a wrong-file read is harmless
  and self-correcting — there is no race to close on the read side. These reads (and `list_open_files`)
  are where the agent learns the `path` it then passes to the acting tools.
- **Errors stay string-valued** on `AgentToolResult` (the agent-facing channel already uses plain
  strings like `not_found` / `ambiguous`, not UI-mapped `_tag`s). The new error reads e.g.
  `no_open_editor:<path>` — agent-facing text, not a localized tag.
- **Discovery is a frontend tool, not `folder:list`.** A backend folder listing would enumerate files on
  disk but cannot say which one the user is in or which are open in editors; `list_open_files` reads the
  registry, so it knows both. It can go stale (the user switches after the call) — the system prompt
  owns that, and the acting tools' path error forces a re-fetch.

## Tool inventory — what each tool becomes

| Tool | Today | After |
| --- | --- | --- |
| `list_open_files` | — (new) | Query. Returns `[{ path, name, active }]` for every open editor. No side effects. |
| `get_current_selection` | active editor's selection → `{ rangeId, text }` | adds `path` of the active file to the result (selection is inherently the focused editor; no `path` param). |
| `get_current_document` | active editor's Markdown | optional `path` (default active); returns `{ path, markdown }` so the agent knows which file it read. |
| `get_ranges` | `{ text }` on active editor | **requires `path`**; resolves it; not open → `no_open_editor:<path>`. |
| `create_annotation` | `{ rangeId, … }` on active editor | **requires `path`**; same resolution + error. rangeId stays editor-scoped, resolved on that file. |
| `propose_edit` | `{ rangeId, replacementText }` on active editor | **requires `path`**; same resolution + error. |

## Steps

- [ ] **Step 1 — resolver seam (pure refactor, no behavior change).** Introduce `EditorResolverPort`
  and change `useEditorTools(editor)` → it receives a `resolve` and the active `path`, with every handler
  resolving the active editor via `resolve(activePath)` exactly as today. `EditorToolsBridge` builds the
  resolver from `useActiveEditor().editors` and reads the active path from `useOpenFiles()`. Update the
  `useEditorTools` / bridge tests. Behavior identical; the seam is in place. (renderer)

- [ ] **Step 2 — required `path` on the three acting tools.** Add `path` to the `required` list of the
  `get_ranges`, `create_annotation`, `propose_edit` specs; in `useEditorTools` resolve `args.path` and
  return `no_open_editor:<path>` when it is not open. Tests: resolves by explicit path, errors on an
  unknown/closed path. (renderer)

- [ ] **Step 3 — `list_open_files` tool.** New spec + handler (a calculation over `{ editors, activePath }`
  → `[{ path, name, active }]`, names via the existing `editorFileName` logic) + registration in
  `useEditorTools`. Tests for the snapshot shape and the active flag. (renderer)

- [ ] **Step 4 — read tools report their path.** `get_current_document` gains optional `path` (default
  active) and returns `{ path, markdown }`; `get_current_selection` adds `path` to its result. Update
  their handlers + tests, and any consumer asserting the old result shape. (renderer)

- [ ] **Step 5 — system prompt.** Extend `agent-system-prompt.ts`: the open files and the active file can
  change between turns; use `list_open_files` to see them; pass the `path` of the file you intend to act
  on so a mid-turn switch cannot misdirect you; a `no_open_editor` error means the set changed — re-call
  `list_open_files` rather than guessing. Tighten/replace the interim paragraph shipped earlier. Assert in
  `agent-system-prompt.test.ts`. (backend)

- [ ] **Step 6 — e2e.** First confirm the existing artifacts real-app spec still passes: with required
  `path` the real agent must now supply it, so it has to read the file (or `list_open_files`) first — the
  spec/prompt may need a light nudge so the round-trip stays deterministic. Then extend it (or add a
  sibling) so the agent acts on a **named** file by path while another file is active, proving the edit
  lands in the right document. Confirm the coverage audit: these are frontend tools over the existing
  `agent.tool-result` path, so no new `OPERATIONS` id; decide whether this needs a new `FEATURES` id or
  rides the existing `artifacts` feature. (e2e)

## Open questions

- **rangeId scope across files (largely settled by required `path`).** rangeIds are per-editor (`ranges`
  extension). Since `propose_edit` / `create_annotation` now require the `path`, the handler resolves that
  file's editor and looks the rangeId up there; a rangeId minted on a different file simply isn't found →
  the existing range-missing error. So a mismatch is detected, not silently misapplied — no extra design
  needed beyond passing the matching `path`.
- **Manifest/e2e shape** (Step 6) — see above.
- **Closed/deleted files.** A `path` for a file that was closed or deleted on disk must resolve to "not
  open" → the error. Keeping the registry honest on external delete is the **registry-sync** plan
  (external-delete orphan only, for now); this plan assumes that, and degrades safely (error) without it.

## Sequencing / dependencies

Rests on the editor-per-file registry (shipped). Pairs with the **registry-sync** plan (external-delete
orphan) so a `path` for a vanished file errors instead of editing a ghost, and with the **tabs** plan,
which gives the user the UI to keep several files open and aim the agent at them. Buildable now against
the explorer-driven multi-editor substrate; tabs only makes it nicer to use.
