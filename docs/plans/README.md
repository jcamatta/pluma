# Plans

This folder holds the project's **active** implementation plans — one file per feature in flight. A plan splits a big feature into small, independently committable steps, records what "done" looks like, and serves as the running handoff note: as each step ships, it's marked done in its plan with a short functional summary so the next agent has the context without re-reading the codebase.

**Completed plans are deleted, not archived here.** When every step of a plan has shipped and nothing is left to pick up, the plan file is removed (as its own `docs:` commit) so this folder stays a short list of current work. A removed plan is not lost — read any past plan back from git history:

```sh
git log --oneline -- docs/plans/<name>.md      # find when it lived / was removed
git show <commit>:docs/plans/<name>.md         # read its final state
```

So an empty or short plans folder means little is in flight, **not** that plans were never written.
