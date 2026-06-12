# Editor images & GIFs (paste + drag-drop)

Let a writer put images (and animated GIFs) into a manuscript by **pasting from the clipboard** or **dragging a file into the editor**. Rendering uses the official, free `@tiptap/extension-image` node (a GIF is just an image, so it needs no separate extension); the paste/drop UX uses the free `@tiptap/extension-file-handler`. The manuscript still saves as markdown (`editor.getMarkdown()` → `![alt](src)`).

This is the **first PR**. Storage is **Option A — inline base64 data URI** (`![](data:image/png;base64,…)`): renderer-only, no backend, auto-save already works. A follow-up plan ([editor-image-assets.md](editor-image-assets.md)) swaps storage to portable on-disk asset files in a second PR. The seam that makes that swap cheap is the FileHandler `onPaste` / `onDrop` callback, the single place that decides the inserted `src`.

There is **no toolbar "insert image" button** in this plan — slash-command insertion is built separately.

## Done

- A writer can paste an image from the clipboard into the editor and see it render inline.
- A writer can drag an image file from the OS into the editor and see it render inline.
- An animated GIF renders animated; a GIF **copy-pasted from another app** (which arrives as a single-frame PNG in `files`) is inserted from the real URL in `htmlContent`, not the degraded frame.
- The image survives **save → reload** (round-trips through markdown as a data URI).
- `npm run lint`, `npm run test`, `npm run type-coverage`, `npm run build` green; `npm run test:e2e` green with a real-app spec that drops a fixture image and asserts an `<img>` renders and survives reload.

## Steps

### Step 1 — register the Image node ✅ done

_Landed: `@tiptap/extension-image` pinned to exact `3.26.0` (the `^` range resolves to `3.26.1`, which pins `@tiptap/core@3.26.1` and conflicts with the project's locked core `3.26.0`). Registered with `allowBase64: true` so data-URI sources render; round-trip test green._

- **Dep:** add `@tiptap/extension-image` (needs approval — see Constraints).
- `src/renderer/src/editor/extensions/index.ts` — register `Image` in `editorExtensions`, configured with `allowBase64: true` so data-URI sources render. Place it among the node extensions (before `Markdown`).
- `src/renderer/src/editor/extensions/__tests__/image.test.ts` — using the existing editor test harness: inserting an image node and calling `getMarkdown()` round-trips to `![alt](src)`, and setting markdown `![](data:image/png;base64,…)` parses back to an image node.
- **Delivers:** images/GIFs render and round-trip through markdown. No paste/drop yet.

### Step 2 — pure source-resolution logic ✅ done

_Landed: `image-source-logic.ts` exports `ALLOWED_IMAGE_MIME_TYPES`, `filterImageFiles`, `extractImageSrc`, and `resolveImageSource` (→ `{kind:'url'|'file'}`). `extractImageSrc` parses the html with `DOMParser` (no `as`). Decision: prefer an html `<img src>` over the file when present, which covers the pasted-gif degradation. 6 tests green._

- `src/renderer/src/editor/extensions/image-source-logic.ts` — pure calculations, no DOM side effects:
  - filter a `File[]` down to the allowed image types (png, jpeg, gif, webp);
  - given the FileHandler `htmlContent` string, extract the first `<img src>` (a small type-guarded parse, **no `as`**);
  - decide the source strategy: a real GIF pasted from another app comes through as a single PNG frame in `files`, so when `htmlContent` carries an image URL, prefer it over the degraded file.
- `src/renderer/src/editor/extensions/__tests__/image-source-logic.test.ts` — covers the image-type filter, the `htmlContent` extraction, and the GIF-prefer-url branch.
- **Delivers:** the testable decision layer the callback will use. No editor wiring yet.

### Step 3 — wire FileHandler (paste + drop) ✅ done

_Landed: `@tiptap/extension-file-handler` pinned to exact `3.26.0`. `file-handler.ts` wires `onDrop`/`onPaste`; `file-to-data-url.ts` holds the `FileReader` action (resolves null on failure → a failed paste is a no-op, not an unhandled rejection). Insertion is split into a synchronous `insertImageAt` (testable via `withEditor`) and the async `insertImageSource` glue. The FileHandler callbacks need 3 args (`pos` / `pasteContent`) which `max-params: 2` rejects, so `handleDrop`/`handlePaste` are typed rest-tuple functions (one param each, fully type-checked — no rule change, no disable). 5 tests green._

- **Dep:** add `@tiptap/extension-file-handler` (needs approval).
- `src/renderer/src/editor/extensions/file-handler.ts` — configure the extension's `onPaste` / `onDrop`: run the Step-2 logic to choose a source, encode a chosen `File` to a data URI (the thin async action — `FileReader`), and insert an image node at the drop position / selection via editor commands. `allowedMimeTypes` set to the image types.
- `src/renderer/src/editor/extensions/index.ts` — register it.
- `src/renderer/src/editor/extensions/__tests__/file-handler.test.ts` — harness test: simulate a paste/drop of a fake image `File` and assert an image node is inserted; simulate the GIF-as-PNG-with-`htmlContent` case and assert the URL source is used.
- **Delivers:** the full paste + drag-drop UX on base64.

### Step 4 — e2e (real app) ✅ done

_Landed: `e2e/support/drop-image.ts` dispatches a real `drop` DragEvent with a `DataTransfer`+`File` at the surface centre; `editor.e2e.ts` gains a test that drops a PNG, asserts the `<img>` renders, polls the real file on disk for `data:image/png`, then switches files and back to prove it reloads from markdown. Added `DOM`/`DOM.Iterable` to `tsconfig.e2e.json` `lib` (needed for browser-context `evaluate`; standard Playwright setup). No manifest change — `editor` + `file.write` already claimed, no new IPC channel. Both editor specs green._

- `e2e/editor.e2e.ts` — extend the existing `@e2e feature:editor` spec: open a file, drop a fixture image into the editor, assert an `<img>` renders, then trigger save + reload the file and assert the `<img>` is still present.
- `e2e/support/` — add a small fixture image + a drop helper if needed.
- **Manifest:** no change — Option A introduces **no new IPC channel**, and `editor` is already a listed feature in `e2e/coverage-manifest.ts`.
- **Delivers:** the coverage audit stays green and the real desktop app is proven.

### Step 5 — remove the plan

- Delete `docs/plans/editor-images.md` as its own `docs:` commit (handled by `finish-plan`).

## Constraints

- **New dependencies need approval.** This plan adds `@tiptap/extension-image` and `@tiptap/extension-file-handler` (both official `@tiptap/*`, MIT, free). Confirm before Step 1.
- **No `as`, no escape hatches** — the `htmlContent` `<img src>` extraction is a type-guarded parse, not a cast.
- **Markdown is the persisted form** — the data-URI `src` must round-trip through `editor.getMarkdown()` / `setContent(..., { contentType: 'markdown' })`.
- **Renderer-only** — no `src/main` changes; the existing auto-save writes the markdown unchanged.
- **Commit budget** — each step is one small, green, independently reviewable commit; tests land with the code that needs them.

## Open questions

- **Allowed formats / size limit.** Proposed default: png, jpeg, gif, webp; no hard size cap in this base64 phase (revisited in the asset-storage plan). Confirm the format list.
- **Known trade-off (accepted for this PR):** base64 embeds the image bytes into the user's real `.md` via auto-save, enlarging the manuscript. This is the reason the follow-up plan exists; called out so it is a conscious choice, not a surprise.
