# Artifacts panel — the agent's annotations & proposals as reviewable cards

## What "done" looks like

When the agent reviews the manuscript it already produces two kinds of **artifact**, anchored to ranges
in the document:

- **annotations** — review notes on a passage (`label`, `description`, `severity`, `quote`), minted by
  the `create_annotation` tool into the `annotations` TipTap extension (`a_1`, `a_2`, …).
- **proposals** — inline rewrites (`originalText` → `replacementText`, `status: ready | conflicted`),
  minted by `propose_edit` into the `proposals` extension (`p_1`, `p_2`, …).

Today these live only as **editor decorations**, and only the single _active_ one is painted. There is no
surface that shows the user _what the agent produced this run_. This plan adds that surface:

A **Review panel in the rail that lists every annotation and proposal currently in the document as a
card.** Clicking a card **activates it in the editor** (paints its decoration) and **scrolls the
manuscript to it**. A proposal card carries **Accept / Reject**; an annotation card carries **Dismiss**.
The panel updates live as the agent produces or resolves artifacts, and shows an empty state before the
first run.

Done when: the panel ships, `npm run lint`/`test`/`type-coverage`/`build` are green, and a real-app
`*.e2e.ts` spec drives a run that produces an artifact, clicks its card, and accepts a proposal.

## What already exists (the surfaces this plan consumes)

- **Editor extensions** (`src/renderer/src/editor/extensions/`):
  - `annotations.ts` — exports `getAnnotations(editor)`, `getActiveAnnotationId(editor)`,
    `setActiveAnnotation({editor,id})`, `delAnnotation({editor,id})`, and the `Annotation` type. The
    plugin paints **only the active** annotation; activating moves the decoration.
  - `proposals.ts` — exports `getProposals(editor)`, `getActiveProposalId(editor)`,
    `setActiveProposal({editor,id})`, `acceptProposal({editor,id})` (replaces text, or marks
    `conflicted` if the underlying text drifted), `rejectProposal({editor,id})`, and the `Proposal` type.
  - Decoration CSS is already in `App.css`: `.annotation-info/-warning/-error`, `.proposal-delete/
-insert/-conflicted`, **and `.annotation-chip` / `.annotation-divider` / `.annotation-quote`** (the
    card header chip, divider, and quote border, each keyed to `--annotation-color`) — these were added in
    anticipation of the card and are currently unused. Reuse them.
- **Agent tools** (`src/renderer/src/agent/tools/`): `tool-create-annotation.ts`, `tool-propose-edit.ts`
  already write into the extensions above. No new tool or IPC channel is needed — artifacts are
  **renderer-local editor state**, not an IPC resource.
- **Subscription pattern**: `rail/useAgentActivityLog.ts` shows how we subscribe to a live source
  (`agent.subscribe`) and fold it into React state via a ref, without TanStack Query. The editor exposes
  the same shape through TipTap's `editor.on('transaction', …)`. Artifacts are in-memory editor state, so
  they follow this pattern, **not** the IPC query/command hooks.
- **App shell** (`App.tsx`): the editor (`EditorController`) and the rail (`ConversationRailController`)
  are **sibling columns** under `AgentToolsProvider` / `AgentProvider`. The editor instance is created
  _inside_ `EditorController` (`useManuscriptEditor`) and is **not** currently reachable from the rail —
  step 1 fixes that.

## The core problem to solve first: the rail can't see the editor

The agent reaches the editor through the tools registry (`useEditorTools` → `useFrontendTool`), but the
**rail has no handle on the editor instance**, so it cannot read the artifact lists or activate one. We
share it the same way the app shares its other cross-column services — a small React context provided
high enough in `App.tsx` to wrap both columns. This is step 1 and everything else depends on it.

## Steps (each a small, committable unit; checks green at the end)

### 1. Share the live editor across columns ✅ done

Landed: `editor/ActiveEditorContext.ts` (context + `useActiveEditor`, invariant-guarded) and
`editor/ActiveEditorProvider.tsx` (holds the editor in state, memoized value). `EditorController`
registers the live editor via an effect (`register(editor)` / `register(null)` on unmount).
`App.tsx` mounts `ActiveEditorProvider` just inside `AgentProvider`, wrapping both columns. The direct
`Editor.controller` test now wraps in the provider; `App.test` is unaffected (provider is internal).
Tested in `editor/__tests__/ActiveEditorContext.test.tsx` (registers/clears; throws outside provider).
`useActiveEditor` returns `{ editor, register }`: the rail reads `editor`, EditorController calls
`register`. Checks green (lint, the two touched test files, web typecheck).

> Original design notes:

Add an **active-editor seam** so the rail can read/command the same editor the user is editing:

- `src/renderer/src/editor/ActiveEditorContext.ts` — context holding `{ editor: Editor | null,
register: (editor: Editor | null) => void }`.
- `src/renderer/src/editor/ActiveEditorProvider.tsx` — holds the editor in state and supplies the
  context; mount it in `App.tsx` **wrapping both the editor column and the rail** (just inside
  `AgentProvider`).
- `src/renderer/src/editor/useActiveEditor.ts` — reads the context (throws via `invariant` if used
  outside the provider, mirroring `useRepos`/`useAgent`).
- Wire `EditorController` to `register(editor)` in an effect when the editor becomes ready (and
  `register(null)` on unmount), so the provider always holds the currently-mounted editor.

Tests: a small provider+hook test (a component that calls `useActiveEditor` reflects what was registered;
using the hook without the provider throws).

> Decision: a context that _holds_ the instance (not lifting `useManuscriptEditor` to the shell) is the
> least-invasive option and matches the existing provider pattern. The editor stays owned by its column.

### 2. Artifact data model + merge calculation (pure) ✅ done

Landed `artifacts/artifact.ts` (the `Artifact` discriminated union — `AnnotationArtifact` |
`ProposalArtifact`, carrying `id`, `from`, and the per-kind card fields; `severity`/`status` reuse the
extensions' type-only exports) and `artifacts/to-artifacts.ts` (`toArtifacts(annotations, proposals)` →
ordered by `from`). Tested in `artifacts/__tests__/to-artifacts.test.ts` (empty, interleave-by-position,
field mapping). Checks green (test, lint, web typecheck).

> Original design notes:

Create the feature folder `src/renderer/src/artifacts/`:

- `artifacts/artifact.ts` — a **Data** discriminated union the panel renders, independent of TipTap:
  `Artifact = { kind: 'annotation'; id; from; label; description; severity; quote }
| { kind: 'proposal'; id; from; originalText; replacementText; status }`.
- `artifacts/to-artifacts.ts` — a pure calculation `toArtifacts(annotations, proposals): readonly
Artifact[]` that maps the two editor lists into one list **ordered by document position (`from`)** so
  cards read top-to-bottom like the manuscript.
- `artifacts/__tests__/to-artifacts.test.ts` — ordering, mixed kinds, empty.

No editor import here — it takes plain arrays, so it is trivially testable.

### 3. Live artifacts hook (subscription) ✅ done

Landed `artifacts/useEditorArtifacts.ts` returning `{ artifacts, activeIds }` (`activeIds` is the set of
the active annotation + active proposal ids, ≤2). Implemented with **`useSyncExternalStore`** rather than
an effect+setState: the editor is the external store, `editor.on('transaction', …)` the change stream,
and the snapshot is cached against `editor.state` identity (a fresh ProseMirror state per transaction) so
reads are referentially stable — this is what satisfies `react-hooks/set-state-in-effect` honestly. Tested
in `artifacts/__tests__/useEditorArtifacts.test.tsx` (empty without an editor; reflects created
annotation+proposal in document order; tracks the active id; drops a removed annotation), driving a real
headless editor registered into the provider. Checks green (lint, test, web typecheck).

> Original design notes:

`src/renderer/src/artifacts/useEditorArtifacts.ts` — subscribes to the active editor's `transaction`
event, reads `getAnnotations` / `getProposals` / `getActiveAnnotationId` / `getActiveProposalId`, and
returns `{ artifacts: readonly Artifact[]; activeId: string | null }` via `toArtifacts`. Reads the editor
from `useActiveEditor`; returns empty when no editor. Mirror `useAgentActivityLog`'s ref-based
subscribe/fold so it doesn't tear down each render. Returns the same array identity when nothing changed
is _not_ required — keep it simple.

Tests: build a headless editor with the existing harness
(`editor/extensions/__tests__/editor-test-harness.ts`), create an annotation + a proposal, assert the
hook’s `artifacts` reflect them in document order and update when one is removed/activated.

### 4. Card views (pure) — `AnnotationCard` then `ProposalCard`

**4a ✅ done.** Landed `artifacts/ArtifactAction.tsx` (shared Base-UI+Motion text action button,
`primary` variant for Accept, stops propagation) and `artifacts/AnnotationCard.view.tsx` (severity-tinted
chip via `annotationSeverityClass` + the `.annotation-chip/divider/quote` CSS, quoted passage, note, and a
Dismiss action; active card gets the accent ring mirroring the explorer's selected-row treatment;
`data-testid="artifact-card:<id>"`). Tested in `__tests__/AnnotationCard.view.test.tsx` (renders content;
body click selects; Dismiss fires without re-selecting). Checks green.

**4b ✅ done.** Landed `artifacts/ProposalCard.view.tsx` (before/after diff via `--color-destructive` /
`--color-success` tints, accent "Proposed rewrite" chip, active ring). `ready` → Reject + Accept(primary);
`conflicted` → a warning badge and Reject only (a drifted proposal can't apply). Tested in
`__tests__/ProposalCard.view.test.tsx` (renders diff + both actions; body click selects, Accept fires
without re-selecting; conflicted hides Accept and shows the badge). Checks green.

Two `*.view.tsx` files under `artifacts/`, **props-only, hook-free**, design tokens + the existing
`.annotation-*` card CSS + Motion (`rise-in` on mount, `whileHover`/`whileTap`). Split into two commits:

- **4a** `AnnotationCard.view.tsx` — header chip (`label`, severity hue), divider, quoted passage
  (`quote`), `description` body, and a **Dismiss** action. Props: `{ artifact, active, onClick, onDismiss,
labels }`. `active` → accent ring/border (mirror the decoration’s active treatment).
- **4b** `ProposalCard.view.tsx` — before/after diff (reuse the `.proposal-delete`/`.proposal-insert`
  hues), a `conflicted` treatment when `status === 'conflicted'`, and **Accept / Reject** actions. Props:
  `{ artifact, active, onClick, onAccept, onReject, labels }`.

Each with a `__tests__` view test (renders content, fires the right callback, doesn’t call hooks). All
strings via `labels` props (the controller passes `t(...)`).

### 5. Artifacts list view + Review panel controller

- `artifacts/ArtifactsList.view.tsx` — pure: maps `artifacts` to the matching card, threads `activeId`
  and the callbacks through, renders the rail’s shared empty state (reuse `rail/Empty.view.tsx`) when the
  list is empty.
- `artifacts/ArtifactsPanel.controller.tsx` — reads `useEditorArtifacts`, gets the editor from
  `useActiveEditor`, and wires the actions to the **existing extension commands**:
  - card click → `setActiveAnnotation`/`setActiveProposal` **and reveal it** (set a text selection over
    `[from,to]` + `editor.commands.scrollIntoView()`, or a small `revealAnnotation`/`revealProposal`
    helper added to the extension — pick the smaller diff; the decoration is what the user sees light up).
  - Accept → `acceptProposal`; Reject → `rejectProposal`; Dismiss → `delAnnotation`.
  - i18n labels resolved here and passed to the views.

Tests: list view with plain props; controller test rendering inside `ActiveEditorProvider` with a headless
editor — click a card asserts it becomes active, Accept asserts the proposal’s text is applied and the
card leaves the list, Dismiss removes an annotation.

### 6. Mount the panel in the rail + i18n

Surface the panel in the rail. **Lean toward a two-tab rail header (`Chat` | `Review`)** matching the
reference’s split, with a count badge on `Review` (number of unresolved artifacts). The `Review` tab
renders `ArtifactsPanel.controller`; `Chat` keeps the current conversation. This touches the rail shell
(`ConversationRail.view`/`.controller`) — keep the diff to adding the tab strip + slot; if it risks the
size budget, split the tab-shell change from the panel mount.

Add an `artifacts` block to `en.json`: panel title, `empty`, `dismiss`, `accept`, `reject`, `conflicted`,
card a11y labels, and the `Review` tab label + badge. No hardcoded strings. Component/integration test for
tab switching.

### 7. e2e

Add `feature:artifacts` to `e2e/coverage-manifest.ts` (**no new operation id** — annotations/proposals
ride the existing `agent.run`/`agent.event` channels; the artifacts surface adds no IPC). Write
`e2e/artifacts-panel.e2e.ts` claiming `@e2e feature:artifacts`, driving the **real built app**: run a turn
that yields at least one annotation and one proposal, open the `Review` tab, assert the cards render, click
a card and assert the manuscript scrolls/decorates, **Accept** a proposal and assert the manuscript text
changes and the card leaves the list. No `window.api` mocks. Run `npm run test:e2e` green.

> Open question (decide in this step): the agent producing an artifact in e2e depends on a real model run,
> which is non-deterministic. If the existing agent e2e already pins a deterministic scenario, reuse it;
> otherwise the spec may need a fixed prompt/seed that reliably triggers `create_annotation` /
> `propose_edit`. Resolve before writing the assertions.

### 8. Finish

Run `lint`, `test`, `type-coverage`, `build`, `test:e2e`; validate in the **real running app** with
screenshots; remove this plan in its own `docs:` commit; push; open the PR via the `finish-plan` skill.

## Constraints

- **Use our names: annotations and proposals.** Do not call them "notes" — that is the reference’s word.
- Reuse the **existing extension commands** (`setActive*`, `acceptProposal`, `rejectProposal`,
  `delAnnotation`); do not duplicate that logic in the rail.
- `*.view.tsx` stay hook-free and prop-driven; the controller wires the hooks; cards never touch
  `window.api` or the editor directly.
- Design tokens + Base UI + Motion + `t()` for all new UI. Reuse the existing `.annotation-*` /
  `.proposal-*` CSS; **invent no new tokens or colors** (watch for `surface-inverse-*`, which we don’t
  have — the reference uses it; we don’t).
- Each commit within the size budget; a commit > 30 src lines lands with its test.

## Out of scope (don’t build without asking — avoid inventing business behavior)

- **"Mark solved" + "Undo" on annotations**, and **Undo** after accept/dismiss. The reference has these,
  but our model only supports _remove_ (annotations) and _accept/reject_ (proposals). Adding a resolved
  state is new business behavior — ask first.
- **Multi-paint / filter bar** (the reference’s `activeKeys` + `DecorationBar` that paints several
  artifacts at once). Our extensions paint a **single active** artifact; keep that model. One active at a
  time is the MVP.
- **Inline popover** anchored at the clicked decoration in the manuscript, and the **per-turn artifact
  summary chips** under the assistant message. Both are nice follow-ups; the rail panel is the core.
- **Which-thread-produced-it** grouping (`artifactOrigin`) — single active document only for now.

## Open questions

- **Reveal mechanism (step 5).** Set a text selection + `scrollIntoView`, or a dedicated
  `revealAnnotation`/`revealProposal` command on the extension? Prefer the smaller diff; a text selection
  may briefly move the caret — confirm that’s acceptable, else add the command.
- **Rail surface (step 6).** Two-tab header (leaning this way) vs. a collapsible section under the chat.
  The tab matches the reference and keeps chat and review distinct.
- **e2e determinism (step 7).** See the note above — how to reliably make a real run emit an artifact.
