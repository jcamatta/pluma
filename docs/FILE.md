# FILE — what each file is about

This is the project's file index. It replaces the per-file header comment: instead of describing a file in a comment at the top of the source, we describe it here, once, in one place.

## How to use this file

- **Whenever you create, edit, or delete a source file, update this index in the same change.** Create → add an entry. Delete → remove its entry. An edit that changes what the file is _for_ → revise its entry. A pure refactor that doesn't change a file's responsibility needs no change here.
- **Write a functional description:** what the file does — its responsibility, the role it plays, the contract it exposes. One to a few sentences.
- **No history, no process notes.** Don't write "added in plan 04" or "edited to fix X", and don't cite plan IDs. That lives in git and in `docs/plans/`. This index describes each file as it is now, not how it got there.

The index is populated incrementally as files are touched, so it starts mostly empty and fills in over time.

---

## Files

<!-- Add entries below, grouped by area. Key each entry by its full repo-relative path. Example:
### src/main/application/file
- `src/main/application/file/usecase/create-file.ts` — command use case that creates a markdown file at a validated path.
-->

### src/renderer/src/editor

- `src/renderer/src/editor/useEditorTools.ts` — contributes the editor's five frontend tools (get_current_selection, get_current_document, get_ranges, create_annotation, propose_edit) to the agent tool registry for the lifetime of the editor column, binding each handler to the live `Editor` and returning a recoverable error when no document is open.
- `src/renderer/src/editor/__tests__/useEditorTools.test.tsx` — tests that `useEditorTools` registers all five tools, dispatches a handler against the live editor (get_ranges → propose_edit lands a proposal), and reports a recoverable error when no editor is mounted.
