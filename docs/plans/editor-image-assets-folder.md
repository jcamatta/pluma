# Image assets folder (relative-path image storage)

Stop inlining images as base64 in the markdown. Instead, when an image enters the editor
(via the `/image` picker, paste, or drag-drop), **copy its bytes into a `assets/` folder
at the workspace root** and reference it from the markdown by a clean relative path —
`![](assets/<name>.png)`. The note file stays small and diff-friendly; the bytes live on
disk once, deduplicated by content hash.

This is a **full-stack, security-sensitive** feature. Unlike the base64 `/image` plan
(`editor-image-slash-command.md`), it touches every layer: a new binary-write use case and
IPC channel, a **custom Electron protocol** so the renderer can actually load a local image
by path (none exists today — images only render as `data:` URLs), and a customized Image
node that displays via the protocol while persisting the relative path.

> **Relationship to the base64 `/image` plan.** That plan adds the `/image` menu entry,
> picker, and dispatch. This plan changes only the **insertion target** for _file_ sources
> (picker + paste + drop) from "encode base64" to "copy to assets, reference relative
> path". The `/image` catalog/menu/picker code is untouched. Remote `http(s)` image
> sources keep inserting their URL verbatim; this plan is about local files. If the base64
> plan has already shipped, this is a migration of the insertion step; if not, build that
> plan first (the menu/picker), then this.

## Done

The user can:

- Insert an image (picker, paste, or drop) and have a file appear under
  `<workspace>/assets/`, with the markdown containing `![](assets/<name>.<ext>)` — **no**
  base64 in the note.
- See the image render in the editor (served through the custom protocol), and have it
  still render after closing and reopening the note.
- Insert the same image twice and get a single file (content-hash naming dedupes).

Checks green: `lint`, `test` (incl. e2e audit), `type-coverage`, `build`, and
`test:e2e`. Because this adds a protocol handler that reads from disk by path, the
`security-review` skill is run before the PR (path-traversal confinement is the key risk).

## Why a protocol is required (the core constraint)

The renderer cannot load `assets/foo.png` as an `<img src>` — there is no `file://`
access, no custom scheme, and main holds no protocol handler today (confirmed: zero
`protocol.register*` in `src/main`). Markdown stores the relative path verbatim, so an
`<img src="assets/foo.png">` would simply fail to load. Two ways to bridge it:

- **Option A — custom `pluma-asset://` protocol (chosen).** Register a privileged scheme
  in main; its handler serves bytes from the workspace `assets/` folder. The Image node
  keeps its `src` attribute = the **relative path** (so markdown round-trips clean and
  portable), and its `renderHTML` maps that to a `pluma-asset://…` URL **only for the DOM
  `<img>`**. The absolute path never enters the markdown — it lives only in the transient
  rendered URL. Native browser loading, handles large images, lazy/scroll for free.
- **Option B — IPC → data URL on load.** On opening a note, walk image nodes, read each
  relative path's bytes via IPC, swap the DOM src to a `data:` URL. Async, re-inlines into
  memory, and still needs the attribute-vs-display split. **Rejected** — more moving parts,
  worse for large images, no real upside over A.

## Design decisions

- **Single workspace-level `assets/` folder; markdown path is workspace-root-relative**
  (`assets/<name>`). The `renderHTML` resolver and the protocol handler both resolve it
  against the active workspace root. (Open question 1 weighs file-relative paths for
  external-tool portability — deferred.)
- **Content-hash filenames.** The stored name is `<sha256-prefix>.<ext>` derived purely
  from the bytes + mime — deterministic, collision-free, and deduplicating. Naming is a
  pure calculation (testable); no `Date`/random.
- **Bytes cross IPC as `Uint8Array`, not base64.** The renderer reads `file.arrayBuffer()`
  → `Uint8Array` and sends it; Electron structured-clones it. No re-encoding on the wire.
- **Security is confined and tested.** The relative→absolute resolver rejects any name
  containing a separator or `..`; the protocol handler serves only existing files under a
  normalized `…/assets/` path with an allowed image extension, refusing everything else.
  Path math lives in pure, unit-tested calculations.
- **Hexagonal + CQS preserved.** New binary write goes through a port
  (`AssetWriterPort`), a use case (`copy-image-to-assets`), an fs adapter, and an IPC
  endpoint returning a `Result`. The protocol handler is an adapter-layer concern at the
  main edge.
- **Idempotent asset creation.** The folder is created with `recursive: true` (a no-op if
  it already exists). Content-hash names mean re-inserting the same image resolves to the
  same filename + identical bytes, so the write is safe to skip or harmlessly repeat. The
  one real error to surface (not crash on) is `assets` already existing as a **file**.
- **Graceful missing-asset rendering.** If an asset file is gone (deleted externally, or
  the workspace moved), the markdown still says `![](assets/…)` and the protocol returns 404. The editor must render a **localized "image not found" placeholder** showing the
  filename — never a broken-image icon.
- **Explorer interaction (markdown-only listing).** `folder:list` now keeps only
  directories + `.md` files (`keep-markdown-entries.ts`). Left as-is, the `assets/` folder
  would appear in the explorer but look **empty** (its images are filtered out). The
  managed `assets/` folder is app plumbing, so this plan **hides it from the listing**.

## Steps

Each step is one small, green, independently reviewable commit. Only `src/` carries commit
weight. **This ships as two PRs:**

- **PR 1 — backend write-path (Steps 1–5).** The `asset:create` contract, use case, port,
  fs adapter, and IPC endpoint. Self-contained and fully tested against a real temp dir;
  the channel is registered but not yet called from the renderer (the normal backend-first
  pattern). No e2e manifest id here.
- **PR 2 — the render story (Steps 6b, 7–15).** The `pluma-asset://` protocol (moved here
  from the original PR-1 grouping, since a handler nothing requests is dead code on its
  own), the customized Image node, the insertion wiring, the missing-asset placeholder, the
  explorer-filter hide (6b), the e2e (manifest id + real-app spec), and the plan's removal.

### Shared contract

1. **`file:copy-asset` contract.** `src/shared/ipc/ipc-contract/file.ts` (or a new
   `asset.ts`) — add the channel constant and types: input
   `{ workspaceRoot: string; bytes: Uint8Array; mimeType: string }`, output
   `Result<{ relativePath: string }, CopyAssetError>`. Add the `pluma-asset` scheme name
   as a shared constant. Pure types; minimal/no test.

### Backend (PR 1)

2. **Error + naming/path logic.** `application/asset/error/copy-asset-failed.ts` (tagged
   error); `application/asset/logic/asset-file-name.ts` (bytes + mime → `<hash>.<ext>`,
   pure) and `application/asset/logic/assets-relative-path.ts` (name → `assets/<name>`).
   `__tests__` for both calculations (stable hash, correct extension per mime, rejects
   unknown mime).
3. **`AssetWriterPort`.** `application/asset/port/asset-writer.port.ts` —
   `writeAsset(workspaceRoot, name, bytes) => Effect<void, …>` (ensures the `assets/`
   directory exists, writes the bytes).
4. **`copy-image-to-assets` use case.** `application/asset/usecase/copy-image-to-assets.ts`
   — compute name (logic) → `writeAsset` → return the relative path. `__tests__` with an
   in-memory `AssetWriterPort` fake covering success and the write-failure error.
5. **fs adapter.** `adapters/asset/fs-asset-writer.ts` — `@effect/platform` `FileSystem`:
   `makeDirectory(assets, { recursive: true })` then `writeFile(target, bytes)`.
   `__tests__` against a temp dir (real bytes round-trip; dir auto-created).
6. **IPC endpoint.** `ipc/file/copy-asset-handler.ts` runs the use case and serializes the
   `Result`; register it in `ipc/register.ts`. No business logic in the handler.
   6b. **Hide the managed `assets/` folder from the explorer.** Extend
   `application/folder/logic/keep-markdown-entries.ts` to also drop a top-level directory
   named `assets` (the app-managed asset store), so it does not surface as an empty folder
   in the explorer now that non-`.md` files are filtered. Update its `__tests__`
   accordingly. Pure logic; weight-light. (See Open question 5 on whether to hide it.)

### Protocol (PR 1, main edge)

7. **Privileged scheme.** `src/main/index.ts` — `protocol.registerSchemesAsPrivileged`
   for `pluma-asset` (secure, supportFetchAPI, bypassCSP off) **before** `app.whenReady`.
   Small, no behavior beyond registration.
8. **Resolver logic.** `adapters/asset/asset-url-logic.ts` — pure calculations: build a
   `pluma-asset://` URL from `(workspaceRoot, relativePath)`, and decode a request URL back
   to an absolute path **with confinement** (normalized path must sit under
   `<root>/assets/`, no `..`, allowed image extension; otherwise `null`). `__tests__`
   covering traversal attempts (`../`, absolute escapes, bad extension) → rejected.
9. **Protocol handler.** `adapters/asset/asset-protocol.ts` — register via
   `protocol.handle('pluma-asset', …)` after ready: decode+confine via step 8, read the
   file, respond with bytes (404/forbidden on reject). Update the renderer CSP
   (`img-src` in `index.html`, weight 0) to allow `pluma-asset:`. Adapter test for the
   decode/confine path; the live handler is exercised by the e2e.

### Renderer (PR 2)

10. **Renderer port + adapter.** Extend the explorer/file ports with
    `copyAsset(workspaceRoot, bytes, mime) => Promise<Result<{ relativePath }, …>>` and the
    `window.api` adapter over `file:copy-asset` (passes the `Result` through unchanged). In-
    memory fake for tests.
11. **Asset-src resolver (renderer).** `editor/extensions/asset-src-logic.ts` — pure
    helpers: is a node `src` a local relative asset (vs `data:`/`http`)? map relative →
    `pluma-asset://` URL given the workspace root; reject traversal. `__tests__`.
12. **Customized Image node.** Configure the Image extension so the stored `src` attribute
    stays the **relative path** (markdown emits `![](assets/…)`) while `renderHTML` outputs
    the resolved `pluma-asset://` URL for the DOM `<img>`, bound to the workspace root at
    editor creation. `__tests__`: a relative-src node round-trips to `![](assets/…)`
    markdown, and the rendered HTML uses the protocol URL; `data:`/`http` srcs pass
    through unchanged.
13. **Wire insertion to assets.** Change the file branch of `extensions/file-handler.ts`
    (paste/drop) and the `/image` action so a chosen/dropped **file** flows: bytes →
    `copyAsset` → insert image node with `src = assets/<name>`. URL/base64 sources keep
    current behavior. Replaces the `fileToDataUrl` call on the file path. `__tests__` update
    the insertion tests to assert `copyAsset` is called and the relative src is inserted.

13b. **Missing-asset placeholder.** Give the Image node an `onerror` path: when the
protocol load fails (deleted/moved file), render a localized placeholder (filename +
`t('editor.image.notFound')`) instead of a broken `<img>`. Implemented via a small node
view or an `onerror` swap to a placeholder element; the relative `src` attribute (and
thus the markdown) is left untouched so the image returns if the file comes back.
`__tests__` for the placeholder render path; the live 404 is also covered by an e2e
case (delete the asset, reopen, assert the placeholder).

### e2e (PR 2)

14. **Operation id + spec.** Add `file.copy-asset` to `OPERATIONS` in
    `e2e/coverage-manifest.ts` (a new real IPC channel) and a real-app `*.e2e.ts` (extend
    the editor spec, which already claims `@e2e feature:editor`): insert an image, assert a
    file materializes under `<tempWorkspace>/assets/`, the markdown on disk contains
    `assets/…` (no base64), and the image renders via the protocol. Drives the real
    protocol + IPC end-to-end.

### docs

15. **Remove this plan** as its own `docs:` commit once shipped (via `finish-plan`).

## Constraints

- **No new dependencies.** `@effect/platform` `FileSystem` covers mkdir + binary write;
  Node `crypto` (main) covers hashing; Electron `protocol` is built in.
- **Hexagonal + CQS.** New port/use case/adapter/IPC for the binary write; protocol is a
  main-edge adapter. `application` never imports adapters or Electron.
- **`Result` at the IPC boundary**, tagged errors, never throw across IPC.
- **No escape hatches, design-token compliance, `t()`** — same bars as every plan. The
  Image node customization must avoid `as` (use `satisfies`/type guards for attribute
  parsing).
- **Security:** the protocol handler must confine reads to `<workspaceRoot>/assets/` with
  no traversal; run `security-review` before the PR.

## Open questions

1. **Workspace-root-relative vs note-file-relative paths.** Stored as `assets/<name>`
   resolved against the workspace root (simple, single folder). Note-relative
   (`../assets/…`) is more portable to external markdown tools but complicates resolution
   for nested notes. **Recommendation:** workspace-root-relative for the MVP; revisit if
   external-tool portability becomes a goal. _Open._
2. **How main learns the workspace root for the protocol.** Chosen design encodes the
   absolute path inside the transient `pluma-asset://` URL (built in the renderer, where
   the root is known) and re-confines in the handler — so **main needs no persistent
   workspace-root state**. The alternative (a `workspace:set-root` channel + a main-side
   root holder for stricter server-side confinement) is heavier. **Recommendation:**
   URL-encoded path + handler confinement; add the root registry only if review wants
   server-authoritative confinement. _Open._
3. **Migrating existing base64 images.** Notes already containing `data:` images keep
   working (the Image node passes `data:` through). A one-off "extract inline images to
   assets" command is **out of scope** here. _Settled as out-of-scope._
4. **Orphaned assets / cleanup.** Deleting an image from a note does not delete its file in
   `assets/`. Garbage-collecting unreferenced assets is **deferred** to a later plan.
   _Settled as out-of-scope._
5. **Hide vs. show the `assets/` folder in the explorer.** Now that `folder:list` filters
   to directories + `.md`, an `assets/` folder would render but look empty. Step 6b hides
   the app-managed `assets/` directory. The alternative is to leave it visible (and later
   teach the explorer to show image files inside it) — but that is a broader "show media in
   the explorer" feature, out of scope here. **Recommendation:** hide it for now. _Open._

## Progress

Naming decided during implementation: the channel is **`asset:create`** (a dedicated
`asset` domain under `application/asset/`), success value is the relative-path **string**
(mirroring `file:create`), and the wire error is a discriminated union
(`UnsupportedImageType` carries `mimeType`; `AssetWriteFailed` carries `path`). The
manifest operation id in step 14 will be `asset.create` (not `file.copy-asset`).

- **Step 1 — DONE** (`feat(asset): add asset:create contract and supported-image-type
rule`). Shared `asset:create` contract + registry union entry; `imageExtensionForMime`
  business rule (png/jpeg/gif/webp → ext, null otherwise) + test. Supported types
  deliberately mirror the renderer's current paste/drop set; broadening to svg/avif/bmp is
  a later, isolated change.
- **Step 2+3 — DONE** (`copyImageToAssets` use case). `UnsupportedImageType` +
  `AssetWriteFailed` tagged errors; `AssetWriterPort` (`writeImageAsset` →
  workspace-relative path); `copyImageToAssets` use case + test against an in-memory fake.
  Refined the wire error to a per-tag discriminated union here. The port's adapter computes
  the content hash and owns the physical `assets/<hash>.<ext>` layout (decided against a
  separate `Hasher` port — YAGNI, single caller).
- **Step 4 — DONE** (`FsAssetWriterLive` adapter). `content-hash.ts` (sha256 hex of bytes,
  Node `crypto`); `asset-storage-path.ts` (pure `assets/<hash>.<ext>` layout, forward
  slashes) + test; `fs-asset-writer.ts` — `makeDirectory(recursive)` + `writeFile(bytes)`,
  any fs failure (incl. `assets` existing as a file) → `AssetWriteFailed`; temp-dir adapter
  test proves create+write, content-hashed path, and dedup.
- **Step 5 — DONE** (`asset:create` IPC endpoint). `ipc/asset/create-asset-handler.ts`
  runs `copyImageToAssets` with `FsAssetWriterLive` + `NodeContext.layer`, maps the typed
  errors to the wire union (`onError`/`onDefect` annotated `: AssetCreateError` so the
  PlainError infers correctly — no cast); registered in `registerIpc`; `asset:create` added
  to `register.test.ts`. Handler test covers ok:true (file on disk) and ok:false
  (UnsupportedImageType). **PR 1 backend write-path is complete** (use case → adapter →
  IPC).
  **PR 1 (backend write-path) is complete — Steps 1–5 all green, opened as its own PR.** The
  `asset:create` channel is registered and tested but not yet invoked; the renderer wiring
  that calls it lands in PR 2.

- **PR 2 — remaining work** (new branch off `main` after PR 1 merges): the
  `pluma-asset://` protocol (Steps 7–9), the customized Image node + insertion wiring +
  missing-asset placeholder (Steps 10–13b), the explorer-filter hide (6b — note: the simple
  version hides any directory named `assets`, since `keepMarkdownEntries` has no root-path
  context), the e2e + `asset.create` manifest id (Step 14), and this plan's removal
  (Step 15). Confirm the protocol's path-confinement model (Open Q2) and run
  `security-review` before opening PR 2.
