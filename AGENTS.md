# Assistant entry point

Read [assistant guidance](.agents/README.md), its [settings index](.agents/settings.json), [source navigation](docs/source-navigation.md) and the relevant canonical rules before changing source. Follow [Contributing](CONTRIBUTING.md).

## Scope and safety

Preserve unrelated tracked, staged and untracked work. Never read real environment files, credentials, keys, databases, uploads or browser state as test fixtures. Use the existing checkout; an additional worktree, clone or copied implementation checkout requires prior explicit authorization under the [working-checkout rule](.agents/rules/branches.md#working-checkout).

Keep one standalone root project. Do not add workspaces, backend SDKs, local-package links or external project source dependencies. A consuming developer chooses a backend implementing the local HTTP contract.

The [publication policy](.github/bootstrap-policy.json) identifies the actual source admitted by this snapshot. Keep `applicationReady: false` until application composition and its genuine complete gate are admitted. Source files, installed services and configuration alone are not execution evidence.

## Git and review

Use a verified feature branch and PR for every change to `main`. Never push directly to protected `main`, force-push it or bypass protection. Honor existing authorization; committing, publishing, requesting a provider review and merging are distinct action boundaries.

Target at most 80 changed-file entries initially, reserving 20 for review fixes under the hard 100-entry limit. Count additions, deletions, renames and binaries. Follow [Git workflow](.agents/rules/git.md), [PR policy](.agents/rules/pull-requests.md) and the [review skill](.agents/skills/review-pr/SKILL.md).

## Verification and documentation

The [validation manifest](.agents/validation.json) owns commands and profiles. Start focused, then run its complete `full` profile on the exact proposed publication export before an authorized commit, push or handoff. Keep required checks, coverage thresholds and security controls intact. Report actual results and unavailable evidence.

Maintain English, current, task-oriented documentation through the [documentation map](docs/README.md). When UI catalogs are admitted, retain all ten catalogs and Persian calendar data; the API owns language, direction and calendar, while browser preferences own theme and compact mode.

Only the reviewed examples at `.env.example`, `deploy/docker/compose.env.example` and `deploy/native/nginx.env.example` may become public source fixtures when admitted. Their private counterparts remain unread. Deployment source and optional hooks do not authorize operational targets or prove automatic execution.
