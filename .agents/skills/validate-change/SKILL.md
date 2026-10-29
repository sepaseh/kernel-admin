---
name: validate-change
description: Select Kernel Admin checks for the actual change and run the complete canonical gate before an authorized commit, push or PR handoff.
---

# Validate a change

Read the affected source, rules, [validation policy](../../../docs/validation.md)
and [canonical manifest](../../validation.json). Inspect status/diffs when working
in Git; an isolated export has no Git history and must retain its recorded source
commit/tree. Preserve unrelated local work.

1. Start with the smallest relevant published check or test. TypeScript changes
   normally need typecheck and lint; behavior changes need a regression for the
   observable failure. Guidance work uses `npm run validate -- guidance`.
2. The focused guidance profile runs the required `guidance` entry and advisory
   `guidance-tests` (`test:guidance`). The same guidance/safety regressions already
   join the required governance suite and its LCOV; full does not run them twice.
3. Before an authorized commit, push or PR handoff, run
   `npm run validate -- full` on the exact final proposed snapshot. The manifest
   owns every required entry, command and order for the declared capability;
   never substitute a copied count or partial command list. Install dependencies
   and required browsers using the documented phase setup first.
4. Resolve failures within scope and reverify. Never omit, downgrade or replace a
   required check with a faster profile. Report unavailable commands or provider
   evidence honestly; do not claim remote CI ran locally.
5. Record the checked revision/tree, actual results and remaining limits. Read
   admitted files and `applicationReady` from [the publication policy](../../../.github/bootstrap-policy.json).
   While readiness is false, Storybook and synthetic tests cannot establish an
   assembled application. Runnable admission requires genuine application checks;
   component evidence never substitutes for application E2E, a production build,
   human visual approval or deployment evidence. Backend work belongs to the
   separately authorized API repository.

Existing explicit authorization and preferences remain valid throughout the task.
Static guidance checks verify paths and consistency, not automatic assistant
loading, instruction comprehension or improved model performance.
