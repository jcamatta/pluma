# File storage & sync strategy — an architecture decision

This is a **decision plan**, not a feature plan. It exists to settle one architectural question before any
durable file-history or sync code is written: **what is the system of record for a writer's files, and how
do we keep the app's view of them consistent with disk** — given that changes can arrive from outside the
app both while it is running (the OS watcher is listening) and while it is closed (it is not). It leads with
the decision and its tradeoffs; the only concrete work it proposes is a small set of **spike / instrumentation
steps** that de-risk the recommended direction. Feature implementation is out of scope until this is approved.

It pairs with [agent-operation-undo-redo.md](./agent-operation-undo-redo.md) (a sibling plan, not yet written):
that plan asks "how do we undo/redo an agent's batch of edits"; this one asks "what records history and owns
truth at all." They share the same substrate question — an operation log or a git-under-the-hood layer would
serve **both** an undo stack and a file-history feature — so the two must not pick conflicting substrates. See
**Cross-reference** below.

---

## The decision

**Question.** Pluma needs (eventually) two things it does not have today: **file history** ("show me / restore
an earlier version of this chapter") and a **robust answer to external change** (a Dropbox sync, a `git pull`
outside the app, an editor in another window, the agent's own writes echoing back through the watcher). Both
press on the same choice: _is there a store of truth besides the files on disk, and if so, how does it stay
honest?_ Four options are on the table:

1. **Disk-as-source-of-truth (status quo, extended).** The `.md` files are the only truth. No mirror, no log.
   History, if added, is layered files (sidecar snapshots) rather than a database.
2. **SQL mirror.** A SQLite (or similar) table mirrors file content/metadata; the app reads from the mirror and
   reconciles it against disk on change. This is the option the user is explicitly worried about.
3. **Hidden git.** A git repository under the project folder (`.git`, never surfaced as "git" to the writer)
   commits snapshots; history and restore are `git log` / `git checkout` under writer-friendly labels.
4. **Operation log (Zed/DeltaDB-style).** An append-only log of operations is the source of truth for _history
   and concurrency_; files on disk are a materialized projection of the log.

**Recommendation (to be confirmed by the spikes below): keep disk as the source of truth, and add history as a
git-backed layer the writer never sees as "git" — adopted only behind a spike that proves the cost. Do NOT
build a SQL content mirror.** Reasoning is in **Why** below; the recommendation is explicitly _provisional_ —
Steps 1–4 are the evidence that confirms or overturns it.

---

## Grounding: what the code does today (cited)

The analysis is grounded in the real code, not a guess.

- **Disk is already the only source of truth — there is no database.** A repo-wide search for
  `sqlite`/`better-sqlite3`/`@effect/sql`/`drizzle`/`kysely`/`prisma`/`CREATE TABLE` finds **zero** matches in
  `src/`; the only hit is a transitive entry in `package-lock.json`. There is likewise **no** `electron-store`,
  `lowdb`, `conf`, `isomorphic-git`, `simple-git`, or `nodegit` dependency. The runtime dependencies relevant
  here are `@effect/platform` (FileSystem), `@parcel/watcher`, `effect`, and `diff` v9 (per
  [package.json](../../package.json)).
- **The single disk I/O seam for files** is two adapters:
  [fs-file-reader.ts](../../src/main/adapters/file/fs-file-reader.ts) (stat-then-`readFileString`, mapping to
  `FileNotFound` / `FileReadFailed`) and [fs-file-writer.ts](../../src/main/adapters/file/fs-file-writer.ts)
  (`createEmptyFile` / `writeFile` / `deleteFile` / `renameFile`, each stat-guarded into typed errors). These
  are the only places that touch real file I/O. Both write paths are **last-write-wins**: `writeFile` blindly
  `writeFileString`s over whatever is on disk — there is no compare-and-swap, no expected-version check.
- **The use cases above them are thin** — [read-file.ts](../../src/main/application/file/usecase/read-file.ts)
  and [write-file.ts](../../src/main/application/file/usecase/write-file.ts) only validate the markdown path and
  delegate to the port. There is **no history side-effect, no journaling, no snapshot** anywhere in the write
  path. Whatever history strategy we pick has a clean, single insertion point here.
- **External change is observed by one watcher**:
  [parcel-folder-watcher.ts](../../src/main/adapters/folder/parcel-folder-watcher.ts) subscribes recursively via
  `@parcel/watcher` and republishes `created`/`updated`/`deleted` events onto an Effect `PubSub`/`Stream`. It is
  forwarded to the renderer by [watch-folder-handler.ts](../../src/main/ipc/folder/watch-folder-handler.ts),
  which forks the forwarding stream onto the app scope. **The watcher only runs while the app is open** — this
  is the crux of the user's second worry: changes made while Pluma is _closed_ are observed by nobody, so any
  in-app cache or mirror is stale on next launch and must be reconciled at open time, not just live.
- **The renderer's current sync policy is a disk-wins baseline reconcile**, and it already works:
  [useEditorFileSync.ts](../../src/renderer/src/editor/useEditorFileSync.ts) owns one open file's content. It
  loads from disk via [useFileContent.ts](../../src/renderer/src/explorer/useFileContent.ts) (a
  `['file', path]` react-query), debounces writes back through `useFileWrite`, and on a watcher `updated` event
  for its path **invalidates the query and re-reads**. The reconcile decision is a one-line pure function,
  [reconcile-file-content.ts](../../src/renderer/src/editor/reconcile-file-content.ts): `disk === base ? skip :
apply`. The baseline advances on the app's own successful writes, which is what absorbs the **self-write echo**
  (the debounced save read back through the watcher) so it does not look like an external change and revert live
  keystrokes. This is a real, working answer to the _live_ external-change problem at single-file granularity —
  any new strategy must not regress it.

**What this grounding establishes:** the app is _already_ a disk-as-source-of-truth system with a working
live-reconcile loop. We are not choosing between a clean slate; we are choosing what (if anything) to _add_ for
**history** and for the **closed-app** reconcile gap — and the burden of proof is on any option that displaces
disk as truth.

---

## Why — the options weighed

### 1. Disk-as-source-of-truth (status quo) — the baseline to beat

**For.** It is what exists and works (the reconcile loop above). It is the writer's mental model: their files are
files, openable in Word, Finder, Dropbox, another editor — Pluma is a lens, not a vault. Zero new dependency,
zero migration, zero "the app's copy disagrees with my file" class of bug. External edits (open or closed) are
just "the file changed" — handled by the watcher when live, by a plain re-read when reopened.

**Against.** It offers **no history** on its own — last-write-wins (the writer or the agent overwrites, and the
prior text is gone). The **closed-app gap** is unsolved for anything richer than "re-read on open": if we ever
cache more than file bytes (open-tab state, annotations, proposals), that cache silently desyncs while closed.
It has **no concurrency primitive** beyond the equality baseline — two writers, or a future multi-device sync,
have nothing to merge against.

**Verdict.** The right _default and floor_. The question is only what to layer on top for history; truth stays
here.

### 2. SQL content mirror — the option the user fears, and rightly

**For.** Fast structured queries (search across files, metadata, "files touched this week") without walking the
tree. A natural home for derived state (annotations, proposals, tab layout) keyed to files.

**Against — this is the hard one, and the user's instinct is correct.** A SQL table that _mirrors file content_
has to be kept identical to disk, and disk changes behind its back in two regimes:

- **While open:** every watcher event must transactionally update the row, and every app write must update both
  the file and the row without a torn window — doubling the write path and adding a self-echo problem worse than
  today's (now a _row_ can disagree with a _file_).
- **While closed:** nothing watches. On next launch the mirror is **stale by an unknown amount** and must be
  fully re-reconciled against disk — at which point the mirror provided no value over reading the files, because
  you had to read the files anyway to trust it. The mirror is only ever as fresh as a full re-scan, and it adds
  a whole class of "DB says X, disk says Y, who wins?" bugs that the current `disk === base` line elegantly
  sidesteps.

A SQL store for _derived, app-owned_ data (annotations, layout, a history _index_) is defensible — that data has
no disk twin to disagree with. A SQL store that **mirrors the canonical bytes of the files** is the trap. **The
recommendation is: never mirror content in SQL.** If SQLite enters Pluma later, it is for app-owned data only,
and that is a _separate_ decision from this one.

### 3. Hidden git — history without a second source of truth

**For.** Git is the **purpose-built tool for file history**: content-addressed snapshots, diffs, restore, branches
— all already disk-native (the working tree _is_ the files; `.git` is the history beside them). Crucially it
**keeps disk as the source of truth**: the checked-out files remain the truth the watcher and editor see; git is
a _history layer_, not a competing mirror. It closes the closed-app gap for history specifically — a commit made
while the app was open survives, and on reopen `git status`/`git log` reconstructs "what changed while I was
away" by diffing the working tree against the last commit, which is exactly the reconcile signal we otherwise
lack. Writers never see "git": the UI says "Version history", "Restore this draft", "Compare to yesterday".

**Against.** A real dependency and real surface area. Two sub-options, each with a cost:

- **Shell out to system `git`** — no bundled binary, but git may be absent on a writer's machine (and CLAUDE.md
  forbids new deps without approval; a system-binary assumption is its own risk).
- **`isomorphic-git`** (pure JS, bundlable) — a genuine new dependency to justify, and slower on large repos.

Either way: _when_ do commits happen (every save? debounced? on close? on agent-batch boundary?) is a real design
question, and a stray `.git` inside a Dropbox/iCloud folder can itself cause sync conflicts. Git's model is also
_coarser_ than per-keystroke — it is snapshots, not an operation stream, so it pairs well with file history but
less naturally with fine-grained live undo/redo (see option 4 and the cross-reference).

**Verdict — the recommended direction for history**, _if_ the spike (Step 2) shows the dependency and the
commit-cadence cost are acceptable. It adds history while leaving the proven disk-truth/reconcile loop intact.

### 4. Operation log (Zed / DeltaDB-style) — powerful, premature

**For.** An append-only log of operations is the most powerful substrate: it is simultaneously the history, the
undo/redo stack, and the concurrency/merge primitive (CRDT-style). Files on disk become a _projection_ of the
log. This is what collaborative, multi-device editors are built on, and it would serve the
[agent-operation-undo-redo.md](./agent-operation-undo-redo.md) sibling plan natively.

**Against.** It **inverts the source of truth** — the log becomes canonical and disk becomes a derived artifact,
which directly contradicts "the writer's files are files." The moment an _external_ tool edits a `.md` (Dropbox,
another editor, `git pull`), that change did not go through the log, so the log and disk diverge and you need a
_disk → log_ import path anyway — re-introducing the very reconcile problem the log was supposed to abolish,
plus a serialization/format-ownership burden. It is a large build (operation model, persistence, projection,
import) for a single-user desktop writing app that does not (yet) have real-time collaboration. **Right tool for
collaborative/multi-device; over-built for today.** Revisit only if Pluma adds live collaboration.

### Summary table

| Option                | Source of truth   | Gives history?  | Handles closed-app change | New dep              | Build size | Fits writer mental model |
| --------------------- | ----------------- | --------------- | ------------------------- | -------------------- | ---------- | ------------------------ |
| 1. Disk (status quo)  | disk              | no              | re-read only              | none                 | none       | yes                      |
| 2. SQL content mirror | **split (bug)**   | as a table      | **stale, full re-scan**   | sqlite               | medium     | no                       |
| 3. Hidden git         | **disk**          | yes (snapshots) | yes (diff vs last commit) | git / isomorphic-git | medium     | yes (if hidden)          |
| 4. Operation log      | **log (inverts)** | yes (native)    | needs disk→log import     | log store            | large      | no                       |

**Net:** disk stays truth (rejects 2 and 4 as the _primary_ store); SQL is allowed only for app-owned derived
data, never content; git is the recommended _history layer_ pending a cost spike; the operation log is deferred
to a hypothetical collaboration era.

---

## Done

This plan is **done** when the recommendation is either confirmed or replaced by **a written architecture
decision recorded in this file**, backed by the spike evidence, covering:

1. **The chosen source of truth** (expected: disk) — stated, with the explicit rule "no SQL mirror of file
   _content_; SQLite, if ever introduced, is for app-owned derived data only."
2. **The chosen history mechanism** (hidden git vs sidecar-snapshot files vs "no history yet") — chosen with the
   spike's measured cost (dependency, commit cadence, repo-in-sync-folder risk) attached.
3. **The closed-app reconcile policy** — what happens on launch when files changed while Pluma was closed, stated
   concretely against the current re-read behavior, including how (if at all) it surfaces "here's what changed
   while you were away."
4. **The boundary with [agent-operation-undo-redo.md](./agent-operation-undo-redo.md)** — a one-paragraph
   statement of which substrate each plan uses so they cannot pick conflicting ones.
5. The instrumentation step (Step 1) leaves behind reusable evidence (logged watcher/write/reconcile metrics) and
   no production behavior change.

A green build/lint/test on whatever small instrumentation lands. No feature is shipped by this plan; feature
plans (a history UI, a git layer) are spun off **after** approval, each as its own `docs/plans/*` file.

---

## Steps

The decision is the deliverable; these steps produce the _evidence_ for it. Each is small, tagged, and
independently green. Steps 2–4 are **spikes** (throwaway / measurement, no merged feature code) per the
design-plan skill's allowance for decision plans.

1. **[backend] Instrument the existing write/reconcile path (the only production code here).**
   - Files: a small log/metric emission added at the write seam
     ([fs-file-writer.ts](../../src/main/adapters/file/fs-file-writer.ts) `writeFile`) and the watcher forward
     ([watch-folder-handler.ts](../../src/main/ipc/folder/watch-folder-handler.ts)), plus a counter for
     self-echo vs genuine-external decisions wired alongside
     [reconcile-file-content.ts](../../src/renderer/src/editor/reconcile-file-content.ts) /
     [useEditorFileSync.ts](../../src/renderer/src/editor/useEditorFileSync.ts) — _measurement only_, behavior
     unchanged.
   - Delivers: real numbers for "how often does an external change actually arrive, and how often is a watcher
     event our own echo?" — the empirical basis for Steps 2–3. Lands with tests for any new pure helper (a
     classifier is pure and testable; the metric emission is a thin side-effect).
   - Why: the cost/benefit of _any_ history or sync strategy depends on the real event rate; today we have none.

2. **[backend] Spike: hidden-git history feasibility (throwaway branch, no merged feature).**
   - Produce a scratch evaluation (not merged production code) answering: shell-out `git` vs `isomorphic-git`
     for snapshot-on-save; measured commit latency on a realistic manuscript; behavior when the project folder
     is inside Dropbox/iCloud (does a nested `.git` cause sync conflicts?); how "what changed while closed" reads
     out as a working-tree-vs-last-commit diff on launch. Output: a written sub-section appended here with the
     measured cost and a go/no-go on the dependency.
   - Why: this is the load-bearing unknown behind the recommendation. Resolve **OQ-1, OQ-2**.

3. **[backend] Spike: closed-app reconcile policy (throwaway).**
   - Evaluate, against the current re-read-on-open behavior, what launch-time reconcile should do when files
     changed while closed — for _content_ (already handled by re-read) and for any _app-owned derived state_ we
     might add later (annotations/proposals/tab layout): detect drift, surface "changed while away", or silently
     adopt disk. Output: the chosen policy stated in **Done #3**. Resolve **OQ-3**.
   - Why: this is the gap disk-as-truth leaves open and the reason a naive SQL mirror fails; it must be answered
     regardless of which history option wins.

4. **[shared] Record the decision and the substrate boundary; spin off follow-on feature plans.**
   - Write the final decision into the **Done** items above (source of truth, history mechanism, closed-app
     policy, substrate boundary with the undo/redo plan). If a history feature is approved, create its own
     `docs/plans/<name>.md` (e.g. `file-version-history.md`) — this plan does not implement it.
   - Resolve **OQ-4, OQ-5**.

5. **[docs] Remove this plan** in its own `docs:` commit once the decision is recorded and any follow-on feature
   plans are filed (per the plans-folder convention: completed plans are deleted, recoverable from git history).

---

## Constraints

- **No new dependency without explicit approval** (CLAUDE.md). Git-under-the-hood means proposing either a
  system-`git` assumption or `isomorphic-git`; the Step 2 spike must _justify_ it before any feature plan adopts
  it. `diff` v9 and `@parcel/watcher` are already present and may be reused freely.
- **Disk stays the source of truth unless this decision explicitly overturns it.** The recommendation is to keep
  it; any option that inverts truth (SQL content mirror, operation log) carries the burden of proof.
- **Do not regress the working live-reconcile loop.** The `disk === base` baseline in
  [reconcile-file-content.ts](../../src/renderer/src/editor/reconcile-file-content.ts) /
  [useEditorFileSync.ts](../../src/renderer/src/editor/useEditorFileSync.ts) already absorbs the self-write echo
  and applies external changes correctly at single-file granularity. Any history/sync layer composes _with_ it.
- **Hexagonal layering holds.** Truth/history is application + adapter concerns; the write seam is the single
  adapter ([fs-file-writer.ts](../../src/main/adapters/file/fs-file-writer.ts)), so a history hook (e.g. commit
  after a successful write) belongs at a use case or a new port, never in the IPC or the renderer.
- **The writer never sees "git" (or "database", or "log").** If git is adopted it is surfaced only as version
  history / restore / compare — the user does not know git; the abstraction must not leak.
- **Single-user, single-device for now.** Real-time collaboration is _not_ a current requirement; do not adopt
  the operation-log/CRDT substrate on speculation. (If that changes, this decision is explicitly reopened.)

---

## Open questions

- **OQ-1 [BLOCKS the history recommendation] — git dependency choice and cost.** Shell-out system `git`
  (no bundle, but may be absent / approval risk) vs `isomorphic-git` (bundlable, a real new dep, slower on large
  repos)? What is the measured snapshot-commit latency on a realistic manuscript? Resolved by the Step 2 spike. —
  _open_
- **OQ-2 [BLOCKS the history recommendation] — git inside a sync folder.** Many writers keep their project in
  Dropbox/iCloud/OneDrive. Does a nested `.git` cause those services to thrash or conflict, and if so is the
  history dir relocatable outside the project (and does relocation break "the files are just files")? Step 2. —
  _open_
- **OQ-3 [BLOCKS closed-app policy] — what to do about state that drifts while closed.** Content is handled by
  re-read; but if we later cache _app-owned_ state (annotations, proposals, tab layout) that has no disk twin,
  how is it reconciled / surfaced on launch? Detect-and-notify, silently adopt disk, or don't cache it at all?
  Step 3. — _open_
- **OQ-4 — commit / snapshot cadence (if history is adopted).** Per save? Debounced (e.g. one snapshot per idle
  gap)? On window close? On an _agent-batch boundary_ (so an agent's multi-file edit is one restorable unit,
  aligning with the undo/redo plan)? Cadence shapes both history granularity and performance. — _open_
- **OQ-5 — is any SQLite warranted at all (for derived data only)?** The recommendation bans a _content_ mirror,
  but a SQLite store for annotations/proposals/search-index/history-index is a _separate_, defensible question.
  Defer to its own decision; flag here so it is not conflated with "SQL mirror = bad." — _open_
- **OQ-6 — restore UX & external-edit interaction.** When a writer restores an old version, does that overwrite
  the working file (which the watcher then reports as an external change to the open editor — does our reconcile
  handle a _restore_ write distinctly from a Dropbox write)? Confirm the restore path threads cleanly through the
  existing baseline. — _open_

---

## Cross-reference: agent-operation-undo-redo.md (sibling, not yet written)

The undo/redo plan and this plan **share a substrate** and must not contradict each other:

- An **operation log** (option 4) would natively serve undo/redo _and_ history — but this plan recommends
  **against** it as the source of truth for a single-user app (it inverts disk-as-truth and re-creates the
  external-edit reconcile problem). So the undo/redo plan should **not** assume an operation log is the canonical
  store.
- **Hidden git** (the recommended history layer) is _snapshot_-grained, which suits **file history and agent-
  _batch_ undo** (revert a whole agent operation = restore the pre-batch snapshot) but is too coarse for live
  per-keystroke editor undo — which TipTap/ProseMirror already provides in-memory. The clean split to record in
  **Done #4**: _live editor undo stays in the editor's in-memory history; durable, restorable "go back to an
  earlier version / undo that agent run" is the history layer's job, snapshot-grained._ That boundary lets both
  plans proceed without a shared operation-log build.
- Whichever this decision picks for history, the undo/redo plan inherits it. Approving this plan first is the
  intended order; the undo/redo plan should reference this file's recorded decision rather than re-litigate the
  substrate.
