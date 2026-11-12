# Contributing

Use the existing checkout and start with [development](docs/development.md), [source navigation](docs/source-navigation.md), the [publication policy](.github/bootstrap-policy.json) and relevant [Git rules](.agents/rules/git.md). Preserve unrelated work.

## Pull requests

1. Verify the current repository, branch, status and intended base. Create or reuse a focused `codex/<purpose>` branch. Every change to protected `main` must arrive through a PR; never push directly to it.
2. Before opening a PR, review its complete base-to-head diff and aim for at most 80 GitHub changed-file entries initially. Split independent changes when useful and explain why a larger cohesive change belongs together. Count additions, deletions, renames and binaries; one rename is one entry. File count is advisory: exceeding 100 files alone must not fail CI or require deleting and recreating a PR.
3. Run the actual phase's complete `full` gate on an exact verification-only export under ignored `coverage/`, following [validation](docs/validation.md). Do not publish while required checks fail or cannot run.
4. Use a Conventional Commit title and the [PR template](.github/PULL_REQUEST_TEMPLATE.md). Explain the problem, resulting behavior, dependency PR, checked snapshot and material limitations. A stacked PR targets its verified predecessor and must state that dependency.
5. Publish only with authorization covering publication. A PR request includes its necessary branch push; it does not authorize a CodeRabbit request or merge. Verify those separate action boundaries before proceeding.

Keep the live protection requirements: the required correctness and security check contexts, one native approving review, stale-approval dismissal, an up-to-date branch, resolved conversations, linear history, administrator enforcement, and blocked force pushes/deletions. A PR author cannot supply their own approving review. The CodeRabbit configuration also disables the author-triggered approval shortcut.

A successful CodeRabbit status can represent a skipped or rate-limited review. A native approval count does not select a particular reviewer. Inspect the actual current-head review evidence; do not claim CodeRabbit approval from those settings alone. See [hosted checks and review](docs/validation.md#hosted-checks-and-review).

## Checks

The [manifest](.agents/validation.json) owns commands, profiles and responsibility. Use the pinned Node release and locked root dependencies. Start with the smallest relevant check, then run `npm run validate -- full` on the exact proposed snapshot before an authorized commit, push or PR handoff.

Preserve all required checks and measured coverage. Numerical metrics are advisory under [code quality](.agents/rules/code-quality.md); they do not justify source rewrites or shallow tests. Do not suppress required failures or use unpublished source to make a partial snapshot pass. Local success does not establish hosted CI, scanner execution, the actual Sonar quality gate or approval. When source is preserved, record failures and minimal proposals in [source-change requests](docs/source-change-requests.md) and discuss a source edit first.

## Documentation

Maintain English, current, task-oriented guides using the [documentation map](docs/README.md). Update the existing owner alongside a behavior or workflow change. Link only files admitted by the current snapshot; identify planned paths as plain inline code rather than broken links. Do not add dated QA reports, decision logs or translated companion guides.

Use public synthetic examples. Keep all ten UI catalogs and Persian calendar data when admitted, with localized product examples clearly identified and explanatory prose in English. Source and optional hooks do not authorize deployment, external review requests or production access.

State the inputs, working directory, shell, expected result and recovery for a procedure. Verify each command against its source owner and each profile against the manifest. Use `npm run validate -- guidance` for focused checks, then follow the full gate before publication.
