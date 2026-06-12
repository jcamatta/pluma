# Plan — File-scoped artifacts via one editor per file

Status: **active.** Approved; in progress on branch `feat/editor-per-file`.

## Why

Artifacts (annotations + proposals) currently live in the plugin state of a **single, reused**
editor instance. Switching files doesn't make a new editor — `useEditorContent` swaps the document
via `setContent` ([useEditorContent.ts](../../src/renderer/src/editor/useEditorContent.ts)). That
full-document replace maps every artifact position to garbage, so after leaving a file and coming
back the cards still render but their highlights are gone and clicking them does nothing. Artifacts
also leak across files because they have no file identity.

We fix the **root cause** rather than work around it: give each open file its **own persistent
editor instance**. An editor for file A keeps file A's document and artifacts for as long as the
file is open — nothing ever swaps content underneath a live plugin. This is also the substrate the
future **tabs** feature needs (open-set + active tab + per-file editor), so none of it is throwaway.

## Decisions (confirmed)

- **Artifact lifetime = file-open lifetime.** Artifacts are ephemeral agent output, not persisted to
  disk. They live as long as the file's editor is mounted; closing a file (future tabs) discards
  them. If we later want them to outlive a close, we add persistence then — not now.
- **The panel aggregates across all open files**, each card labeled with its file. Clicking a card
  for a non-active file **opens that file and scrolls to the range** (the chosen UX for cross-file
  navigation, and the foundation for multi-file agent edits).
- **No tab UI in this plan.** App keeps every visited file mounted and shows the active one. Explicit
  close / eviction is deferred to the tabs plan; mounted-editor count is unbounded for now (accepted
  pre-tabs).

## Done looks like

- Open file A, get an agent annotation/proposal, switch to file B and back to A — the highlight,
  proposal diff, and annotations are all still there and clicking the card still reveals the range.
- Each card shows which file it belongs to.
- Clicking a card whose file is not the active one reopens that file and scrolls to the artifact.
- Typing in file A no longer disturbs file B's artifacts (no cross-file leakage).
- The proposal/annotation live-anchoring during edits still works (each editor maps its own ranges).

## Steps (sliced to mini-commits, each green on its own)

1. **Open-files model + editor-per-file mounting.** App tracks an ordered **open-paths** set and an
   active path; it renders one `EditorController key={path}` per open path, keeping inactive ones
   mounted but hidden. Each `EditorController` loads **its own** content (`useFileContent(path)`
   moves into the column) and registers as the active editor only while active, so the existing
   single-active panel keeps working. Pure `open-files-logic.ts` (open/activate over the set) with
   unit tests. → **fixes #2** at the editor layer.

   **DONE**, split in two:
   - **1a** — lifted `useEditorTools` out of the per-file controller into a shell-level
     `EditorToolsBridge` bound to the active editor, so several mounted editors don't collide over
     the same (name-keyed, last-wins) tool registry.
   - **1b** — `open-files-logic.ts` (`noOpenFiles`/`openFile`, additive open-set keyed by path);
     `EditorStack` mounts one `EditorController` per open path (active visible, others `hidden`) and
     falls back to a single empty editor when nothing is open; the controller now loads its own file
     via `useFileContent(path)` and gates its `ActiveEditorContext` registration on a new `isActive`
     prop. `EditorStack` test proves two files' editors stay mounted at once with independent content
     (the core of the #2 fix); `App`/`Editor.controller` tests updated for content-by-path.

   _Note for step 2:_ the registration is still the single-slot `ActiveEditorContext` gated by
   `isActive`. Step 2 replaces that with a path-keyed registry so the panel can read **all** open
   editors (the controller will then register by path unconditionally, and `useActiveEditor()` will
   derive the active editor from `editors.get(activePath)`).

2. **Editor registry context.** Generalize the single-editor wiring into an `OpenEditorsContext`
   holding `editors: Map<path, Editor>` + `activePath`. Each `EditorController` registers/unregisters
   by path. Keep `useActiveEditor()` returning `editors.get(activePath)` so the agent tools and the
   current panel are untouched. Provider + hook tests.

   **DONE** (additive, not a rewrite): kept the single-slot active `editor`/`register` (used by the
   agent tools and the same-file panel) and **added** to `ActiveEditorContext` a path-keyed
   `editors` map with `registerEditor`/`unregisterEditor`. Every file's `EditorController` now adds
   itself to the map by path (the empty no-file editor is excluded — it has no artifacts). The active
   slot stays the "focus" concern; the map is the "what's open" concern the panel will read. Context
   test covers the map.

3. **Path on the artifact (data) + aggregate read.** Add `path` to the `Artifact` union. Replace
   `useEditorArtifacts` with `useOpenArtifacts`, which folds **every** registered editor's
   annotation/proposal state into one list, tagging each artifact with its editor's path and
   subscribing to each editor's transactions. Pure merge + hook tests.

   **Design finding (identity):** artifact ids (`a_1`, `p_1`) are minted **per editor**, so file A and
   file B can each have an `a_1` — ids are not unique across files. The panel must therefore identify
   an artifact by the **composite `(path, id)`** (a small `artifactKey(path, id)` pure helper) for its
   React keys, its active-membership set, and the handler calls. This means steps 3–5 also thread
   `path` (or the whole artifact) through `ArtifactsList`/cards/controller instead of a bare `id`, and
   the controller resolves the target editor via `editors.get(path)`.

   **DONE.** `path` is now on both `Artifact` variants; `artifact-key.ts` exports the pure
   `artifactKey({path, id})` → `path::id`. `to-artifacts.ts` takes `{ path, annotations, proposals }`
   and stamps the path per artifact. `useOpenArtifacts` replaces `useEditorArtifacts`: it reads the
   `editors` map from `ActiveEditorContext`, subscribes to **every** editor's `transaction` stream,
   folds them into one path-tagged list, and returns `{ artifacts, activeKeys }` (composite keys), with
   the `useSyncExternalStore` snapshot cached against the per-editor list of `EditorState` identities.
   `ArtifactsList` now keys cards by `artifactKey` and passes the **whole artifact** to handlers; the
   panel controller resolves the target editor via `editors.get(artifact.path)` for select/accept/
   reject/dismiss. `useReviewTab`'s badge count now spans all open files. Reveal still runs on the
   resolved editor — cross-file open + reveal-after-show is step 5. The cards' own `data-testid`
   (still `artifact-card:<id>`) moves to the composite key in **step 4**, which already edits them for
   the file label; the e2e prefix selector matches either form, so nothing breaks meanwhile.

4. **Card shows its file (#1).** Cards render a file label from `path` (basename via a pure helper,
   reusing `editor-file-name-logic`). View tests; translation-ready label. Also switch the cards'
   `data-testid` to the composite `artifact-card:<path>::<id>` (deferred from step 3) now that the cards
   are being edited anyway.

   **DONE.** New `ArtifactFileLabel.view.tsx` renders the owning file's basename (`.md` stripped, same
   `editorFileName` the top bar uses) as a muted chip with the full path as a hover `title`; both
   `AnnotationCard`/`ProposalCard` place it at the right end of their header row. The cards' `data-testid`
   is now the composite `artifact-card:<path>::<id>` (controller test updated; e2e prefix selector still
   matches). The label is a bare filename — no hardcoded English, so nothing to translate.

5. **Cross-file select (#3).** The panel controller resolves the artifact's editor by `path`. Same
   file → activate decoration + reveal as today. Different file → request `onOpen(path)` (App makes
   it the active/visible file), then activate + reveal in that editor once it's shown. Controller
   tests with two fake editors covering both branches.

   **DONE.** New `OpenFilesContext` carries `{ activePath, open }` — the navigation seam from App's
   open-files state down to the rail-embedded panel without prop-drilling. App provides it (memoized
   over `open.active`); its `open` runs the same `openFile` reducer the explorer uses. The panel
   controller now reads it: `select` resolves `editors.get(artifact.path)`, activates the decoration
   (extracted to an `activate({editor, artifact, wasActive})` helper to respect max-params), and — when
   the artifact is in the active file — reveals immediately; when it is in another open file it stashes
   a `pendingReveal` ref and calls `open(path)`, and a `useEffect` keyed on `activePath` fires the
   reveal once that file becomes the active (visible) one, since a hidden editor cannot be scrolled.
   Because artifacts only exist for mounted editors, `editors.get(path)` always resolves. Controller
   test gains a cross-file case (two editors, asserts `open` is called and the decoration activates in
   the right editor); split into a second `describe` to stay within the function-size limit.

6. **e2e + manifest.** Real-app spec: agent creates an artifact in file A, switch to file B, assert
   A's card still shows (labeled A), click it, assert A reopens and scrolls to the range with the
   decoration intact. Update `e2e/coverage-manifest.ts` feature coverage. (Artifacts are
   renderer-only — no new IPC channel/operation expected.)

   **DONE.** Extended the existing real-agent `artifacts.e2e.ts` rather than paying for a second agent
   run: after it produces both artifacts and accepts the proposal, the spec now seeds a second file,
   opens it (A's editor goes hidden but stays mounted), asserts the annotation card survives in the
   panel labeled `chapter` (A's basename), then clicks the card and asserts the now-visible editor shows
   A's rewritten text again with the annotation highlight (`[class*="annotation-"]`) re-activated —
   exercising the #2/#3 fixes end to end. Visible-editor assertions use `.ProseMirror:visible` since
   inactive editors stay in the DOM under `hidden`. Added `artifacts-cross-file` to the manifest
   `FEATURES`, claimed by this spec's second `@e2e` tag; the audit passes.

## Open questions

- **Hidden mounted editors:** a ProseMirror view inside a `hidden`/`display:none` container — confirm
  re-showing then revealing scrolls correctly (reveal runs after the file is shown, so it should).
- **Memory pre-tabs:** unbounded mounted editors is accepted for now; revisit with the tabs plan's
  close/eviction.
