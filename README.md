# Pluma

A desktop writing app with an AI collaborator that works inside the document — Electron and React over a
hexagonal, Effect-based main process.

Pluma opens a folder of Markdown files as a workspace. An agent can read those files, propose edits that
render inline for you to accept or reject, and leave review notes anchored to specific passages. Nothing
is written to disk without explicit approval.

The app is the vehicle. The reason this repo is worth reading is the engineering underneath it: strict
architectural boundaries that are enforced by tooling rather than described in a style guide.

## Architecture

### Main process: ports and adapters

The main process is hexagonal. Use cases in `src/main/application` depend only on port interfaces and
know nothing about Electron, the filesystem, or the Claude SDK. The adapters that implement those ports
live in `src/main/adapters` and are composed in at the edge as Effect layers.

Everything is written in [Effect](https://effect.website): errors are tagged values in the type
signature rather than thrown exceptions, dependencies are resolved through the context rather than
imported, and commands are kept separate from queries. Code is organised as data, calculations, and
actions, with the actions pushed to the boundary.

Every value crossing the IPC boundary is a typed `Result`. The renderer cannot receive an exception —
it receives a success or a tagged failure and has to handle both, checked at compile time.

### Renderer: the same discipline

Components split into a view that renders and a controller that decides. Data access goes through ports
resolved from a repository context, so hooks depend on interfaces rather than on the preload bridge.

Three boundaries are worth calling out because they're enforced rather than encouraged:

- Only modules under `adapters/` may reference `window.api`. Everything else goes through a port.
- No component may reach into the DOM to drive a sibling. Cross-component handles are registered
  through context instead.
- Views may not contain business logic; controllers may not contain markup.

Each of these is a custom ESLint rule in `eslint/`, so a violation fails the build rather than waiting
for someone to notice it in review.

### The agent integration

The assistant is built on the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript),
speaking the [AG-UI](https://github.com/ag-ui-protocol/ag-ui) event protocol. Tools are exposed to the
model as in-process MCP servers — one for tools that act on the editor, one for tools that act on the
workspace.

The part that took real design work is the human-in-the-loop gate. When the model calls a tool that
mutates something, the SDK tool handler suspends: its promise stays pending while the call is forwarded
to the renderer, an approval card is shown, and the user decides. The handler resolves only when the
answer comes back, and the whole outstanding set is rejected cleanly on abort. The model experiences a
normal tool call; the user experiences a decision.

## Enforcement

The conventions above are not aspirational. They are configs, and a commit that violates them does not
land:

| Gate | What it enforces |
| --- | --- |
| ESLint (`eslint/`) | Layer boundaries, view/controller split, functional style, no type-safety escape hatches |
| `type-coverage --strict` | 95% minimum; no `as` casts, no `any` leaking through |
| Vitest coverage | 80% minimum, plus an audit that every e2e-covered behaviour has a manifest entry |
| [veto](https://www.npmjs.com/package/@jcamatta/veto) | A semantic reviewer that reads the staged diff against a rule set at every commit |
| Commit budget | 300 weighted lines, 15 source files; over 30 lines of source must touch a test |
| Locale parity | Any user-facing string must exist in both `en.json` and `es.json` |
| Git hooks | `pre-commit` runs size check, lint-staged, veto; `pre-push` runs coverage, type-coverage, build |

`@jcamatta/veto` is a separate tool I wrote and published for this — a doc-blind semantic reviewer that
catches what a linter structurally cannot.

## How it was built

The repo carries its own development workflow in `.claude/`: specialised agent definitions for backend
and frontend work, a plan-review agent, an independent change-validator, and skills that sequence a
change from design through to pull request.

Every change follows the same pipeline — write a plan, get it independently reviewed, implement it in
small commits split by layer, validate the result against the plan by exercising the real app, then open
a PR. The commit-size budget exists to keep that loop honest: over 450 commits, none of them a
thousand-line dump.

## What the app does

A Markdown editor built on TipTap 3 with custom ProseMirror extensions for inline edit proposals,
passage-anchored annotations, slash commands, and image handling. Bilingual spellcheck flags a word only
when it is wrong in both English and Spanish, so Spanish prose stops getting underlined in an English
document.

A workspace file tree that follows changes on disk, multi-file tabs, and a chat rail with streaming
replies, revisitable conversation threads, and a context-window meter.

Six tools act on open documents — listing them, reading the current selection, proposing an edit,
inserting text at a position or against an anchor, and annotating a passage. Every edit is a proposal
the user accepts or rejects.

Five more act on the workspace. The three that mutate it are gated:

| Tool | Gated |
| --- | --- |
| `list_folder`, `read_file` | No |
| `create_file`, `rename_file`, `delete_file` | Yes — explicit approve or reject |

## Stack

Electron, React 19, TypeScript, Vite via electron-vite, packaged with electron-builder. Effect in the
main process. TipTap 3 on ProseMirror. Tailwind CSS 4, Base UI, Motion, TanStack Query, i18next.
Vitest and Testing Library for unit and component tests; Playwright driving the real Electron binary
end to end.

## Running it

Requires Node 20+ and [Claude Code](https://claude.com/claude-code) installed and signed in — Pluma uses
it as its agent runtime and inherits that authentication, so there is no API key to configure. Without
it, everything except the assistant still works.

```bash
git clone https://github.com/jcamatta/pluma.git
```

```bash
cd pluma && npm install
```

```bash
npm run dev
```

Packaged builds: `npm run build:win`, `build:mac`, or `build:linux`.

## Your data

Your documents are plain Markdown files in a folder you choose. There is no account, no sync, and no
telemetry. When you use the assistant, the content it reads is sent to Anthropic through Claude Code
under whatever plan you are signed in with; conversation history is stored locally by Claude Code.
Pluma makes no network requests of its own.

## Status

A personal project, built in the open. It works, but it is not a product and carries no support
commitment.

## License

MIT — see [LICENSE](LICENSE).

Pluma requires Claude Code, which is Anthropic's proprietary software under its own
[terms](https://code.claude.com/docs/en/legal-and-compliance). It is not included in or distributed with
this repository.
