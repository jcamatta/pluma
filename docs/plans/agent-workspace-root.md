# Plan: tell the agent the workspace root absolute path

## What & why

The Pluma writing agent works entirely in absolute paths — `read_file`, `create_file`, `rename_file`,
`delete_file` all take one — but **nothing ever tells it what the workspace root actually is**. The
system prompt only says it in the abstract:

> "When a folder is open the workspace root is this run's working directory"

…which is true and useless: the literal string never reaches the model. Today the only way for the
agent to learn the root is to call `list_folder` with no `path` and read the `path` field off some
returned entry — an inference that needs a non-empty root, costs a tool round-trip, and that the agent
does not reliably think to do. Asked "where would `file_a.md` go?", it answers that it doesn't know.

Meanwhile the path is already in hand on both sides: the renderer holds it (`Agent.workspaceCwd`,
pushed by `AgentProvider`) and main receives it as `RunAgentInput.cwd`, where it is already used to key
the SDK session and to resolve a bare `list_folder`. It is simply never spoken to the model.

**Fix:** state the root to the model, as a fact, before it takes its first turn — via the AG-UI context
channel that already exists for exactly this ("the per-session facts folded into a fresh run's opening
message"), which today carries nothing. Plus a small hardening change so `list_folder` echoes the
absolute path it listed, giving the agent a self-correcting way to re-derive the root mid-thread.

This is **backend-only**. No IPC contract change, no renderer change, no new user-facing strings (so no
i18n work), no new tool, no new dependency.

## Design

### Why the context channel, not a new `get_workspace` tool

Both were considered. The context entry wins:

| | context entry | `get_workspace` tool |
| --- | --- | --- |
| cost to the agent | zero calls — the path is in the transcript from turn one | one round-trip, and only if the model remembers to call it |
| reliability | can't be "forgotten" | the exact failure we're fixing is the model not reaching for a tool |
| surface added | none (channel already plumbed, currently empty) | a new tool spec, allow-list entry, prompt teaching |
| diff | one calculation + one line in `stream-input` | a new tool file, catalog + server + `build-options` wiring, tests |

A tool would also be the *third* way to learn the same fact. Rejected on YAGNI. (If a live run later
shows the model losing the root deep in a long thread, revisit — but Step 3 below is the cheap answer
to that.)

### Where it goes in the run

`streamInput` already builds an opening `<context>` message on a fresh run and skips it on a resume
(the session got it on turn one). The workspace entry rides that same path:

```
RunAgentInput.cwd ──▶ workspaceContextEntry(cwd) ──▶ prepended to openingContext()
                                                  ──▶ contextToMessage() ──▶ <context> opening message
```

Rendered by the existing `contextToMessage` shape (`description` then `value`) as roughly:

```
<context>
The absolute path of the open workspace root. Files you create belong under it unless the user says otherwise.
C:\Users\camat\Documents\my-novel
</context>
```

`cwd === undefined` (no folder open) yields **no entry** — the prompt handles that case in words
instead, so we never assert a root that doesn't exist.

### Layer placement

The entry is built in the adapter (`claude/logic/`), next to `AGENT_SYSTEM_PROMPT` and
`context-to-message.ts`. Reason: how a run is *presented to the model* is adapter concern, same as the
system prompt. Nothing in `application/` changes, and `AgentContextEntry` is reused as-is.

Note `openingContext` currently returns `input.context ?? []` — the renderer's entries. The workspace
entry is **prepended** to those, so if the renderer ever starts sending product context, the root still
leads.

## Anchors

- `src/main/adapters/agent/claude/runtime/stream-input.ts` — `openingContext(input)`; the one wiring point.
- `src/main/adapters/agent/claude/logic/context-to-message.ts` — renders entries as `description\nvalue`
  inside `<context>`. Not changed.
- `src/main/application/agent/data/agent-context-entry.ts` — `{ description, value }`. Not changed.
- `src/main/application/agent/data/run-agent-input.ts` — `cwd?: string`. Not changed.
- `src/main/adapters/agent/tools/backend/list-folder-tool.ts` — `resolveTarget` already falls back to
  `cwd`; `toEntries(entries, target)` builds the returned array. Step 3 touches this.
- `src/main/adapters/agent/claude/logic/agent-system-prompt.ts` — the "You can also reach files that are
  not open in the editor" paragraph carries the stale abstract wording. Step 4 touches this.
- Tests live in sibling `__tests__/` dirs (`stream-input.test.ts`, `list-folder-tool.test.ts`,
  `agent-system-prompt.test.ts` all already exist).

## Steps

Each step is one commit, well inside the ≤300 weighted-line / ≤15-file budget. Branch:
`feat/agent-workspace-root`.

### Step 1 `[backend]` — the calculation

New `src/main/adapters/agent/claude/logic/workspace-context-entry.ts`:

```
workspaceContextEntry(cwd: string | undefined): AgentContextEntry | undefined
```

Returns `undefined` for `undefined` (and for an empty/blank string — a blank cwd is not a root). Otherwise
returns one entry whose `description` names it as the open workspace root and says new files belong under
it unless the user says otherwise, and whose `value` is the raw absolute path, verbatim, on its own line.

New `__tests__/workspace-context-entry.test.ts`: undefined → undefined; blank string → undefined; a real
path → an entry whose `value` is exactly that path (assert the exact string — no normalising, no trailing
separator added, Windows backslashes survive).

**Done when:** the calculation and its test exist and pass.

### Step 2 `[backend]` — wire it into the opening context

In `stream-input.ts`, prepend the entry to `openingContext`:

```ts
const openingContext = (input: RunAgentInput): readonly AgentContextEntry[] => {
  if (input.threadId !== undefined) return []
  const workspace = workspaceContextEntry(input.cwd)
  const rest = input.context ?? []
  return workspace === undefined ? rest : [workspace, ...rest]
}
```

Update the file's header comment to say the opening context now leads with the workspace root.

Extend `__tests__/stream-input.test.ts`:
- fresh run with a `cwd` → the first yielded message is the `<context>` message and contains the cwd string;
- fresh run with a `cwd` **and** renderer `context` entries → the workspace entry comes first, the others follow;
- fresh run with **no** `cwd` and no context → no `<context>` message at all (unchanged behaviour);
- **resume** (`threadId` set) with a `cwd` → still no `<context>` message (the root was delivered on turn one).

**Done when:** a fresh run's first SDK message contains the literal workspace path; resume is unchanged.

### Step 3 `[backend]` — `list_folder` echoes the absolute path it listed (recommended)

Belt-and-braces so the agent can always re-derive the root, including when the root is **empty** (no
entries to read a path off) and deep into a long thread where the opening context has scrolled far back.

Change `list_folder`'s output from a bare array to an object:

```json
{ "path": "<absolute path that was listed>", "entries": [ { "name": …, "type": …, "path": … } ] }
```

`path` is `resolved.path` — i.e. the resolved `cwd` when the call omitted `path`, so a bare
`list_folder()` now *states* the root rather than implying it. Update the tool `spec.description` to say
the result carries the absolute path that was listed. Update `__tests__/list-folder-tool.test.ts` for the
new shape, including the bare-call case (asserts `path === cwd`) and the empty-folder case
(`entries: []` but `path` still present).

*Drop this step if you want the absolute smallest diff* — Step 2 alone answers the question the agent
failed. Keep it if you want the agent to be able to recover the root without relying on the transcript.

**Done when:** `list_folder` with no argument returns the workspace root as a stated `path`.

### Step 4 `[backend]` — say it in the system prompt

In `agent-system-prompt.ts`, in the "You can also reach files that are not open in the editor" paragraph,
replace the abstract sentence with wording that:

- points at the context message: the absolute path of the open workspace root is **given to you at the
  start of the conversation**, and it is the folder new files belong in unless the user names somewhere else;
- keeps `list_folder` with no path as the way to list that root — and (if Step 3 shipped) notes the result
  states the absolute path it listed, so the root can be recovered at any time;
- says plainly what to do when **no** root was given: no folder is open, so say so rather than guessing a
  path or inventing one.

Adjust `__tests__/agent-system-prompt.test.ts` if it asserts on the replaced sentence.

**Done when:** the prompt no longer claims the root is knowable from "this run's working directory" alone.

## Definition of done

- `npm run lint`, `npm run test`, `npm run type-coverage`, `npm run build` all green.
- No e2e: backend-only, no UI surface, so no coverage-manifest id.
- No new i18n keys (nothing user-facing), no new dependency, no contract change.
- **Live proof** (the point of the change — unit tests can't show the model behaving): open a folder in the
  running app, start a **fresh** thread, and ask the agent "what is the absolute path of my workspace?" and
  "where would you create `file_a.md`?". It should answer with the real path, without calling any tool. Then
  ask it to create `file_a.md` and confirm the Approve card shows the path under the workspace root.
  Second case worth checking: an **empty** workspace folder — the agent should still state the root.
