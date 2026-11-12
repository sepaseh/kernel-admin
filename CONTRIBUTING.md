# Contributing

Use the existing checkout and start with [development](docs/development.md), [architecture](docs/architecture.md), the [publication policy](.github/bootstrap-policy.json) and relevant [Git rules](.agents/rules/git.md). Preserve unrelated work.

## Pull requests

1. Verify the current repository, branch, status and intended base. Create or reuse a focused `codex/<purpose>` branch. Every change to protected `main` must arrive through a PR; never push directly to it.
2. Plan for at most 80 GitHub changed-file entries per PR; 100 is the mandatory publication maximum. Before opening a PR or pushing further changes, verify its live intended base and count the complete base-to-proposed-head diff, including additions, deletions, renames and binaries; one rename is one entry. Recount after scope or base changes. Split work exceeding 100 entries into reviewable PRs, or obtain prior explicit user authorization for that specific oversized scope. Cohesion and permission to commit or push do not by themselves waive the maximum. Follow the [scope policy](.agents/rules/pull-requests.md) for an existing oversized PR; do not silently close/recreate it, rewrite history or remove source to reduce the count.
3. Run the actual phase's complete `full` gate on an exact verification-only export under ignored `coverage/`, following [validation](docs/validation.md). Do not publish while required checks fail or cannot run.
4. Use a Conventional Commit title and the [PR template](.github/PULL_REQUEST_TEMPLATE.md). Explain the problem, resulting behavior, dependency PR, checked snapshot and material limitations. A stacked PR targets its verified predecessor and must state that dependency.
5. Publish only with authorization covering publication. A PR request includes its necessary branch push; it does not authorize a CodeRabbit request or merge. Verify those separate action boundaries before proceeding.

Keep the live protection requirements: the required correctness and security check contexts, one native approving review, stale-approval dismissal, an up-to-date branch, resolved conversations, linear history, administrator enforcement, and blocked force pushes/deletions. A PR author cannot supply their own approving review. The CodeRabbit configuration also disables the author-triggered approval shortcut.

A successful CodeRabbit status can represent a skipped or rate-limited review. A native approval count does not select a particular reviewer. Inspect the actual current-head review evidence; do not claim CodeRabbit approval from those settings alone. See [hosted checks and review](docs/validation.md#hosted-checks-and-review).

## Checks

The [manifest](.agents/validation.json) owns commands, profiles and responsibility. Use the pinned Node release and locked root dependencies. Start with the smallest relevant check, then run `npm run validate -- full` on the exact proposed snapshot before an authorized commit, push or PR handoff.

Preserve all required checks and measured coverage. Numerical metrics are advisory under [code quality](.agents/rules/code-quality.md); they do not justify source rewrites or shallow tests. Do not suppress required failures or use unpublished source to make a partial snapshot pass. Local success does not establish hosted CI, scanner execution, the actual Sonar quality gate or approval. When production source is preserved, explain failures and minimal proposals in the current chat and discuss a source edit first, honoring existing approval for that scope. Keep task evidence in the chat or authorized PR materials.

## Documentation

Maintain English, current, task-oriented guides using the [documentation map](docs/README.md). Describe current behavior, contracts and procedures; update the existing owner alongside a behavior or workflow change. Link only files admitted by the current snapshot; identify planned paths as plain inline code rather than broken links. Do not add PR numbers, commit hashes, CI-run results, past owner decisions, dated QA reports, decision logs or translated companion guides. Keep investigation and execution evidence in the current chat or authorized PR materials. Preserve required runtime, source, hash and human-review provenance with technical artifacts such as visual-baseline metadata.

Organize user-facing navigation around installation, capabilities, source work and deployment using the existing guides. Do not create new folders, taxonomies or replacement indexes solely to impose that sequence.

Use public synthetic examples. Keep all ten UI catalogs and Persian calendar data when admitted, with localized product examples clearly identified and explanatory prose in English. Source and optional hooks do not authorize deployment, external review requests or production access.

State the inputs, working directory, shell, expected result and recovery for a procedure. Verify each command against its source owner and each profile against the manifest. Use `npm run validate -- guidance` for focused checks, then follow the full gate before publication.
