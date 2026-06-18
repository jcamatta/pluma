# Plan: Wikilinks — `[[file]]` links between workspace files

## What & why

Writers want to cross-reference files the way a wiki does: type `[[`, get an autocomplete of files in the
workspace, pick one, and have it inserted as a `[[target]]` link. Clicking that link opens (or activates)
the target file in the editor. v1 is **insert + resolve + navigate** only — no backlinks, no graph, no
"unresolved link" styling beyond a single state. Because every open file round-trips through
`@tiptap/markdown` (`editor.getMarkdown()` / `setContent(…, contentType: 'markdown')`, see
`src/renderer/src/editor/useEditorFileSync.ts` and `useManuscriptEditor.ts`), the link must serialize
back to literal `[[target]]` text so a save→reload is lossless and the file stays readable as plain
markdown outside Pluma.

## How the real code works today (anchors this plan reuses)

- **The autocomplete model is the slash menu.** It is built on the official `@tiptap/suggestion`
  utility with `char: '/'` (`src/renderer/src/editor/extensions/slash-command.ts`). Suggestion owns
  trigger detection, the query/range, the caret rect, and key forwarding; the extension translates that
  imperative lifecycle into a per-editor reactive **bridge** kept in `addStorage`
  (`src/renderer/src/editor/slash/slash-menu-bridge.ts`), read by a `useSyncExternalStore` hook
  (`slash/useSlashMenu.ts`) and rendered by a pure popup view + controller
  (`slash/SlashMenu.view.tsx`, `SlashMenu.controller.tsx`), positioned by pure geometry
  (`slash/slash-menu-position-logic.ts`), filtered by a pure function (`slash/filter-slash-commands.ts`),
  and applied by a pure action (`slash/apply-slash-command.ts`). The whole shape is the template for a
  `[[` menu — a second `Suggestion` with `char: '[['`.
- **Files are opened by setting the active path.** `OpenFilesContext` (`editor/OpenFilesContext.ts`)
  exposes `open(path)` / `openInBackground(path)` / `close(path)`; `App.tsx` owns the open-files state and
  provides it. The explorer calls `onSelect = openFiles.open` (`explorer/Explorer.controller.tsx`,
  `useExplorerTree.ts`). So "navigate to a wikilink" is exactly `useOpenFiles().open(absolutePath)`.
- **Paths are absolute, OS-native strings.** The explorer reconstructs child paths from the parent path +
  basename using the parent's separator (`explorer/explorer-tree.ts` `joinPath`/`parentPath`), so paths
  the app holds are absolute. Folder listing (`folder:list`,
  `src/shared/ipc/ipc-contract/folder.ts`) is **per-folder and lazy** — there is no "list every file in
  the workspace" today. The autocomplete needs a workspace-wide file source; that is the one new backend
  capability (see Step 1–3 and the Open questions).
- **Custom markdown serialization is supported.** `@tiptap/markdown` lets an extension declare
  `markdownName` + `parseMarkdown` + `renderMarkdown` and register a custom marked tokenizer
  (verified in `node_modules/@tiptap/markdown/dist/index.d.ts`). A wikilink inline **node** with these
  hooks round-trips as literal `[[target]]`. (Annotations/proposals are decorations, not document nodes,
  so they don't serialize — a wikilink must be a real node to survive the round-trip.)
- **The editor extension set** is `src/renderer/src/editor/extensions/index.ts`; new extensions register
  here. Renderer ports live per-feature with a `window.api` IPC adapter + an in-memory fake
  (`explorer/ports/*.port.ts`, `explorer/adapters/folder-repository.ipc.ts`,
  `explorer/__tests__/fake-window-api.ts`); `window.api` may only be referenced under `/adapters/`.

## Scope

- **IN:** a `[[` autocomplete sourced from a workspace file list; a wikilink inline node that renders as a
  clickable link and serializes to `[[target]]`; click → open/activate the target via `OpenFilesContext`;
  a workspace-files IPC query feeding the menu; one real-app e2e.
- **OUT (defer):** backlinks / "linked references" / graph view; renaming a file updating links that
  point at it; aliases (`[[target|label]]`); heading/anchor links (`[[file#section]]`); auto-creating a
  missing target on click; styling unresolved vs resolved links beyond one resolved state. Each is noted
  in Open questions so v1 doesn't bake in a guess.

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[shared]` Workspace-files IPC contract.
   - `src/shared/ipc/ipc-contract/workspace.ts` (new, pattern: `ipc-contract/folder.ts`): a
     `workspace:list-files` channel — request `string` (root path), response
     `ReadonlyArray<{ readonly path: string; readonly name: string }>` (absolute path + basename), error
     `{ _tag: 'InvalidFolderPath' | 'FolderNotFound' | 'WorkspaceReadFailed'; path }`. Register it in the
     IPC contract index the same way folder contracts are registered.
   - Tiny step (types only, no weight-bearing logic); no test file required.

2. `[backend]` Recursive workspace-file listing use case + adapter + IPC endpoint.
   - `src/main/application/workspace/usecase/list-workspace-files.ts` (+ `__tests__`): an Effect use case
     that walks the root via a `WorkspaceReaderPort`, returns markdown files (see Open question Q4 for the
     extension filter), each as `{ path, name }`, skipping dotfolders/`node_modules` (Open question Q3).
   - `src/main/application/workspace/port/workspace-reader.port.ts` + the live adapter
     (`adapters/.../FsWorkspaceReaderLive`, mirroring the folder reader adapter) with its `__tests__`
     against a real temp dir.
   - `src/main/ipc/workspace/list-files-handler.ts` + registration, returning the IPC `Result`. Tagged
     errors serialize as `_tag` strings; nothing throws across IPC.
   - Tests: a nested temp tree lists every markdown file as absolute paths; a non-existent root yields the
     tagged error. Split into two commits if it exceeds the budget (use case + port/adapter, then handler).

3. `[frontend]` Renderer port + adapter + query hook for the workspace file list.
   - `src/renderer/src/editor/wikilink/workspace-files.port.ts`: `WorkspaceFilesPort = (root) =>
Promise<Result<readonly WorkspaceFile[], WorkspaceListError>>`.
   - `src/renderer/src/editor/wikilink/adapters/workspace-files.ipc.ts`: the `window.api` adapter (only
     adapters may touch `window.api`) + an in-memory fake for tests
     (pattern: `explorer/adapters/folder-repository.ipc.ts` + `explorer/__tests__/fake-window-api.ts`).
   - `wikilink/useWorkspaceFiles.ts`: a React Query hook keyed `['workspace-files', root]` returning the
     file list (pattern: `explorer/useFolderListings.ts`). Wire the port into `RepositoriesContext`/
     `RepositoriesProvider` (`src/renderer/src/explorer/`) next to the existing repos.
   - Tests: hook returns files on ok; surfaces the error branch.

4. `[frontend]` The wikilink inline node + its markdown round-trip.
   - `src/renderer/src/editor/extensions/wikilink.ts`: a TipTap inline, atom **node** `wikiLink` with a
     `target` attribute, a NodeView/`renderHTML` that paints a clickable link (a `data-wikilink` element),
     `markdownName: 'wikiLink'` + `renderMarkdown` → `[[${target}]]`, `parseMarkdown` + a marked tokenizer
     for `[[…]]` so a saved file reloads as a node (verified `@tiptap/markdown` supports these hooks).
   - Register it in `editor/extensions/index.ts` (before `Markdown`, matching the ordering note there).
   - Pure helpers split out and tested: `wikilink/parse-wikilink-syntax.ts` (extract target from `[[…]]`)
     and `wikilink/serialize-wikilink.ts` (target → `[[target]]`), so the round-trip is unit-tested
     without an editor; an editor-harness test (pattern:
     `editor/extensions/__tests__/editor-test-harness.ts`) asserts `getMarkdown()` of a doc with a link
     equals the original markdown.

5. `[frontend]` The `[[` autocomplete menu (Suggestion + bridge + view).
   - `editor/extensions/wikilink-suggestion.ts`: a second `Suggestion` with `char: '[['`,
     `allowSpaces: true` (filenames have spaces); `items` delegates to a pure
     `wikilink/filter-workspace-files.ts` (substring match on name/path, pattern:
     `slash/filter-slash-commands.ts`); `command` inserts the `wikiLink` node and deletes the trigger
     range via a pure `wikilink/insert-wikilink.ts` (pattern: `slash/apply-slash-command.ts`). The file
     list arrives via the node's `addStorage` (a setter the controller updates from `useWorkspaceFiles`),
     since Suggestion's `items` is sync.
   - `wikilink/wikilink-menu-bridge.ts` (clone of `slash/slash-menu-bridge.ts`),
     `wikilink/WikilinkMenu.view.tsx` + `WikilinkMenu.controller.tsx` + `useWikilinkMenu.ts`, reusing
     `slash/slash-menu-position-logic.ts` for placement. Tokens, Base UI `Button`, Motion, `t()`, BOTH
     `en.json` + `es.json` (`editor.wikilink.*`: heading, empty, placeholder). Mount the controller in
     `editor/EditorManuscript.tsx` next to `SlashMenuController`.
   - Tests: bridge open/move/select; filter ranks identically to the live menu; insert action produces a
     `wikiLink` node and clears the trigger.

6. `[frontend]` Click-to-navigate: resolve the link target and open the file.
   - A pure resolver `wikilink/resolve-wikilink-target.ts`: given the typed `target` and the workspace
     file list, return the matching absolute path (exact path first, else unique basename match), or null
     (Open question Q1 — resolution rule). Unit-tested.
   - In the node's NodeView/controller, on click call `useOpenFiles().open(resolvedPath)`
     (`editor/OpenFilesContext.ts`); when unresolved, render the link in an "unresolved" state and do
     nothing on click (single state — no creation). The node reads the file list and `open` via a small
     context/bridge the manuscript provides, NOT `document.querySelector` (renderer no-DOM-reaching rule).
   - Tests: click on a resolved link calls `open` with the right path; an unresolved link does not.

7. `[e2e]` Manifest id + real-app spec.
   - Add `wikilinks` to `FEATURES` and `workspace.list-files` to `OPERATIONS` in
     `e2e/coverage-manifest.ts`, and a `e2e/wikilinks.e2e.ts` (pattern: an existing editor `*.e2e.ts`)
     that: opens a workspace with two files, types `[[`, picks the second file from the menu, asserts the
     link renders, clicks it, and asserts the second file becomes the active editor. Manifest id +
     operation + spec in the SAME commit.

8. `[docs]` Remove this plan file in its own `docs:` commit once all steps ship.

## Constraints

- **Hexagonal / CQS:** the workspace-file listing is a **query** (no gate). Backend: `usecase → port →
adapter → ipc`, business logic only in the use case, adapters at the edge. The IPC `Result` boundary
  holds; tagged errors serialize as bare `_tag` strings; nothing throws across IPC.
- **Renderer:** ports + `window.api`-only-in-`/adapters/`; query hook via `useRepos`; view/controller
  split; tokens-only, Base UI, Motion, `t()` for every string, both locales; `Scrollable` for the menu
  overflow (reuse the slash menu's pattern). Navigation goes through `OpenFilesContext`, not DOM reaching;
  the node reaches `open`/the file list via a context the manuscript registers.
- **Round-trip invariant:** a file containing a wikilink, saved and reloaded, must produce an identical
  `[[target]]` in markdown — the link is a real node with `parseMarkdown`/`renderMarkdown`, registered
  before `Markdown` in the extension list. No HTML leakage into the saved file.
- **No new dependency** — `@tiptap/suggestion` and `@tiptap/markdown` are already present. No `as` casts /
  `@ts-ignore` / `eslint-disable` / non-null `!`; no hand-rolled `<svg>` (use `lucide-react`).
- **Minimal diff / YAGNI:** don't touch the slash menu's files; clone its pattern into `wikilink/`. Don't
  build backlinks/aliases/anchors/graph.

## Open questions (resolve before the steps they gate)

- **Q1 — Link syntax & resolution rule (gates Steps 4, 6).** What does `target` hold — a bare basename
  (`[[chapter-one]]`), a name with extension (`[[chapter-one.md]]`), or a workspace-relative path
  (`[[notes/chapter-one.md]]`)? And how does it resolve when two files share a basename? Proposal:
  serialize the **workspace-relative path without extension**, resolve by exact relative-path match first,
  then unique basename, else unresolved. **Open — confirm the syntax the writer sees and the dedupe rule.**
- **Q2 — Persistence format (gates Step 4).** Confirmed mechanism: a custom inline node with
  `renderMarkdown` → literal `[[target]]` and a marked tokenizer parsing `[[…]]` back, so plain-markdown
  files stay readable outside Pluma and round-trip losslessly. **Open only on the exact on-disk string,
  which follows from Q1** (e.g. `[[notes/chapter-one]]` vs `[[chapter-one.md]]`).
- **Q3 — Workspace scan scope (gates Step 2).** Which folders does `workspace:list-files` skip? Proposal:
  skip dot-directories and `node_modules`. **Open — confirm any other ignores (e.g. a `.plumaignore`,
  out of scope for v1?).**
- **Q4 — Which files are link targets (gates Steps 2, 6).** Only markdown (`.md`/`.markdown`), or any
  file the explorer shows (so `[[image.png]]` could link an asset)? Proposal: markdown only for v1, since
  only markdown opens in the editor. **Open — confirm.**
- **Q5 — Unresolved-link behavior (gates Step 6).** v1 renders unresolved links in a distinct state and
  does nothing on click (no file creation). **Open — confirm this is acceptable, or whether click should
  offer to create the file** (would pull in the gated create-file flow; currently OUT of scope).
- **Q6 — Rename propagation (deferred).** When a file is renamed, links pointing at it are NOT rewritten
  in v1 (they become unresolved). **Confirm deferral.**
