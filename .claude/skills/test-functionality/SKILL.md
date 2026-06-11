---
name: test-functionality
description: Prove that the change on the current branch actually works by exercising it for real — run it the cheapest faithful way (a throwaway script against the real use cases/window.api, a temp harness, or driving the built app with Playwright's Electron driver) and return a written evidence report for the PR. Use before opening a PR, when the user asks to "prove it works", "test the functionality", or wants evidence beyond unit tests.
---

# Prove the change works (a written report, not instructions)

Unit and jsdom tests prove the code matches the tests. This skill proves the
_product_ works: you exercise the actual change the way it really runs, you
judge the result yourself, and you write down what you did and saw. The
output is a **written evidence report** the caller (usually `finish-plan`)
pastes into the PR body — so the reviewer trusts an attested transcript
(backed by the green checks and the veto gate) instead of exploring the
feature for the first time themselves.

Two distinct things, do not confuse them:

- **Your own verification is unconstrained.** To convince _yourself_ the
  feature works, use whatever throwaway means is cheapest and most faithful —
  a dummy script that calls the use case and `console.log`s the result, a
  temporary spec, a temp hook wired into the frontend to fire a `window.api`
  call, driving the built app and **screenshotting it to look at the result
  yourself**. These artifacts are scratch: they exist only for your judgment
  and are torn down in cleanup. We do not care how hacky they are.
- **The PR gets only a written report.** No images are committed or uploaded.
  The evidence that ships is the text: what you ran, what you observed, the
  verdict. A screenshot is an _input to your judgment_, never an output to the
  PR.

Never write "steps for the user to follow". You follow the steps yourself,
now, and attest what you observed.

## 1. Identify what to prove

Read the plan in `docs/plans/` (or the branch diff, `git diff main...HEAD`)
and list the observable behaviors this change introduces or alters — in user
terms ("creating a note now shows it in the explorer", "an invalid path is
rejected"), not code terms. Each behavior gets its own evidence entry.
Include at least one **negative case** when the change adds a gate or
validation (show it rejecting, not just accepting).

## 2. Exercise the change for real — pick the cheapest faithful harness

Match the harness to what changed. Cheaper is better as long as it really
runs the shipped code path (never mock the thing under test):

- **A use case / IPC channel / pure logic:** the cheapest path. Write a
  throwaway script that imports and runs the real use case (or calls the built
  `window.api` channel) with real inputs, and `console.log`s the outcome —
  success and each typed failure. Run it with `tsx`/`node`. This proves the
  backend behavior without launching the GUI.
- **A renderer hook / behavior that needs `window.api`:** a temporary spec, or
  a temp hook/button wired into the app to fire the call, is fine — anything
  that exercises the real wire end to end.
- **A genuinely visual change (layout, animation, a new panel):** drive the
  **real built app** with Playwright's Electron driver — the same harness the
  e2e suite uses. Build first (`npm run build`; the driver runs
  `out/main/index.js`, not source), then reuse the helpers under `e2e/support/`:
  `launchApp()` (`e2e/support/launch-app.ts`), `withTempFolder(seeds, fn)`
  (`e2e/support/temp-folder.ts`), and `stubFolderPicker(...)`
  (`e2e/support/stub-folder-picker.ts`, the only sanctioned stub — the native
  OS dialog).
  **Screenshot it (`await window.screenshot(...)`) to a scratch path and look
  at the image yourself** to judge whether it looks right. The screenshot is
  for you; it does not go in the report or the repo.

If a behavior cannot be exercised end-to-end (e.g. it needs a live API key
that isn't configured), say so explicitly in the report and show the closest
real thing you _could_ run — never fabricate output.

## 3. Produce the written evidence report

Return a markdown section titled `## Proof it works` containing, per
behavior:

- **Behavior** — one line, in product terms.
- **How it was driven** — the exact throwaway script / command / harness you
  ran, in a fenced block. State plainly when you visually inspected a
  screenshot to judge a visual behavior ("drove the built app and inspected
  the rendered panel").
- **Observed** — the real captured result: stdout/exit code for a script, or a
  precise description of what you saw for a visual check. Real transcripts
  only — paste what actually printed. Note anything trimmed.
- **Verdict** — ✅ works as intended / ❌ does not (with what's wrong).

End with one line: `Evidence verdict: PASS` only if every behavior is ✅;
otherwise `Evidence verdict: FAIL — <summary>`. A FAIL means the change is
not ready: report the failures to the caller instead of polishing the report
around them.

## 4. Clean up

Tear down everything you created to verify: throwaway scripts, temporary
specs, temp hooks/buttons, scratch screenshots, temp fixtures. Leave the
repo's working tree exactly as you found it (`git status --short` should match
the before state — the report is returned as text, it is not a file in the
tree).
