---
name: finish-plan
description: Close out a completed plan — verify it's done, run the checks, prove the change works (via the test-functionality skill), remove the plan file, push the branch, and open a PR with a structured description for the user to review. Use when the user says a plan/feature is finished, asks to "finish the plan", "open the PR", "wrap up", or otherwise signals the branch is ready for review and approval.
---

# Finish a plan and open its PR

This skill runs the closing sequence for a completed plan. The workflow is: work happens on a branch, commits accumulate through the plan, and when the plan is **done** the branch is pushed and a PR is opened for the user to review and approve. You produce that PR; the user gives final approval. Do not merge.

## 0. Preconditions — stop if any fail

Check these first and stop with a clear message if one isn't met:

- **On a feature branch, not a trunk branch.** Run `git rev-parse --abbrev-ref HEAD`. If it's `main`/`master`/`develop`, stop — there is nothing to PR from a trunk branch. (The `commit-msg` hook already forbids committing there, so this should not happen.)
- **The plan is actually done.** Open the plan file in `docs/plans/`. Every step must be checked off and shipped, with no open/deferred items left to pick up. If anything is unfinished, stop and tell the user what remains — a half-done plan is not finished.
- **Working tree is clean** (everything committed). Run `git status --short`. If there are uncommitted changes, stop and ask — they should be committed (on the branch) first.

## 1. Verify the checks are green

Run the definition-of-done checks and report each result:

- `npm run lint`
- `npm run test`
- `npm run type-coverage`
- `npm run build`
- If the plan shipped or changed user-facing UI, also `npm run test:e2e`.

If any fails, **stop** — the plan is not finishable until they pass. Do not open a PR over red checks.

## 2. Prove the change works (test-functionality skill)

Invoke the `test-functionality` skill (`.claude/skills/test-functionality/SKILL.md`). It exercises the actual change the cheapest faithful way — a throwaway script against the real use cases/`window.api`, a temp harness, or driving the built app with Playwright's Electron driver (screenshotting only for its own visual judgment) — and returns a **written** `## Proof it works` evidence report with real transcripts and a final `Evidence verdict` line. No images are committed or uploaded; the evidence that ships is the text.

- If the verdict is **FAIL**, stop: the plan is not finishable. Report the failing behaviors to the user instead of opening the PR.
- If the verdict is **PASS**, keep the report verbatim — it goes into the PR body in step 3.

## 3. Draft the PR description (from the plan, before deleting it)

The plan file is the raw material — read it now, while it still exists, plus the branch's commits (`git log main..HEAD --oneline`) and the diff stat (`git diff --stat main...HEAD`). Write a PR body with these sections:

- **What was done** — the feature delivered, in product terms. Summarize from the plan's "done" definition and the per-step progress notes.
- **Files** — the key files this change adds/changes and what each is for (mirror the functional descriptions; do not paste history). Group by area.
- **Proof it works** — the evidence report from step 2, verbatim: real commands, real captured output, per-behavior verdicts. This is proof you already exercised the change, not instructions for the user to follow.
- **Tests** — what was tested and at which level (unit/use-case, hooks/views/controllers, e2e), and which manifest ids the e2e specs claim, if any.
- **Notes / open questions** — decisions made, anything deferred to a future plan, anything the reviewer should weigh.

Keep it factual and scannable. No attribution footers (the `commit-msg` hook bans them, and the same applies to PR bodies per project convention). Show the drafted title and body to the user before proceeding.

## 4. Remove the plan (its own commit)

Per the workflow, a completed plan is deleted — git keeps the history. Delete the plan file and commit it **alone**:

```sh
git rm docs/plans/<name>.md
git commit -m "docs: remove plan <name>, complete"
```

(Branch + commit-msg hooks still apply. `docs/` is weight 0, so the size hook is irrelevant.)

## 5. Push the branch and open the PR

Push:

```sh
git push -u origin HEAD
```

Then open the PR against the default base (`main`):

```sh
gh pr create --base main --title "<conventional-commit-style title>" --body "<the body from step 2>"
```

**If `gh` is not authenticated** (`gh auth status` fails) or `gh pr create` errors: do **not** treat it as done. Tell the user to run `gh auth login`, and in the meantime **print the full PR title and body** so they can paste it into the GitHub "compare & pull request" page for the branch (the URL is printed by the push). Report the branch name and the compare URL.

## 6. Report

Tell the user: the branch name, the PR URL (or the paste-ready body if `gh` wasn't available), that the plan file was removed, and that the checks passed.

Then hand the user **two things to review the change themselves**, not just the PR:

- **The PR** to read the diff and approve on GitHub.
- **A ready-to-run command to try the change live**, so they can exercise it by hand in the running app. Give the exact command for _this_ worktree/cwd — a one-liner they can paste that changes into the working directory and launches the app. Use the session's actual working-directory path and the project's real start script (it's the Electron preview, `npm start` — never run it yourself inside a hook or the skill, it does not exit). For example:

  ```sh
  cd "<absolute path of this worktree/cwd>" && npm start
  ```

  Fill in the real absolute path (the current working directory). If the change is reachable only through specific steps in the app, add a short "then: …" line telling the user what to click/open to see it.

Then **stop — the user reviews and gives final approval.** Do not merge the PR yourself.
