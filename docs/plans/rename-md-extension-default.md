# Default a renamed file's path to `.md`

## Summary

When a writer creates a file with a bare name like `notes`, Pluma already appends `.md` so they get
`notes.md`. Renaming does **not** do this: `renameFile` validates the new path as-is, so renaming to
a bare name fails with `InvalidPath` instead of defaulting to `notes.md`. This change mirrors
`createFile`'s behavior in `renameFile` so the two flows are consistent — a bare new name becomes a
`.md` file on rename.

The defaulting is a domain rule that already lives in the shared logic helper
`ensureMarkdownExtension`; this change reuses it rather than duplicating the rule.

## Done

- Renaming a file to a bare name (e.g. `new`) succeeds and produces `new.md`; the writer is called
  with the extended path and the use case returns it.
- The old path is unchanged in behavior — it is still validated as-is (it already exists as `.md`).
- `renameFile`'s unit test asserts the bare-name-defaults-to-`.md` path instead of the old
  "rejects a non-markdown new path" assertion.
- `npm run lint`, `npm run test`, `npm run type-coverage`, `npm run build` all green.

## Steps

1. **[backend] Default `renameFile`'s new path to `.md`.**
   - `src/main/application/file/usecase/rename-file.ts` (usecase): import `ensureMarkdownExtension`
     and wrap **only** `newPath` — `validateMarkdownPath(ensureMarkdownExtension(newPath))`. Leave
     `oldPath` validated as-is. Update the file header comment to note the defaulting.
   - `src/main/application/file/usecase/__tests__/rename-file.test.ts` (test): replace the
     "fails with InvalidPath when the new path is not markdown" case with one asserting a bare new
     name defaults to `.md` (renames to and returns the extended path); refresh the header comment.
   - Delivers the consistent rename behavior. Lands with its test.

2. **[docs] Remove this plan.** Delete `docs/plans/rename-md-extension-default.md` in its own `docs:`
   commit (performed by `finish-plan`).

## Constraints

- Hexagonal layering: the change stays in the `application/file` use case + its test; no port,
  adapter, IPC, or renderer change. No contract change, so no `[shared]` step.
- Reuse the existing `ensureMarkdownExtension` shared logic — do not duplicate the markdown-default
  rule. This keeps `createFile` and `renameFile` defaulting from one source.
- Minimal diff / no new dependencies. No user-facing strings, so no i18n or e2e manifest change.

## Open questions

- `ensureMarkdownExtension` turns `new.txt` into `new.txt.md` (it only checks for a `.md` suffix),
  so rename inherits that same behavior as create. Confirmed acceptable: consistency with `createFile`
  is the goal. **SETTLED.**
