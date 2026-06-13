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

1. **Pure logic.** [done] `closeFile(state, path)` in `editor/open-files-logic.ts` drops `path` and any
   descendant (a folder delete) from `paths` and recomputes `active` (keep if it survives, else the last
   remaining open file, else `null`); returns the same state by identity when nothing matched. The
   `isWithin` containment helper handles either separator. Nine cases in `open-files-logic.test.ts`,
   including a prefix-sibling guard (`/notes` must not close `/notes.md`).

2. **Context command.** [done] `close: (path) => void` added to `OpenFilesNav`; `App.tsx` wires it as
   `setOpen((current) => closeFile(current, path))`.

3. **Bridge + hook.** [done] `useCloseDeletedFiles` subscribes via `useRepos().writer.onChange` and, on
   `type === 'deleted'`, calls `close(change.path)`. Headless `DeletedFilesBridge` mounts it next to
   `InitialFileBridge`. Hook test (fake writer port emitting a change) covers: closes on `deleted`,
   ignores `created`/`updated`, unsubscribes on unmount.

4. **e2e.** [done] `workspace-open.e2e.ts` gains a case: open a folder with one `.md` (auto-opens),
   delete it through the explorer, assert the editor returns to the "No file open" empty state and the
   file does not reappear on disk. The close is watcher-driven, so the empty-state assertion uses the
   15s watcher timeout the external-delete test already uses. Also adds `operation:file.delete` to the
   spec's `@e2e` tags. Two pre-existing `OpenFilesNav` test fixtures gained the `close` field.

## Notes / open questions

- This fix stacks on `feat/workspace-open-flow` (PR #29): the empty-state fallback it depends on ships
  there. Rebase onto `main` once #29 merges.
- A file deleted inside a **collapsed** subfolder is still pruned: the prune is driven by the watch
  event, not by which folders the explorer has expanded.
