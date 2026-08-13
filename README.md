# Pluma

A desktop writing app with an AI collaborator built into the document — like VS Code, but for prose.

<!-- TODO: replace with the demo video (GitHub renders an uploaded .mp4 inline — drag it into an issue
     comment to get a hosted URL, then paste that URL here). -->

_Demo video coming soon._

<!-- TODO: add 2-3 screenshots. Suggested: the editor with an inline proposal open; the chat rail
     mid-run with the approval card; the annotations panel. Put files in docs/media/. -->

## The idea

Most AI writing tools are a chat window next to your text. You copy a paragraph out, ask for help, and
paste something back. The document and the conversation never actually meet.

Pluma puts the assistant inside the document. It can read the files in your workspace, see what you have
selected, and propose changes as inline edits you accept or reject — the same review loop a developer
gets from an IDE, applied to prose. Nothing is written to your files without you approving it.

It is built for people working on something long: a novel, a thesis, documentation, a body of essays.
The workspace is a folder of Markdown files on your disk. There is no account, no cloud storage, and no
lock-in — your writing stays in plain files you already own.

## Requirements

- **[Claude Code](https://claude.com/claude-code)**, installed and signed in. Pluma uses it as its agent
  runtime and inherits your existing authentication — Pluma never asks for an API key. If Claude Code is
  missing, everything except the assistant still works.
- **Node.js 20+** and npm, to build from source.

## Install

<!-- TODO: once the release workflow is set up, replace this section with download links to the
     GitHub Releases page for Windows, macOS, and Linux. -->

Prebuilt installers are not published yet. To run Pluma from source:

```bash
git clone https://github.com/jcamatta/pluma.git
```

```bash
cd pluma && npm install
```

```bash
npm run dev
```

To produce a packaged build for your platform, use `npm run build:win`, `npm run build:mac`, or
`npm run build:linux`.

## What you can do

**Write.** A rich Markdown editor built on TipTap — headings, lists, quotes, code blocks, tables of
content structure, images by drag and drop, and a slash-command menu. Bilingual spellcheck (English and
Spanish together) flags a word only when it is wrong in both, so Spanish prose stops getting underlined
in an English document.

**Organize.** Open a folder as a workspace and get a live file tree that follows changes on disk. Create,
rename, and delete files. Open several documents at once in tabs.

**Collaborate.** A chat rail alongside the editor, with streaming replies, conversation threads you can
rename and revisit, and a context meter showing how much of the model's window is in use.

**Review.** Every change the assistant wants to make arrives as something you judge, not something that
already happened. Proposed edits render inline in the document with accept and reject controls.
Annotations collect in a side panel, each tied to the passage it refers to and tinted by severity.

### What the assistant can do

Six tools act on documents you have open. Each edit is a proposal you accept or reject:

| Tool | What it does |
| --- | --- |
| `list_open_files` | See which documents are open and which one you are working in |
| `get_current_selection` | Read the passage you have selected |
| `propose_edit` | Suggest replacing an exact passage, shown inline for review |
| `insert` | Add text before or after a passage you name |
| `insert_at` | Add text at the start or end of a document |
| `create_annotation` | Leave a review note on a passage, as info, caution, or issue |

Five more act on the workspace. The three that change files are gated behind an explicit Approve or
Reject card before they take effect:

| Tool | What it does | Gated |
| --- | --- | --- |
| `list_folder` | Browse the workspace tree | No |
| `read_file` | Read any file, including ones not open | No |
| `create_file` | Create a new Markdown file | Yes |
| `rename_file` | Rename a file | Yes |
| `delete_file` | Delete a file | Yes |

## Built with

**App shell** — Electron, React 19, TypeScript, Vite via electron-vite, packaged with electron-builder.

**Editor** — TipTap 3 on ProseMirror, with custom extensions for annotations, inline edit proposals,
slash commands, and image handling.

**Main process** — [Effect](https://effect.website) throughout, in a hexagonal architecture.

**Assistant** — the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript),
speaking the [AG-UI](https://github.com/ag-ui-protocol/ag-ui) event protocol, with tools exposed as
in-process MCP servers.

**Interface** — Tailwind CSS 4, Base UI primitives, Motion for animation, TanStack Query for server
state, i18next for English and Spanish.

**Testing** — Vitest with Testing Library for unit and component tests, Playwright driving the real
Electron app end to end.

## Architecture

The main process is hexagonal — ports and adapters. Use cases in `src/main/application` depend only on
port interfaces; the adapters that implement them (filesystem, folder watching, the Claude SDK) sit in
`src/main/adapters` and are swapped in at the edge. Commands and queries are kept separate, errors are
tagged values rather than thrown exceptions, and everything crossing the IPC boundary is a typed
`Result` so the renderer handles failure explicitly instead of catching.

The renderer mirrors that shape. Components split into a view that renders and a controller that decides,
data access goes through ports resolved from a repository context, and only adapter modules are permitted
to touch the preload bridge — enforced by custom ESLint rules rather than convention.

The repo also carries the workflow that built it: agent definitions and skills in `.claude/`, and a
semantic pre-commit reviewer configured in `.veto/`. Commits are size-budgeted and every one has to pass
lint, type coverage, tests, and that reviewer before it lands.

<!-- TODO: consider a docs/architecture.md with a diagram of main / preload / renderer and where the
     ports sit, linked from here. -->

## Your data

Your documents are plain Markdown files in a folder you choose. Pluma does not upload them anywhere, and
there is no account or sync.

When you use the assistant, the content it needs — the passages it reads, your selection, the files it
opens — is sent to Anthropic through Claude Code, under whatever plan you are signed in with.
Conversation history is stored locally by Claude Code. Pluma collects no telemetry and makes no network
requests of its own.

## Status

Pluma is a personal project, built in the open. It works and I use it, but it is not a product and comes
with no support commitment — issues and pull requests may go unanswered.

## License

MIT — see [LICENSE](LICENSE).

Pluma requires Claude Code, which is Anthropic's proprietary software under its own
[terms](https://code.claude.com/docs/en/legal-and-compliance). It is not included in or distributed with
this repository.
