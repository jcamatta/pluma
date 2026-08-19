# Plan: A frontend AI plugin system — recast proposals & annotations as the first plugins

## What & why (product framing)

Pluma's agent already extends itself through tools: the editor contributes `propose_edit`,
`create_annotation`, `insert`, etc. via the renderer tool registry, and those tools surface as
**cards** in the Artifacts panel. But that wiring is _hard-coded_ — each capability hand-registers its
tool spec in `useEditorTools`, its result type is hand-folded into the `Artifact` union in
`to-artifacts.ts`, and its card is a bespoke component in `src/renderer/src/artifacts/`. There is no
seam a _new_ capability could plug into without editing all three places.

The vision: a **plugin** is the unit that bundles (a) AI tools that can read/act on the editor and (b)
the UI representation of what those tools produce. Pluma's own built-ins — **proposals** and
**annotations** — become the first two consumers of that plugin API. Later, users or third parties add
plugins that contribute new AI tools + new card/representation types without touching core code.

This is a large, ambitious, partly-dangerous feature. This plan deliberately ships a **tiny, real
v1**: define the in-process plugin **contract**, build the **host** that registers a plugin's tools
into the existing registry and renders its representations into the existing Artifacts panel, and
**migrate exactly one existing capability (annotations)** onto it as the proof. The dangerous parts —
third-party code sandboxing, a capability/permission model, distribution/marketplace, API
versioning — are **called out as open questions, not built**. v1 plugins are first-party,
trusted, in-process modules; nothing here loads untrusted code.

## Architecture / decision framing (read before the steps)

### The three seams that exist today (this is what we generalise)

A capability today is three hard-coded touch-points. The plugin API is just _naming the seam at each_:

1. **Tool contribution** — `useFrontendTool(entry)` registers `{ spec, handler }` into the
   ref-backed registry in `src/renderer/src/agent/AgentToolsContext.ts`. `AgentProvider` snapshots
   that registry as the run's `tools`; `useToolBridge` dispatches an incoming `agent:tool-call` to the
   matching handler and replies on `agent:tool-result`. (`src/renderer/src/agent/AgentProvider.tsx`,
   `useToolBridge.ts`, `useFrontendTool.ts`.) **The plugin's tools register here unchanged** — the
   registry is already the seam; what's missing is a thing that owns _a set_ of tools as one unit.
2. **Result modelling** — a tool's effect on the document becomes plugin state in a TipTap extension
   (`editor/extensions/annotations.ts`, `editor/extensions/proposals.ts`), folded into the
   `Artifact` discriminated union by `artifacts/to-artifacts.ts` and `artifacts/artifact.ts`. **This
   union is the closed set we must open** — today adding a card kind means editing `artifact.ts`,
   `to-artifacts.ts`, `useOpenArtifacts.ts`, and `ArtifactsList.view.tsx`.
3. **Representation** — `artifacts/AnnotationCard.view.tsx` / `ProposalCard.view.tsx` are switched on
   `artifact.kind` in `ArtifactsList.view.tsx`. **The card-for-kind lookup becomes a plugin-provided
   renderer.**

The backend tool path (`src/main/adapters/agent/tools/backend/`, the gated `create_file` etc.) is the
**mirror image** and out of v1 scope — see open questions. v1 is the _frontend_ plugin surface: tools
that act on the editor + representations in the panel.

### Decision: a Plugin is a renderer-side descriptor; the host is a registry-of-registries

A `FrontendAgentPlugin` is plain data + functions, registered into a **plugin host** that sits beside
the existing tool registry:

```
FrontendAgentPlugin = {
  id: string                              // stable, namespaced (e.g. "pluma.annotations")
  tools: readonly ToolEntry[]             // {spec, handler} — registered into the EXISTING tool registry
  representations: readonly {             // how this plugin's artifacts render
    kind: string                          // the artifact discriminator this plugin owns
    Card: (props) => JSX                  // a view, switched on by kind
  }[]
  // (v1 stops here — no manifest, no permissions, no sandbox; those are open questions)
}
```

The host does three jobs, each reusing machinery that already exists:

- **Tool registration** — on mount, register each plugin's `tools` into the tool registry via the
  existing `register`/`unregister` (so the agent's `tools` snapshot and the bridge dispatch are
  unchanged). This is `useFrontendTool` generalised to "register a plugin's whole tool set."
- **Representation lookup** — replace the hard-coded `kind → Card` switch in `ArtifactsList.view.tsx`
  with a lookup over the registered plugins' `representations`. The `Artifact` union stays the carrier
  (its discriminator is `kind`), but the _card chosen for a kind_ comes from the host, not a `switch`.
- **(deferred) artifact production** — folding a plugin's editor state into `Artifact`s
  (`to-artifacts.ts`) stays hard-coded in v1; opening _that_ seam (a plugin owning its own
  extension + projection) is the next slice, not v1. v1 migrates a capability whose extension and
  projection already exist, proving the tool + representation seams without also re-architecting the
  editor-state→artifact fold.

### Why annotations is the v1 migration target (not proposals)

Annotations is the **smaller, safer** capability: `create_annotation` is a single tool with a simple
JSON result, its card (`AnnotationCard.view.tsx`) is read-only (no accept/reject document mutation),
and its severity model is self-contained. Proposals carries the inline word-diff decoration, the
single-active invariant, and accept/reject document surgery — migrating it first would entangle the
plugin seam with the editor-decoration machinery. v1 migrates annotations end-to-end through the new
host; proposals (and the editor-state→artifact production seam) follow once the contract is proven.

### What v1 explicitly does NOT do

- No third-party / untrusted code. Plugins in v1 are first-party modules imported at build time. No
  dynamic `import()` of user code, no `vm`/iframe/worker sandbox, no plugin manifest file on disk.
- No capability/permission model. v1 plugins get the same ambient access the editor tools have today.
- No distribution, marketplace, install/uninstall, or enable/disable UI.
- No API versioning / stability contract for the plugin shape.
- No change to the **backend** tool catalog or its gated-approval path.
- No new dependency.

These are the genuinely hard parts and are addressed only in **Open questions** — not hand-waved into
the steps.

## Anchors (reuse these, don't reinvent)

- Tool registry + entry shape: `src/renderer/src/agent/AgentToolsContext.ts`
  (`ToolEntry = { spec, handler }`, `ToolRegistry.register/unregister/snapshot/byName`).
- Single-tool registration pattern to generalise: `src/renderer/src/agent/useFrontendTool.ts`.
- Tool snapshot → run, bridge dispatch: `src/renderer/src/agent/AgentProvider.tsx`,
  `src/renderer/src/agent/useToolBridge.ts`.
- The capability being migrated: `src/renderer/src/agent/tools/specs.ts` (`createAnnotationTool`),
  `src/renderer/src/agent/tools/tool-create-annotation.ts`, registration in
  `src/renderer/src/editor/useEditorTools.ts` + `EditorToolsBridge.tsx`.
- Representation today (the `kind` switch to open): `src/renderer/src/artifacts/ArtifactsList.view.tsx`,
  `src/renderer/src/artifacts/AnnotationCard.view.tsx`, `artifacts/artifact.ts` (the `Artifact` union),
  `artifacts/to-artifacts.ts` (projection — stays hard-coded in v1).
- Provider stack to slot the host into: `src/renderer/src/agent/AgentProviders.tsx`
  (`AgentToolsProvider` → `AgentApprovalsProvider` → `AgentProvider`).
- Editor extension that backs annotations: `src/renderer/src/editor/extensions/annotations.ts`
  (`createAnnotation`, `annotationSeverities`).

## Done

- A `FrontendAgentPlugin` contract type exists and is documented in code (one canonical home).
- A **plugin host** (provider + hook) registers a plugin's tools into the existing tool registry and
  exposes a `kind → Card` representation lookup.
- **Annotations is migrated**: its tool (`create_annotation`) and its card render **through the
  plugin**, not through the hard-coded `useEditorTools` registration of the annotation tool and the
  `ArtifactsList` `kind` switch. The agent can still create an annotation and the user still sees the
  annotation card — observably identical behaviour, now flowing through the plugin seam.
- Proposals continues to work unchanged (still hard-coded — it is the proof that the host coexists with
  un-migrated capabilities).
- `npm run lint`, `npm run test`, `npm run type-coverage`, `npm run build` green; the agent/editor and
  artifacts e2e specs still green (the annotation feature's existing e2e id continues to pass through
  the new path — no new id unless the migration changes a user-visible channel, which it must not).

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[frontend]` **Define the plugin contract.**
   - `src/renderer/src/plugins/frontend-agent-plugin.ts`: the `FrontendAgentPlugin` type
     (`id`, `tools: readonly ToolEntry[]`, `representations: readonly PluginRepresentation[]`) and a
     `PluginRepresentation` type (`kind: string`, `Card` view component). Re-use `ToolEntry` from
     `AgentToolsContext`. Plain types only — no behaviour, so no test file needed (type-only module).
   - A short doc comment establishing this file as the contract's single home (per "one canonical
     home").

2. `[frontend]` **Plugin host: context + registration hook.**
   - `src/renderer/src/plugins/PluginHostContext.ts`: a ref-backed registry-of-plugins mirroring
     `AgentToolsContext`'s shape (`register(plugin)` / `unregister(id)` / `representationFor(kind)` /
     `plugins()` snapshot). It does **not** re-implement tool dispatch — it composes the existing tool
     registry.
   - `src/renderer/src/plugins/usePlugin.ts`: registers one plugin for the calling component's lifetime
     — registers the plugin into the host AND registers each of its `tools` into the agent tool registry
     (calling the existing `register`/`unregister`), then mirrors `useFrontendTool`'s ref-keyed cleanup.
   - Tests (>30 lines → lands tests): registering a plugin exposes its tools in the agent registry
     snapshot and its representation via `representationFor`; unmount unregisters both; last-wins on a
     duplicate id.

3. `[frontend]` **Mount the host in the provider stack.**
   - `src/renderer/src/plugins/PluginHostProvider.tsx`: provides the host registry to the subtree
     (mirrors `AgentToolsProvider`).
   - Wire it into `src/renderer/src/agent/AgentProviders.tsx` **inside** `AgentToolsProvider` (so
     `usePlugin` can reach the tool registry) and above `AgentProvider`/the editor subtree.
   - Test: a component under the stack can `usePlugin` and the tool reaches the registry snapshot the
     agent reads.

4. `[frontend]` **Representation lookup replaces the `kind` switch.**
   - Change `src/renderer/src/artifacts/ArtifactsList.view.tsx` (and its controller if needed) to pick
     each artifact's card via the host's `representationFor(artifact.kind)` instead of a literal
     `switch (kind)`. Keep the existing `AnnotationCard.view.tsx` / `ProposalCard.view.tsx` as the
     components the plugins point at — no card rewrite. A `kind` with no registered representation
     renders nothing (defensive) — covered by a test.
   - Tests: with the annotations plugin registered, an annotation artifact renders its card; with no
     plugin for a kind, it renders nothing; proposals (still hard-coded representation, registered as a
     built-in representation in this step or kept switched — see constraint) still renders.

5. `[frontend]` **Migrate annotations onto a plugin.**
   - `src/renderer/src/plugins/builtin/annotations-plugin.ts(x)`: a `FrontendAgentPlugin` (id
     `pluma.annotations`) whose single `tools` entry is the `create_annotation` `{ spec, handler }`
     (the spec from `specs.ts`, the handler built from `tool-create-annotation.ts` over the resolved
     editor — reuse the exact `atPath`/resolve wiring `useEditorTools` uses, do not duplicate logic) and
     whose `representations` is `{ kind: 'annotation', Card: AnnotationCard.view }`.
   - Register it via `usePlugin` where the editor tools mount (`EditorToolsBridge.tsx`), and **remove**
     the annotation tool's hard-coded `useFrontendTool(entries.annotation)` from `useEditorTools.ts`
     (proposals/insert/read tools stay hard-coded). The annotation tool now flows only through the
     plugin — no double registration (last-wins would otherwise mask a regression).
   - Both locales for any new user-facing string (the card text is unchanged, so likely none — confirm).
   - Tests: the annotations plugin registers `create_annotation` into the registry; the agent calling
     it still creates the annotation (reuse the existing tool-round-trip integration pattern in
     `agent/__tests__/tool-round-trip.integration.test.tsx`); the annotation card still renders via the
     representation lookup.

6. `[e2e]` **Confirm the existing annotation e2e still passes through the plugin path.**
   - No new manifest id (no new user-facing channel — the migration is behaviour-preserving). Re-run the
     existing `artifacts`/agent e2e spec that exercises `create_annotation` end-to-end against the real
     app and confirm green. If the migration unavoidably changes a user-triggered channel id (it must
     not), that is a design error to fix, not a new id to add.

7. `[docs]` Remove this plan file in its own `docs:` commit once steps 1–6 ship.

## Constraints

- **Renderer hexagonal/CQS unchanged.** The plugin host is renderer infrastructure, not a new IPC
  surface — no `window.api`, no new channel, no backend change. Tools still reach the bridge through the
  existing registry; the agent still gets its `tools` from the registry snapshot.
- **The `Artifact` discriminated union stays the carrier** in v1. The plugin opens the _card-for-kind_
  seam and the _tool-set_ seam; it does **not** yet open the editor-state→`Artifact` projection
  (`to-artifacts.ts`) — that fold stays hard-coded so the migration is small and behaviour-preserving.
- **No double tool registration.** When annotations migrates, its hard-coded `useFrontendTool` is
  removed in the same step — a tool name must have exactly one registration path.
- **Proposals must keep working** while only annotations is migrated — the host coexists with un-migrated
  capabilities (either proposals is registered as a built-in representation too, or its card stays in the
  switch fallback; pick one in step 4 and keep it consistent — do not half-migrate proposals).
- Frontend rules: design tokens only, Base UI, Motion, `t()` for any new string in both `en.json` +
  `es.json`, view/controller/plain split, `Scrollable` for overflow. No `as` (except `as const`), no
  `@ts-ignore`/`eslint-disable`/non-null `!` — fix the code or ask.
- No new dependency. Minimal diff — do not refactor proposals, the backend tools, or the editor
  extensions beyond what the annotation migration requires.

## Open questions (the hard, deferred parts — NOT built in v1)

- **[BLOCKS third-party plugins] Sandboxing untrusted code.** v1 plugins are first-party modules
  imported at build time with the renderer's full ambient authority (DOM, the live editor, the tool
  bridge). A real third-party plugin is **arbitrary JS running in the renderer** — in Electron that is
  effectively code execution on the user's machine (filesystem via the editor's file tools, the
  network). Options to evaluate before any untrusted plugin ships: an isolated context (`vm`/iframe with
  a constrained bridge), a Web Worker with a message-passing plugin API (no direct DOM/editor handle), or
  a declarative-only plugin (tool specs + a constrained representation DSL, no free JS). Each trades
  capability for safety. **Unresolved — must be decided before loading any non-first-party plugin.** —
  _open_
- **[BLOCKS third-party plugins] Capability / permission model.** Even sandboxed, a plugin needs scoped
  authority: which tools it may contribute, whether it can read closed files (the editor file tools can),
  whether it can mutate the document vs only annotate, network access, persistence. v1 grants ambient
  access (fine for first-party). A capability manifest + a user-facing grant prompt (mirroring the
  existing gated-tool Approve/Reject flow in `AgentApprovalsProvider`) is the likely shape — _open_.
- **[BLOCKS distribution] Packaging, distribution, install/uninstall.** No manifest format, no on-disk
  plugin dir, no marketplace, no enable/disable UI, no update path. A first cut is probably a local
  plugin folder discovered at startup; a registry/marketplace is much later. Interacts directly with the
  sandbox decision (how loaded code is delivered constrains how it can be isolated) — _open_.
- **API surface & stability/versioning.** The v1 `FrontendAgentPlugin` shape (tools + representations) is
  deliberately minimal and will grow (editor-state projection, persistence, settings UI, lifecycle
  hooks). Once third parties depend on it, it needs a versioned, stable contract and a deprecation
  policy. Decide the surface only after the projection seam (below) is opened — _open_.
- **Opening the editor-state → artifact projection.** v1 keeps `to-artifacts.ts` hard-coded. A plugin
  that introduces a _new_ representation kind (not annotation/proposal) also needs to own its TipTap
  extension and its projection into `Artifact`s — opening `artifact.ts`'s closed union and the
  `useOpenArtifacts` fold. This is the natural step 2 of the system (after v1 proves tools +
  representation) — _open, next-slice_.
- **Migrating proposals.** Proposals carries inline word-diff decoration, the single-active invariant,
  and accept/reject document mutation. Migrating it onto the plugin entangles the plugin seam with the
  editor-decoration machinery; do it only after the projection seam is open and the contract has grown a
  document-mutation representation — _open, later_.
- **Backend / gated tools as plugins.** The backend tool catalog
  (`src/main/adapters/agent/tools/backend/`) and its human-approval gate are the symmetric server-side
  surface. Whether a "plugin" can contribute _backend_ (in-process, Effect) tools — and how that crosses
  the process boundary safely — is a separate, larger design than the frontend representation surface
  this plan starts with — _open, separate plan_.
