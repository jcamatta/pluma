# Plan: Let the agent read images embedded in a document (`read_image`)

## What & why

A Pluma writer can paste, drop, or link an image into the manuscript; it lives in the document as a
standard markdown image `![alt](src)`. Today the agent's `read_file` returns that markdown as **text**,
so an inline base64 image arrives as a multi-kilobyte opaque blob the model cannot see, and a remote
URL arrives as a bare link. The agent literally cannot look at the picture. This plan adds the ability
for the agent to **see** an image the user embedded, so it can describe it, caption it, or write prose
that responds to it.

This is partly a **feasibility/spike**: the first decision is whether the current runtime can carry an
image into the model at all. It can (see Feasibility below), so this plan builds a real v1 — but the
slices are ordered so the feasibility-proving piece (a backend tool that returns an image content block
the SDK forwards to the model) lands and is provable before any UI polish.

## Feasibility — what is technically possible with the current SDK (verified against the code)

**The runtime CAN forward an image to the model.** The backend tools run as an in-process MCP server
(`src/main/adapters/agent/claude/runtime/build-backend-tool-server.ts`), and the MCP `CallToolResult`
type supports image content blocks — `node_modules/@modelcontextprotocol/sdk/.../types.d.ts` defines
`ImageContentSchema` (`{ type: 'image', data: <base64>, mimeType: <string> }`) and `CallToolResultSchema`
content is a union that includes it. The Claude Agent SDK relays an MCP tool's image content into the
model context. So a backend tool that returns an image content block makes the agent **see** the image.
This is the unblocking fact.

**What blocks it today (must be built):**

- `toCallToolResult` (`.../runtime/to-call-tool-result.ts`) hardcodes one text block:
  `content: [{ type: 'text', text: JSON.stringify(result) }]`. It cannot emit an image block.
- The `AgentToolOutput` union (`src/main/application/agent/data/agent-tool.ts`) is `text | json` only —
  there is no `image` variant to carry base64 + mime through the tool-result boundary.
- `read_file` reads with `readFileString` and validates `.md` only; it returns text. The image bytes
  for an inline data URL are _in_ that text (the base64), but a remote/relative image reference is just
  a path/URL with the bytes elsewhere on disk or the network.

**Two image sources, two retrieval paths** (an embedded image is one or the other):

1. **Inline base64 data URL** — `![alt](data:image/png;base64,...)`. The bytes are already in the
   markdown the agent can fetch; no disk read needed. Verified shape: `image.test.ts` round-trips
   `![a cat](data:image/png;base64,...)`, and `image-source-logic.ts` inlines pasted/dropped files via
   `fileToDataUrl`. Allowed mime types today: `image/png`, `image/jpeg`, `image/gif`, `image/webp`.
2. **Remote/relative URL** — `![alt](https://...)` or a relative path. For a relative on-disk image we
   can read bytes via the platform `FileSystem.readFile` (returns `Uint8Array` — binary read is
   available). For an `https://` URL, fetching remote bytes is **out of scope for v1** (network egress,
   trust) — the tool reports it as unsupported and the agent falls back to the alt text.

**v1 recommendation:** a new **query** backend tool `read_image` that takes the image _source string_
(the `src` the agent already sees in the markdown from `read_file`) and an optional `path` (the
markdown file, to resolve a relative image against). It decodes an inline data URL, or reads a relative
file from disk, into `{ base64, mimeType }`, and returns it as a new `image` `AgentToolOutput` that
`toCallToolResult` maps to an MCP image content block. Remote `http(s)` sources return a typed
"unsupported_image_source" so the agent degrades gracefully. No model/SDK change, no new dependency.

**Why a tool that takes the `src` string (not an auto-injection):** the agent already reads the
document via `read_file` and sees every `![alt](src)`. Letting it ask for the bytes of a specific `src`
keeps the existing read flow intact, is one image per call (bounded context cost), and needs no new way
to enumerate images. The agent decides _which_ image is worth looking at.

## Anchors (reuse these, don't reinvent)

- Backend tool shape + catalog: `src/main/adapters/agent/tools/backend/backend-tool.ts`,
  `read-file-tool.ts` (closest sibling — a query tool reading a file), `index.ts` (`backendTools(deps)`
  catalog), `is-mutating-backend-tool.ts` (read tools are NOT mutating → `read_image` stays a query,
  `readOnlyHint: true`, no approval gate).
- Use-case→result helper: `src/main/adapters/agent/tools/run-use-case-tool.ts`
  (`runUseCaseTool({ effect, toOutput, fallback })`) — `toOutput` returns an `AgentToolOutput`; this is
  where the new `image` output variant is produced.
- Tool-result wire: `src/main/adapters/agent/claude/runtime/to-call-tool-result.ts` — the ONLY place
  that turns an `AgentToolResult` into MCP content; the image-block mapping lands here.
- Output type: `src/main/application/agent/data/agent-tool.ts` — `AgentToolOutput` (`text | json`) gets
  an `image` member.
- Read path: `src/main/application/file/usecase/read-file.ts`, port
  `src/main/application/file/port/file-reader.port.ts`, adapter `src/main/adapters/file/fs-file-reader.ts`
  (`readFileString`; the platform `FileSystem` also exposes binary `readFile: Uint8Array` for the
  relative-file case), validation `src/main/application/file/logic/validate-markdown-path.ts`.
- SDK image content support: `node_modules/@modelcontextprotocol/sdk/dist/esm/types.d.ts`
  (`ImageContentSchema`, `CallToolResultSchema`) — confirms the MCP image block path; do not add a dep.
- System prompt: `src/main/adapters/agent/claude/logic/agent-system-prompt.ts` (+ its test) — teaches
  the agent the tool exists and when to use it.
- Editor image representation (frontend reference only, not changed here):
  `src/renderer/src/editor/extensions/image-source-logic.ts`, `file-handler.ts`, `file-to-data-url.ts`,
  `extensions/index.ts` (`Image.configure({ allowBase64: true })`), `extensions/__tests__/image.test.ts`.

## Scope

- **IN:** decode an **inline base64 data URL** image and a **relative on-disk** image into model-visible
  image content, exposed as a query tool `read_image`; the new `image` `AgentToolOutput` variant +
  `toCallToolResult` mapping; the decode/validate logic + use case; catalog registration + allow-list;
  system-prompt teaching; one real-app e2e.
- **OUT (v1):** fetching remote `http(s)` images (reported unsupported); listing/enumerating all images
  in a document; OCR/text-extraction as a separate path; image _editing_, generation, or insertion;
  raising the editor's allowed mime set; multi-image-per-call batching.

## Done

When shipped, with a document open that contains an embedded image, a writer can ask the agent "what's
in this picture?" / "caption the image below the second heading", and the agent will: read the document,
call `read_image` with that image's `src`, actually see the image, and answer or draft from it. A remote
`https://` image yields a graceful "I can only read images embedded in the file, not remote links"
rather than a failure. Green: `npm run lint`, `npm run test` (incl. e2e coverage audit),
`npm run type-coverage`, `npm run build`; for the e2e, `npm run test:e2e`.

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[backend]` **`image` AgentToolOutput variant + MCP image-block mapping.** (Feasibility-proving core.)
   - `src/main/application/agent/data/agent-tool.ts`: add
     `{ readonly type: 'image'; readonly base64: string; readonly mimeType: string }` to the
     `AgentToolOutput` union. (Pure type change.)
   - `src/main/adapters/agent/claude/runtime/to-call-tool-result.ts`: when the result is
     `{ ok: true, output: { type: 'image', ... } }`, emit
     `content: [{ type: 'image', data: base64, mimeType }]`; otherwise keep the existing single-text-block
     behaviour (text/json still `JSON.stringify`'d). + test: image output → an MCP image content block
     with the right `data`/`mimeType`; text/json output → unchanged text block.
   - Delivers: the runtime can now carry an image to the model. Nothing calls it yet, so it lands green.

2. `[backend]` **Decode/validate logic — pure calculation.**
   - `src/main/application/file/logic/decode-image-source.ts` (new, pure): given an image `src` string,
     classify it — a `data:<mime>;base64,<payload>` URL parses to `{ kind: 'inline', mimeType, base64 }`;
     an `http(s)://` URL → `{ kind: 'remote' }` (unsupported in v1); anything else → `{ kind: 'relative',
ref }` (a path to resolve against the markdown file). Validate the mime against the editor's allowed
     set (`image/png|jpeg|gif|webp`) — mirror the constant locally (adapters/application may not import the
     renderer). + test: each branch, a bad/empty data URL, a disallowed mime.
   - Delivers: the parsing brain, no I/O. Sized as logic + test only.

3. `[backend]` **`read-image` use case + typed errors + port read for the relative case.**
   - Errors (`src/main/application/file/error/`): `UnsupportedImageSource` (remote / disallowed mime /
     unparseable) and reuse `FileNotFound`/`FileReadFailed` for the relative-disk read.
   - `src/main/application/file/usecase/read-image.ts`: input `{ source: string; path?: string }`. For an
     inline source, return `{ base64, mimeType }` straight from `decodeImageSource`. For a relative source,
     resolve `ref` against `path`'s directory, read bytes via the `FileReader` port's binary read, infer
     mime from the extension (within the allowed set), base64-encode. For a remote source, fail
     `UnsupportedImageSource`. (Add a binary `readBytes` method to `file-reader.port.ts` +
     `fs-file-reader.ts` using `FileSystem.readFile: Uint8Array`, only if the relative case is kept in v1 —
     see Open question Q2; if deferred, this step handles inline-only and the port stays unchanged.)
   - - tests (use case): inline data URL → decoded bytes; relative file → read+encoded (against a temp
       dir, mirroring `read_file` tests); remote/disallowed → `UnsupportedImageSource`. If a port method is
       added, its adapter gets a test against a real temp file.
   - May need to split into 3a (inline-only use case + errors) and 3b (port binary read + relative case)
     to stay within the budget and keep the port change isolated.

4. `[backend]` **`read_image` backend tool + catalog registration + allow-list.**
   - `src/main/adapters/agent/tools/backend/read-image-tool.ts`: `BackendTool` whose `spec` is
     `read_image { source: string, path?: string }` (flat schema, `source` required — per the
     agent-tool-wire-schema-flat convention), `description` telling the agent to pass the `src` it saw in
     a `![alt](src)` from `read_file`. `run` arg-guards then calls `runUseCaseTool({ effect: readImage(...)
provided with FsFileReaderLive + NodeContext, toOutput: ({base64,mimeType}) => ({ type:'image',
base64, mimeType }), fallback: 'read_image_failed' })`. It is a **query** (read-only): NOT in
     `MUTATING_BACKEND_TOOL_NAMES`, so `readOnlyHint: true`, no approval card.
   - Register in `tools/backend/index.ts` `backendTools(...)`. `build-options.ts` already merges every
     backend tool's namespaced name into the allow-list automatically (`backendTools: backend.map(t =>
t.spec)` in `claude-runtime-agent.ts`) — confirm `read_image` flows through; no manual allow-list edit
     needed (unlike the gated tools).
   - - tests: tool against a temp dir / inline source — approve-free, returns an `image` output; remote
       source → `{ ok:false, error: 'UnsupportedImageSource' }`; bad args → `invalid_args`.

5. `[backend]` **System prompt teaches `read_image`.** ⚠️ shared, edited-often file — rebase-aware.
   - `agent-system-prompt.ts`: in the read-tools paragraph, teach that after `read_file` shows an
     `![alt](src)`, the agent can call `read_image` with that `src` (and the file `path` for a relative
     image) to actually _see_ the picture — and that remote `http(s)` images can't be read, only embedded
     ones, so fall back to the alt text there. Prose, no emojis, no bullets. Update its test.

6. `[e2e]` **Manifest id + real-app spec.**
   - Add `feature:agent-read-image` to `e2e/coverage-manifest.ts` and a `*.e2e.ts` (pattern:
     `e2e/artifacts.e2e.ts` / the existing agent-tool specs): open a markdown file containing a small inline
     base64 image, drive the agent to look at it, and assert the run completes with a `read_image` tool
     turn (and, if practical, that the reply references the image). Manifest id + spec in the SAME commit.
   - Because asserting on real vision output is brittle, the durable assertion is **the tool ran and the
     run finished green** (the image reached the model); any content assertion stays loose.

7. `[docs]` Remove this plan file in its own `docs:` commit once every step ships.

## Constraints

- **Hexagonal / CQS:** `read_image` is a **query** (read-only, no approval gate). Decode logic is a pure
  calculation in `application/.../logic`; the use case orchestrates logic + the `FileReader` port; the
  tool is an inbound adapter with no business logic. Adapters/application must not import `src/shared` or
  the renderer — mirror the allowed-mime constant locally (per the adapters-cannot-import-shared rule).
- **AgentToolResult boundary holds:** the new `image` output is part of `AgentToolOutput`; errors
  serialize as bare `_tag` strings; nothing throws across the tool boundary or IPC.
- **No new dependency.** Base64 encode/decode via Node's `Buffer`; image content support already exists
  in the bundled MCP SDK. No `as` casts / `@ts-ignore` / `eslint-disable` / non-null `!` — fix the code
  or ask. No hand-rolled SVG, no emojis.
- **Tool wire schema is flat** with `source` top-level required (`oneOf`/nested has made the model drop
  fields before) — validate the agent-facing behaviour with the real-agent e2e, not unit tests alone.
- **Minimal diff / YAGNI:** do not touch the editor, do not change the allowed mime set, do not add
  remote fetching, do not auto-enumerate images. One image per call.
- **Context cost:** an image block consumes real tokens; the tool reads one image the agent explicitly
  named, never the whole document's images at once.

## Open questions

- **Q1 (feasibility — SETTLED):** Can the runtime show the model an embedded image? **Yes** — the MCP
  `CallToolResult` supports image content blocks (`ImageContentSchema` in the bundled
  `@modelcontextprotocol/sdk`) and the SDK forwards them; the only gaps are our `text`-only
  `toCallToolResult` and `AgentToolOutput`, both addressed in step 1.
- **Q2 (scope of v1):** Include the **relative on-disk image** case (needs a binary `readBytes` port
  method + step 3b), or ship **inline-base64-only** first and defer relative images to a follow-up?
  Inline-only is the smaller, fully-self-contained v1 (the bytes are already in the markdown the agent
  reads); relative images are common for non-pasted assets. _Recommendation: ship inline-only as v1
  (steps 1, 2, 3a, 4, 5, 6), and split the port binary-read + relative case (3b) into a follow-up plan
  unless the user wants both now._ **OPEN — needs the user's call before slicing 3.**
- **Q3 (remote images):** Confirm remote `http(s)` images stay OUT for v1 (egress + trust). The tool
  reports `UnsupportedImageSource`; the agent falls back to alt text. _Assumed OUT — confirm._
- **Q4 (multimodal model):** The default run model is `claude-opus-4-8` (`build-options.ts`). Confirm the
  configured models accept image input in this SDK build (they should — Claude is multimodal — but the
  e2e is the real proof). If a non-vision model is ever selected, `read_image` still returns a valid
  block; behaviour there is the model's, not ours. _Assumed fine — the e2e confirms._
- **Q5 (size cap):** Should `read_image` cap the decoded image size (reject very large blobs to protect
  the context window)? _Lean yes — a generous byte cap with a typed error — but only if it doesn't bloat
  step 3 past budget; otherwise a follow-up. OPEN._
