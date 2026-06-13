# Create a file without typing `.md`

When a user creates a file in the explorer and types just a name (e.g. `filename`), the file should be created as `filename.md` instead of being silently dropped. Today the renderer joins the typed name onto the parent path verbatim, the backend's `validateMarkdownPath` rejects anything not ending in `.md`, and the create is cancelled with no file on disk. We fix this entirely in the **frontend**: normalize a typed file name to ensure a `.md` extension before building the path. The backend's strict validation stays as-is (it is shared by read/write/delete/rename and must not silently coerce paths).

## Done

- In the explorer, beginning a new **file**, typing `filename` (no extension), and committing creates `filename.md` on disk and selects it.
- Typing a name that already ends in `.md` (any case, e.g. `notes.md`, `Notes.MD`) is left unchanged — no double extension.
- **Folders** are unaffected — no `.md` is appended to a directory name.
- An empty name still cancels the draft (unchanged behavior).
- `npm run lint`, `npm run test` (incl. the e2e coverage audit), `npm run type-coverage`, and `npm run build` are green, and `npm run test:e2e` (the real-app suite) is green for the new create-without-extension spec.

## Steps

### 1. Frontend: ensure `.md` on the typed file name

- **Add** `src/renderer/src/explorer/ensure-markdown-extension.ts` — a pure calculation `ensureMarkdownExtension(name: string): string` that returns `name` if it already ends in `.md` (case-insensitive), otherwise `` `${name}.md` ``. No trimming or empty-handling here — the caller already trims (via `NameInput`) and guards the empty case.
- **Add** `src/renderer/src/explorer/__tests__/ensure-markdown-extension.test.ts` — covers: bare name → appends `.md`; name ending in `.md` → unchanged; uppercase `.MD` → unchanged (no double); name containing a dot but not `.md` (e.g. `my.notes`) → appends `.md`.
- **Change** `src/renderer/src/explorer/useExplorerTree.ts` — in `commitDraft`, after the existing `name === ''` early-return, normalize only for files before joining: `const finalName = current.type === 'file' ? ensureMarkdownExtension(name) : name`, then `joinPath(parent, finalName)` and select `path` on success as today. Directory drafts pass `name` through untouched.
- **Change** `src/renderer/src/explorer/__tests__/useExplorerTree.test.tsx` — add an assertion that committing a file draft with a no-extension name calls `create` with a path ending in `.md` and selects that path; assert a directory draft is unchanged.

Delivers the whole behavior. Single small renderer commit; the new calc and its test land together, satisfying the tests-with-code rule.

### 2. e2e: create a file without typing the extension

- **Change** `e2e/explorer.e2e.ts` — add a test (alongside the existing "creates a file through the UI and selects it") that begins a new file, fills the name input with `draft` (no extension), commits, and asserts the `file-row:<folder>/draft.md` row is visible and `draft.md` exists on disk via the real `file.create` IPC.
- No `coverage-manifest.ts` change: `feature:explorer` and `operation:file.create` already ship and are already claimed by this spec — this is added coverage of existing behavior, not a new feature/channel.

Weight 0 (outside `src/`). Run `npm run test:e2e` and report green.

### 3. Remove this plan (separate `docs:` commit)

When steps 1–2 are shipped and all checks are green, delete `docs/plans/create-file-default-md-extension.md` as its own `docs:` commit, then run `finish-plan` to push and open the PR.

## Constraints

- **Frontend-only fix.** Do not touch `validateMarkdownPath` or any `src/main` use case — backend validation stays strict; the renderer is responsible for handing it a well-formed `.md` path.
- **Calculation, not action.** The extension logic is a pure function in its own file (one export), unit-tested directly; the hook just calls it. Keep it out of the hook body and out of any view.
- No new dependencies. No IPC contract change. No new design tokens, Base UI, or strings — the input placeholder (`explorer.untitled`) is unchanged.
- Hexagonal/CQS boundaries are untouched: this lives entirely in the renderer's explorer command path.

## Open questions

- **Rename** has the same strictness: renaming a file to `foo` (no extension) would fail `validateMarkdownPath` and be a no-op. The request is scoped to **create** only, so rename is intentionally left out of this plan. `SETTLED` — out of scope; raise a separate plan if we want the same affordance on rename.
- A degenerate input of just `.md` (or only an extension) still fails backend validation (`length > '.md'.length`) and cancels. Acceptable; not worth special-casing. `SETTLED`.
