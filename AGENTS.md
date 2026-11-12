# Assistant entry point

Read [assistant guidance](.agents/README.md), its [settings index](.agents/settings.json) and the relevant canonical rules before changing source. Use the existing [architecture](docs/architecture.md), [development guide](docs/development.md) and [task map](.agents/navigation.json) to locate current owners. Follow [Contributing](CONTRIBUTING.md).

## Scope and safety

Preserve unrelated tracked, staged and untracked work. Never read real environment files, credentials, keys, databases, uploads or browser state as test fixtures. Use the existing checkout; an additional worktree, clone or copied implementation checkout requires prior explicit authorization under the [working-checkout rule](.agents/rules/branches.md#working-checkout).

Keep one standalone root project. Do not add workspaces, backend SDKs, local-package links or external project source dependencies. A consuming developer chooses a backend implementing the local HTTP contract.

The [publication policy](.github/bootstrap-policy.json) identifies the admitted application source. Follow the [development guide](docs/development.md) for its React, Ant Design, React Router and Axios owners. Preserve memory-only tokens, session generations, bounded shared refresh, cancellation and stale-result guards. Source admission and test configuration do not establish successful execution.

When production source must remain unchanged, explain the exact failing file,
trigger, evidence and minimal proposal in the current chat and discuss the change
before editing it. Honor existing approval for that scope. Keep investigation
evidence in the chat or authorized PR materials, not a maintained decision log.
A failing test does not authorize a source rewrite; retain genuine regressions.

## Git and review

Use a verified feature branch and PR for every change to `main`. Never push directly to protected `main`, force-push it or bypass protection. Honor existing authorization; committing, publishing, requesting a provider review and merging are distinct action boundaries.

Plan for at most 80 GitHub changed-file entries per PR; 100 is the mandatory publication maximum. Before opening a PR or pushing further changes, count its complete live base-to-proposed-head diff, including additions, deletions, renames and binaries; one rename is one entry. Split larger work into reviewable PRs. Do not publish more than 100 entries without prior explicit user authorization for that specific oversized scope; cohesion alone is not an exception. Recount after scope or base changes. Follow [Git workflow](.agents/rules/git.md), [PR policy](.agents/rules/pull-requests.md) and the [review skill](.agents/skills/review-pr/SKILL.md).

## Verification and documentation

The [validation manifest](.agents/validation.json) owns commands and profiles. Start focused, then run its complete `full` profile on the exact proposed publication export before an authorized commit, push or handoff. Keep behavioral assertions, type safety, lint and security controls intact. Numerical coverage, duplication, complexity and analyzer scores are advisory; they do not justify extra abstractions, shallow tests or cosmetic source rewrites. Follow [code quality](.agents/rules/code-quality.md). Report actual results and unavailable evidence.

Maintain English, current, task-oriented documentation through the [documentation map](docs/README.md). Guides describe current behavior and procedures, without PR numbers, commit hashes, CI-run results or past owner decisions. Keep required visual-baseline provenance in its technical metadata. When UI catalogs are admitted, retain all ten catalogs and Persian calendar data; the API owns language, direction and calendar, while browser preferences own theme and compact mode.

Only the reviewed examples at `.env.example`, `deploy/docker/compose.env.example` and `deploy/native/nginx.env.example` may become public source fixtures when admitted. Their private counterparts remain unread. Deployment source and optional hooks do not authorize operational targets or prove automatic execution.
