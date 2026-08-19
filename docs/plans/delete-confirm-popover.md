# Plan: delete-confirm popover in the explorer

## What & why

Today, clicking the trash (Delete) action on a file or folder row in the explorer deletes it
**immediately** — there is no confirmation. The trigger is the `Trash2` `IconButton` in
`ExplorerRows.view.tsx` (`onClick={() => ctx.onDelete(node.path)}`), which calls `remove` in
`useExplorerTree.ts` → `useExplorerCommands` → `useDeleteEntry.ts`, hitting the writer port with no
guard.

This change adds an **"Are you sure?"** confirmation. Instead of a centered modal, we anchor a small
Base UI **Popover** right next to the row's trash button — so the user does not move the mouse — with
**Confirm** and **Cancel** inside it. Confirm performs the real delete (the existing path); Cancel
closes the popover and does nothing. Built with Base UI `Popover` + Motion (Base UI
data-starting/ending-style transitions, matching `ContextMeter.tsx`) + design tokens + lucide-react.

This is a **frontend-only** confirmation layer over an already-shipped delete. No backend, no IPC
contract, no new use case. The `explorer` feature and `file.delete` / `folder.delete` operations are
already in the coverage manifest, so **no new manifest id** is added — the existing explorer e2e delete
specs are updated to go through the confirmation.

## Done

When shipped:

- Clicking the trash action on a file or folder row no longer deletes immediately; it opens a small
  popover anchored to that row's trash button with the entry's name, a **Cancel** and a **Confirm**
  (destructive) button.
- **Confirm** deletes the entry (the existing `onDelete` path) and closes the popover; the row
  disappears and the file/folder is gone on disk.
- **Cancel**, clicking outside, or pressing `Escape` closes the popover and deletes **nothing**.
- Only one confirmation is open at a time (Base UI `Popover` open state is per-trigger; opening another
  row's trash closes the previous).
- All user-facing strings are in **both** `en.json` and `es.json`.
- `npm run lint`, `npm run test` (incl. the e2e coverage audit), `npm run type-coverage`,
  `npm run build` green; `npm run test:e2e` green (the updated explorer delete specs pass through the
  popover).

## Anchors (reuse these — don't reinvent)

- Delete trigger today: `src/renderer/src/explorer/ExplorerRows.view.tsx` — the `Trash2` `IconButton`
  in `FileRowContent` and `FolderRowContent`, `onClick={() => ctx.onDelete(node.path)}`.
- The delete callback chain (unchanged below the view): `ctx.onDelete` →
  `Explorer.controller.tsx` (`onDelete={remove}`) → `useExplorerTree.ts` `remove` → `useExplorerCommands`
  → `useDeleteEntry.ts`. **We do not change this chain** — Confirm calls the same `onDelete`.
- Popover pattern to mirror: `src/renderer/src/rail/ContextMeter.tsx` — `Popover.Root` /
  `Popover.Trigger` (rendered as a Motion button) / `Popover.Portal` / `Popover.Positioner`
  (`side`/`align`/`sideOffset`) / `Popover.Popup` with `Popover.Title` and the
  `data-starting-style`/`data-ending-style` fade-scale transition classes.
- Button primitive: `src/renderer/src/components/IconButton.tsx` (Base UI `Button` + Motion); `cn`
  helper at `src/renderer/src/components/cn.ts`.
- Tokens: `src/renderer/src/App.css` — `action-destructive`, `action-secondary`, `surface-2`,
  `text-primary/secondary/muted`, `border`. (`action-destructive` confirmed present.)
- i18n: `src/renderer/src/i18n/locales/{en,es}.json` — the `explorer` block already holds
  `deleteFile` / `deleteFolder`.
- View prop types: `src/renderer/src/explorer/explorer-view-types.ts` (`ExplorerLabels`, `RowContext`).
- e2e to update: `e2e/explorer.e2e.ts` — `'deletes a file through the UI'` clicks Delete and expects
  the row gone immediately; it must now click Delete → click Confirm. (`@e2e feature:explorer`,
  `operation:file.delete` already declared.)

## Design: a self-contained plain component wrapping the trash trigger

The confirmation is local UI state (open/closed) with no data fetching or mutation of its own — it just
calls back the `onDelete` it is handed. That is a **plain/visual** component (`Name.tsx`), not a
view or controller:

- `DeleteConfirm.tsx` (plain) owns the `Popover.Root` open state, renders the trash `IconButton` as the
  `Popover.Trigger`, and on **Confirm** calls the `onConfirm` prop then closes. It receives the entry
  `name`, the trigger `label` (delete-file/delete-folder), the popover copy labels, and `onConfirm`.
- `ExplorerRows.view.tsx` swaps the bare trash `IconButton` (in both `FileRowContent` and
  `FolderRowContent`) for `<DeleteConfirm .../>`, passing `name={node.name}`, the labels from
  `ctx.labels`, and `onConfirm={() => ctx.onDelete(node.path)}`. The view stays pure (no hooks) — the
  popover's local open state lives inside the plain component, which is allowed.

No changes to `Explorer.controller.tsx`, `useExplorerTree.ts`, or `useDeleteEntry.ts` beyond passing
the new labels through (controller resolves the new `t()` keys into `ExplorerLabels`).

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[frontend]` i18n keys + label plumbing.
   - `src/renderer/src/i18n/locales/{en,es}.json`: add to the `explorer` block the popover copy:
     `confirmDeleteTitle` (e.g. "Delete \"{{name}}\"?"), `confirmDeleteBody` (e.g. "This can't be
     undone."), `confirm` ("Delete"), `cancel` ("Cancel"). BOTH locales (parity test enforces it).
   - `src/renderer/src/explorer/explorer-view-types.ts`: extend `ExplorerLabels` with the four new
     fields.
   - `src/renderer/src/explorer/Explorer.controller.tsx`: resolve the four new keys via `t()` into the
     `labels` object. `confirmDeleteTitle` carries an interpolated `{{name}}`, resolved per-row in the
     component (the controller passes the raw template through `t` with the name at render — see step 2),
     so the controller passes the resolver-ready strings; the title is resolved with the node name where
     it is rendered.
   - No test file (label/type plumbing, <30 src lines); existing `Explorer.controller.test.tsx` and
     `Explorer.view.test.tsx` must still pass (they assert existing labels — additive only).

   > Open-question note (Q1): if `confirmDeleteTitle` needs the file name interpolated, the cleanest
   > approach is to pass the **already-resolved** title string from the row using `t('explorer.confirmDeleteTitle', { name })`. But views/plain components may not call `t`. Resolution in step 2.

2. `[frontend]` `DeleteConfirm.tsx` plain component + test.
   - `src/renderer/src/explorer/DeleteConfirm.tsx`: a plain component. Props: `name: string`,
     `triggerLabel: string` (the existing delete-file/delete-folder aria-label), `title: string`,
     `body: string`, `confirmLabel: string`, `cancelLabel: string`, `onConfirm: () => void`. It owns
     `const [open, setOpen] = useState(false)`. Structure mirrors `ContextMeter.tsx`:
     - `Popover.Root open={open} onOpenChange={setOpen}` with `Popover.Trigger` rendered as the trash
       `IconButton`/Motion button (keep `aria-label={triggerLabel}`, `stopPropagation` so the row's
       click handler doesn't fire), `Trash2` icon.
     - `Popover.Portal` → `Popover.Positioner side="right" align="center" sideOffset={8}` (anchored next
       to the row, per the feature) → `Popover.Popup` with the same
       `data-starting-style`/`data-ending-style` fade-scale transition classes as `ContextMeter`, in
       tokens (`bg-surface-2`, `border-border`, etc.).
     - Inside: `Popover.Title` = `title`, a body line = `body`, then a Cancel (`action-secondary`) and a
       Confirm (`action-destructive`) Base UI `Button` (Motion press, per `IconButton`). Cancel:
       `setOpen(false)`. Confirm: `onConfirm()` then `setOpen(false)`.
     - `data-testid="delete-confirm-popup"` on the popup; `data-testid` on Confirm/Cancel if no stable
       role/label handle (prefer `getByRole('button', { name: confirmLabel })`).
   - Resolves Q1: the **title string is passed in already-resolved** (the parent — the row in
     `ExplorerRows.view`, which receives labels but not `t` — gets the resolved title from the
     controller via the labels). Since the title needs the per-node name, the controller cannot resolve
     it (it doesn't know the node). So: `ExplorerLabels` carries the **template-resolving pieces** the
     view needs, and the title is composed where the node is known. To keep views `t`-free, the cleanest
     resolution is: the controller passes a `confirmDeleteTitle` **function-free** approach by adding the
     interpolation at the controller via a small map — BUT the node name is per-row. **Decision:** make
     `DeleteConfirm` receive `name` + a pre-resolved `titleTemplate` is wrong; instead pass the **two
     parts** (`title` already containing `{{name}}` resolved). Final decision recorded in Open
     questions Q1 — pick one before implementing this step.
   - Test `src/renderer/src/explorer/__tests__/DeleteConfirm.test.tsx`: render the component; the popup
     is not shown until the trigger is clicked; clicking the trigger opens it and shows the title/body;
     clicking **Confirm** calls `onConfirm` exactly once and closes; clicking **Cancel** does **not**
     call `onConfirm` and closes; the trigger keeps its `triggerLabel` aria-label.

3. `[frontend]` Wire `DeleteConfirm` into the rows.
   - `src/renderer/src/explorer/ExplorerRows.view.tsx`: in `FileRowContent`, replace the trash
     `IconButton` with `<DeleteConfirm name={node.name} triggerLabel={ctx.labels.deleteFile}
title={...} body={ctx.labels.confirmDeleteBody} confirmLabel={ctx.labels.confirm}
cancelLabel={ctx.labels.cancel} onConfirm={() => ctx.onDelete(node.path)} />`. Same in
     `FolderRowContent` with `deleteFolder`. The other row actions (new file/folder, rename) are
     unchanged.
   - Title interpolation lands here per the Q1 decision (the row knows `node.name`).
   - Update `src/renderer/src/explorer/__tests__/Explorer.view.test.tsx` if it asserted an immediate
     delete on the trash button — re-point it to open the popover then click Confirm. (If it only
     asserts presence of the delete control, additive.)
   - Net new view code is small; the behavioral test lives in step 2's `DeleteConfirm.test.tsx` and the
     updated view test, so this step stays under the test-required threshold via those touched test
     files.

4. `[e2e]` Update the explorer delete specs to pass through the popover.
   - `e2e/explorer.e2e.ts`: in `'deletes a file through the UI'`, after
     `row.getByRole('button', { name: 'Delete file' }).click()`, add
     `await window.getByRole('button', { name: 'Delete' }).click()` (the Confirm button) and keep the
     existing assertions that the row is gone and the file left disk. Add a second assertion that the
     popup (`getByTestId('delete-confirm-popup')`) appears after the trash click and that **Cancel** (or
     `Escape`) leaves the file on disk — a real "cancel does nothing" case. No new manifest id:
     `@e2e feature:explorer operation:file.delete` already covers this; folder delete is already covered.
   - No `coverage-manifest.ts` change (the ids already exist; adding one without a new spec/feature
     would not be warranted and YAGNI).

5. `[docs]` Remove this plan file in its own `docs:` commit once steps 1–4 ship (performed by
   `finish-plan`).

## Constraints

- **Frontend-only.** No backend, no IPC contract, no new use case, no new dependency. The delete itself
  flows through the unchanged `onDelete` → `useExplorerTree` → `useDeleteEntry` chain.
- **Plain component, not view/controller.** `DeleteConfirm.tsx` owns only local open/closed `useState`;
  no data fetching, no `window.api`. Views (`ExplorerRows.view.tsx`, `Explorer.view.tsx`) stay
  hook-free; the controller resolves `t()`.
- **Base UI + Motion + tokens only.** Use Base UI `Popover` (mirror `ContextMeter.tsx`); animate the
  popup via Base UI `data-starting-style`/`data-ending-style` transition classes and the Motion press
  on buttons (as `IconButton` does) — no `framer-motion`, no hand-rolled SVG, no native
  `overflow-*` scroll, no arbitrary bracket/fractional values. Confirm button uses `action-destructive`.
- **i18n both locales.** Every new key in `en.json` AND `es.json`; no hardcoded UI strings; one key per
  string. Respect reduced motion.
- **No escape hatches.** No `eslint-disable` / `@ts-ignore` / `as` (except `as const`) / non-null `!`.
- **Minimal diff / YAGNI.** Don't touch the create/rename actions, the delete hook, or unrelated
  explorer code. One confirmation open at a time is the natural Base UI behavior — don't add global
  open-state management.
- **`stopPropagation` on the trigger** so opening the popover doesn't also select the file / toggle the
  folder (the trash button already does this today via `IconButton`'s `stopPropagation`).

## Open questions

- **Q1 — title interpolation seam (blocks step 2/3).** `confirmDeleteTitle` wants the entry name
  (`Delete "chapter-1.md"?`). Views and plain components may not call `t`. Two candidate resolutions:
  (a) the **row** (`ExplorerRows.view`) composes the title from a label template — but that re-implements
  interpolation in a view, which is `t`-free but still string-templating; (b) **`DeleteConfirm` receives
  `name` and a plain `title` already containing the name**, with the controller unable to interpolate
  per-node. **Preferred:** pass `name` into `DeleteConfirm` and have the **controller** expose the title
  as a function-free, name-agnostic pair — i.e. keep the popover title generic ("Delete this file?" /
  "Delete this folder?") with the entry **name rendered as a separate, non-translated element** inside
  the popup (the name is data, not copy). This sidesteps interpolation entirely: `confirmDeleteTitle`
  becomes a static per-type string and the file name is shown verbatim. Decide between
  per-type-static-title-plus-name (preferred, no interpolation) vs. interpolated title before
  implementing. **Open.**
- **Q2 — copy.** Exact English/Spanish wording for the title/body/buttons (e.g. body "This can't be
  undone." vs. none; Confirm label "Delete" vs. "Confirm"). Defaulting to title "Delete this file?" /
  "Delete this folder?", name shown verbatim, body "This can't be undone.", buttons "Delete" /
  "Cancel". Confirm with the user. **Open.**
- **Q3 — anchor side.** `side="right"` puts the popover beside the row (the feature's intent: "right
  next to the row, don't move the mouse far"). The explorer is the left rail, so `right` opens into the
  editor area — verify it doesn't clip; Base UI flips automatically, but confirm `side`/`align` in the
  real app screenshot during implementation. **Open (verify in app).**
