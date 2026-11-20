# Git workflow

Read [safety](safety.md) before changing Git state or a remote system.

| Topic                       | Canonical guidance                                                              |
| --------------------------- | ------------------------------------------------------------------------------- |
| Branch naming and lifecycle | [Branches](branches.md)                                                         |
| Commit scope and subject    | [Commits](commits.md)                                                           |
| Issue quality and startup   | [Issues](issues.md), [start-issue](../skills/start-issue/SKILL.md)              |
| Pull requests and review    | [Pull requests](pull-requests.md), [code review](code-review.md)                |
| Checks and handoff          | [Validation](../../docs/validation.md), [change handoff](../../CONTRIBUTING.md) |

## Establish context

Check the repository, branch, status and relevant diffs before acting. Preserve
unrelated tracked, staged and untracked work. Verify remote metadata with
authorized tools. Report observed facts, inferences and access limits separately.
Follow the [working-checkout rule](branches.md#working-checkout).

Read the phase, `applicationReady` and admitted files from
the [publication policy](../../.github/bootstrap-policy.json) and the required
checks from the [validation manifest](../validation.json). Report actual
current-revision evidence and any unpublished capabilities.

## Before publication

Apply the [PR scope and validation policy](pull-requests.md#before-creation)
before opening a PR or pushing further changes.

## Before committing

Follow the [commit workflow](../skills/commit/SKILL.md) for scope, exact-tree
validation and staged-diff review.

Review the working-tree and staged diffs. Run the canonical `full` profile on
the [exact proposed snapshot](../../docs/validation.md#validate-the-exact-proposed-source).
Resolve required failures within scope and reverify. Report an unresolved or
unavailable required check and leave staging and committing pending. Follow the
[commit content and title rules](commits.md) for the reviewed scope.

## Rules

- Require explicit authorization for each commit, push and history rewrite.
  Coordinate an authorized rewrite with affected review requests.
  Apply the [remote action boundaries](safety.md#external-systems) and the
  [publication rule](pull-requests.md#publish-a-pull-request) for any included push.
- Never force-push to `main` or `master`.
- Use `git add .` or `git add -A` only if the user requests a broad commit.
- Use `--no-verify` only when the user explicitly authorizes skipping optional
  hooks. Required checks still apply.
- Add AI co-author trailers only at the user's request.
