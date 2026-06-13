# Close deleted open files

## Problem

When an open file is deleted — through the explorer or by an external change — the editor keeps
showing it and lets the user keep typing. The shell's open-files state (`open` in `App.tsx`) is never
reconciled against the filesystem: the OS watcher refreshes the explorer listing so the row vanishes,
but the deleted path stays in `open.paths`/`open.active`. Its `EditorController` stays mounted, and
`useAutoSave` then writes on the next edit — silently **recreating the deleted file on disk**.

## Done looks like

- Deleting an open file (via the explorer or externally) closes it in the editor: its surface unmounts.
- If it was the only/active open file, the editor falls back to the "No file open" empty state.
- Deleting a folder closes every open file that lived under it.
- A deleted file is not resurrected by a stray autosave, because its editor is gone.

## Seam

The watcher already emits `FolderChange = { type: 'created' | 'updated' | 'deleted', path }`
(`src/shared/ipc/ipc-event-contract/folder.ts`) and the renderer subscribes through
`FolderWriterPort.onChange`. On a `deleted` event we prune matching open paths. No new IPC, no backend
change.

## Steps

1. **Pure logic.** Add `closeFile(state, path)` to `editor/open-files-logic.ts`: drop `path` and any
   descendant of it (a folder delete) from `paths`; recompute `active` (keep if it survives, else the
   last remaining open file, else `null`). Path-containment is a small calculation that handles either
   separator. Tests cover: close active single file → empty; close inactive → active unchanged; close a
   folder prefix → all nested files gone; close active with others open → active falls back.

2. **Context command.** Add `close: (path: string) => void` to `OpenFilesNav` and wire it in `App.tsx`
   as `setOpen((current) => closeFile(current, path))`.

3. **Bridge + hook.** `useCloseDeletedFiles` subscribes via `useRepos().writer.onChange` and, on
   `type === 'deleted'`, calls `close(change.path)`. A headless `DeletedFilesBridge` mounts it next to
   `InitialFileBridge`. Hook test drives a fake writer port that emits a deleted change and asserts the
   open file is closed.

4. **e2e.** Extend the workspace-open spec: open a folder with one `.md`, delete it through the
   explorer, assert the editor unmounts to the empty state and the file does not reappear on disk.

## Notes / open questions

- This fix stacks on `feat/workspace-open-flow` (PR #29): the empty-state fallback it depends on ships
  there. Rebase onto `main` once #29 merges.
- A file deleted inside a **collapsed** subfolder is still pruned: the prune is driven by the watch
  event, not by which folders the explorer has expanded.
