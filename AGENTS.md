# Assistant entry point

Read the [assistant guidance index](.agents/README.md) and
[Contributing](CONTRIBUTING.md) before making changes. Use the
[publication policy](.github/bootstrap-policy.json) to confirm the current phase
and admitted files. Read the applicable rules, source owners and tests. Verify
behavior against the current source and actual checks.

## Scope and safety

Use the existing checkout and preserve unrelated tracked, staged and untracked
work. Get explicit user authorization for any additional worktree, clone or
copied implementation checkout, including when delegating.
[Working-checkout rules](.agents/rules/branches.md#working-checkout)

Use disposable synthetic fixtures. Keep real environments, credentials, keys,
databases, uploads and browser state out of fixtures. Follow the
[safety rules](.agents/rules/safety.md#secrets-and-local-state) for public examples,
private state and authorized access.

When production source must remain unchanged, explain the exact failing file,
trigger, evidence and minimal proposal in the current chat. Discuss the change
before editing and honor existing approval for that scope. Retain genuine
failing assertions.

## Git and review

Use a verified feature branch and PR for changes to protected `main`.
Honor existing authorization for the same action and scope. Follow the
[Git workflow](.agents/rules/git.md) and
[remote action boundaries](.agents/rules/safety.md#external-systems).
Review the complete diff against the intended base before publication. Follow
the [PR scope rules](.agents/rules/pull-requests.md#before-creation) and the
[review workflow](.agents/skills/review-pr/SKILL.md).

Keep direct pushes and force pushes to protected `main` prohibited. Committing,
publishing, requesting review and merging require separate authorization.
Publishing over 100 changed-file entries requires explicit authorization for
that specific scope. Count the complete diff against the live intended base
before opening a PR or pushing further changes.

## Verification and documentation

Start with a focused check from the [validation manifest](.agents/validation.json).
Preserve required checks, assertions, type safety, lint and security controls.
Report actual results, failures and unavailable evidence. Follow the
[validation workflow](.agents/skills/validate-change/SKILL.md).

Keep maintained documentation and assistant instructions in English, current
and organized by reader task. Use the [documentation index](docs/README.md)
and the [documentation rules](.agents/rules/guidance.md).

Before an authorized commit, push or handoff, run the required `full` profile
on the exact proposed source export. Follow the local rules for
[advisory metrics](.agents/rules/code-quality.md#static-analysis-findings),
execution evidence, localization contracts and visual-baseline provenance.

## Source boundaries

Keep one standalone root project. Do not add workspaces, backend SDKs,
local-package links or external project source dependencies. Follow the
[import rules](.agents/rules/imports.md) and the
[local HTTP contract](.agents/rules/api-collection.md).
Preserve memory-only tokens, session generations, bounded shared refresh,
cancellation and stale-result guards.
[Authentication and request lifecycles](docs/authentication.md)
