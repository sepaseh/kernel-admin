---
name: validate-change
description: Select Kernel checks for the actual change and run the complete canonical gate before an authorized commit, push or PR handoff.
---

# Validate a change

Read the affected source, rules, [validation policy](../../../docs/validation.md)
and [canonical manifest](../../validation.json). Inspect status/diffs when working
in Git; an isolated export has no Git history and must retain its recorded source
commit/tree. Preserve unrelated local work.

1. Start with the smallest relevant published check or test. Behavior changes need
   a regression for the observable failure. Use only commands declared for the
   actual published phase; later application tooling does not establish a current check.
2. Before an authorized commit, push or PR handoff, run
   `npm run validate -- full` on the exact final proposed snapshot in a fresh
   verification-only export. Follow the documented isolation, locked installation
   and synthetic-fixture procedure. The manifest owns every required entry,
   command and order; never substitute a copied count or partial command list.
3. Resolve failures within scope and reverify. Never omit, downgrade or replace a
   required check with a faster profile or weaken assertions/security controls to
   obtain a pass. Numerical metrics are advisory under [code quality](../../rules/code-quality.md).
   Do not stage or commit while a required correctness check fails or cannot run.
4. Record the checked revision/tree, actual results and remaining limits. Read
   admitted files and `applicationReady` from [the publication policy](../../../.github/bootstrap-policy.json).
   While readiness is false, governance and synthetic tests cannot establish an
   assembled application. Application admission requires its genuine complete gate;
   configuration, component tests and installed services do not replace execution.
5. Report unavailable commands or provider evidence honestly. Local success does
   not establish hosted CI, provider analysis, review approval or deployment.

Existing explicit authorization and preferences remain valid throughout the task.
Static guidance checks verify paths and consistency, not automatic assistant
loading, instruction comprehension or improved model performance.

For TypeScript changes, start with the declared typecheck and lint commands.
Guidance work uses `npm run validate -- guidance`; its required `guidance` entry
and advisory `guidance-tests` already join the required governance suite and LCOV,
so full does not run them twice. Install required browsers before phase browser
checks. Component evidence does not replace application E2E, a production build
or human visual approval. The consuming developer chooses a compatible backend;
external project source or documentation is not a prerequisite for validation.
