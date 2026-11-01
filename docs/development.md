# Develop a source change

Use this guide to prepare a focused change in the existing checkout. [Contributing](../CONTRIBUTING.md) owns publication, [source navigation](source-navigation.md) identifies current owners and [validation](validation.md) owns the required evidence.

1. Read [AGENTS](../AGENTS.md), the relevant rules in the [settings index](../.agents/settings.json) and the current [publication policy](../.github/bootstrap-policy.json). Determine which capabilities and files this snapshot actually admits.
2. Inspect the branch, working tree and staged changes. Reuse a suitable checkout and preserve unrelated work. Additional worktrees, clones and copied implementation checkouts require prior explicit authorization.
3. Read the owner source and nearby tests before editing. Keep one coherent change on a verified `codex/<purpose>` branch. Changes to `main` require a PR.
4. Add a meaningful regression for changed behavior and run focused checks. Use deterministic readiness, completion or cancellation for test coordination; preserve intentional product timing.
5. Prepare an exact verification-only export and run the phase's complete `full` profile before an authorized commit, push or handoff. Report actual outcomes and remaining provider evidence separately.

Keep one root package, locked registry dependencies and local frontend contracts. The consuming developer chooses a compatible backend; do not import another project's source or SDK as a prerequisite.

As feature source is admitted, keep feature API/types with that feature, shared transport/session state in `src/shared/api` and request hooks in `src/shared/hooks`. Preserve memory-only tokens, login/logout generations, bounded shared refresh, cancellation and stale-result guards. Runtime source changes require reading the corresponding admitted contracts and tests first.

When UI and localization source is admitted, use the existing React, Ant Design, router and Axios owners. Preserve all ten catalogs, Persian calendar data, keyboard/contrast/motion behavior and RTL/LTR support. The API owns language, direction and calendar; browser preferences own theme and compact mode.

Use synthetic fixtures only. Do not read private environments, credentials, databases, uploads or browser state. Optional host hooks do not prove automatic loading or replace validation. Operational source must be read and its real target separately authorized before execution.
