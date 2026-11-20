# Contributing

Use the existing checkout and preserve unrelated tracked, staged and untracked
work. Read the [assistant entry point](AGENTS.md) and the
[Git workflow](.agents/rules/git.md). Check which files are admitted in the
[publication policy](.github/bootstrap-policy.json).

Find the source owner in [Development](docs/development.md) and
[Architecture](docs/architecture.md).

## Pull requests

Verify the repository, current branch, status and intended base. Create or
reuse a focused `codex/<purpose>` branch. Keep changes to protected `main`
on a pull request.

Review the complete diff against the intended base. Aim for at most 80
changed-file entries. Count additions, deletions, renames and binaries,
with one entry per rename. Split independent changes and explain larger
cohesive changes.

Recount after scope or base changes. Publishing over 100 entries requires
explicit authorization for that specific scope. Get the count against the live
intended base before opening a PR or pushing further changes. Follow the
[PR scope procedure](docs/validation.md#review-pr-scope-before-opening)
for splitting changes and handling an existing oversized PR.

Use a Conventional Commit title and the [PR template](.github/PULL_REQUEST_TEMPLATE.md).
Explain the problem, resulting behavior, checked snapshot and material
limitations. A stacked PR targets its verified predecessor and states that
dependency.

Publish only with authorization covering publication. A PR request includes
its necessary branch push. CodeRabbit requests and merges require separate
authorization.

Keep the live protection requirements: the required correctness and security
check contexts, one native approving review, stale-approval dismissal, an
up-to-date branch, resolved conversations, linear history, administrator
enforcement, and blocked force pushes and deletions. The author cannot supply
their own approving review. CodeRabbit configuration disables the
author-triggered approval shortcut.

A successful CodeRabbit status can represent a skipped or rate-limited review.
A native approval count does not select a particular reviewer. Inspect actual
review evidence for the current head.
[Hosted checks and review](docs/validation.md#hosted-checks-and-review)

## Checks

Use the Node version in [.nvmrc](.nvmrc) and the locked root dependencies.
Start with the smallest relevant check in the
[validation manifest](.agents/validation.json). Keep all required checks
active. Report actual commands, results and unavailable evidence.

Before an authorized commit, push or PR handoff, run the complete `full` gate
on the [exact proposed source export](docs/validation.md#validate-the-exact-proposed-source).
Publish only when every required check succeeds. Preserve measured coverage.
Numerical metrics are [advisory](.agents/rules/code-quality.md) and do not justify
source rewrites or shallow tests. Keep required failures visible and keep
unpublished source out of partial validation snapshots. Verify hosted CI,
scanner execution, the actual Sonar quality gate and approval from their
respective sources.

When production source is preserved, explain failures and minimal proposals in
the current chat. Discuss a source edit first and honor existing approval for
that scope. Keep task evidence in the chat or authorized PR materials.

## Documentation

Write maintained Markdown in English and organize it by reader task. Update
the owning guide when behavior, configuration, tests or workflows change. Use
the [documentation index](docs/README.md) to make guides discoverable. State
the prerequisites, actions, expected result and recovery where needed. Verify
commands against their source and use descriptive links to files and sections
in this repository. Use public synthetic examples.

Describe current behavior, contracts and procedures. Link only files admitted
by the current snapshot. Identify planned paths as plain inline code. Keep PR
numbers, commit hashes, CI-run results, past owner decisions, dated QA reports,
decision logs and translated companion guides out of maintained documentation.
Keep investigation and execution evidence in the current chat or authorized PR
materials. Preserve required runtime, source, hash and human-review provenance
with technical artifacts such as visual-baseline metadata.

Organize user-facing navigation around installation, capabilities, source work
and deployment using the existing guides. Do not create new folders, taxonomies
or replacement indexes solely to impose that sequence.

Keep all ten UI catalogs and Persian calendar data when admitted. Clearly
identify localized product examples and keep surrounding prose in English.
Source and optional hooks do not authorize deployment, production access or
external review requests.

For command examples, specify the inputs, working directory and shell. Verify
profiles against the manifest. Run `npm run validate -- guidance` for focused
documentation checks.
