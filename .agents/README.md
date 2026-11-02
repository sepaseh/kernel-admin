# Assistant guidance

Start with [AGENTS](../AGENTS.md), the [settings index](settings.json), [source navigation](../docs/source-navigation.md) and the relevant rules. Read current source and nearby tests before editing. Preserve unrelated tracked, staged and untracked work.

The [publication policy](../.github/bootstrap-policy.json) declares the admitted files, phase and application readiness. Describe only the capabilities present in that snapshot. An incomplete application inventory must not claim an assembled or runnable application.

Git and remote work starts with [Git workflow](rules/git.md). Use a verified `codex/<purpose>` branch and PRs for every change to `main`; never push directly to the protected branch. Publication, provider review requests and merging each need authorization covering that action. Existing authorization remains valid within its scope.

The [validation manifest](validation.json) owns the complete required gate for the actual phase. Run it on an exact verification-only export under ignored `coverage/` before an authorized commit, push or PR handoff. Follow [validation](../docs/validation.md); do not substitute whole-workspace results for a partial PR.

Use the existing checkout. Additional worktrees, clones or copied implementation checkouts require prior explicit authorization. Verification exports are disposable evidence, not implementation workspaces.

Never read real environments, credentials, databases, uploads or browser state as fixtures. Keep documentation English. Preserve every application translation and server-owned language, direction and calendar contract when those files are admitted.

Optional host adapters and hooks do not grant permission, prove automatic loading or replace the required gate. Use [Contributing](../CONTRIBUTING.md) for publication and documentation responsibilities.
