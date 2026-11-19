# Pull requests

A pull request explains why a change is needed, what changed, and how to verify
it. Use the repository's pull-request conventions in `CONTRIBUTING.md`.

## Before creation

- Verify the intended base from the request or repository metadata and review the
  complete base-to-head diff for unrelated work; do not assume a base branch.
- Plan for at most 80 GitHub changed-file entries per PR; 100 is the mandatory
  publication maximum. Before opening a PR or pushing further changes, verify
  its live intended base and count the complete base-to-proposed-head diff,
  including additions, deletions, renames and binaries; one rename is one entry.
  Count the whole PR, not only the latest commit, and recount after scope or base
  changes. Record the verified count and scope rationale in the PR description.
- Split work exceeding 100 entries into reviewable PRs. If a dependency prevents
  a practical split, prepare a concrete scope/split proposal and obtain prior
  explicit user authorization for that specific oversized scope before publishing.
  Cohesion, an explanatory PR body, or permission to commit/push does not by
  itself waive the maximum. Do not exclude required tests or source to lower the
  count or change the base solely to hide unrelated changes.
- For an existing oversized PR, report its current count and discuss a split or
  a scoped exception before further publication. Do not automatically close or
  recreate it, rewrite published history, or delete source. This assistant
  publication rule does not cap the repository's total admitted source inventory
  and does not itself add a CI file-count failure or change branch protection.
- Run the declared phase's required gate on an isolated checkout/export of the
  exact proposed commit snapshot. Record the phase, commit/tree and actual checks.
  A full pass over local untracked source does not validate a partial published PR.
  Publishing runnable code still requires the full canonical application gate in
  `CONTRIBUTING.md`; bootstrap evidence cannot replace it.
- Use a Conventional Commit title; squash merging makes it the release commit.

## Body and linkage

- Explain the problem and chosen approach, not just changed files.
- Use `Closes #123` or `Fixes #123` only when the pull request fully resolves an issue.
- Use `Refs #123` or `Related to #123` when linkage is contextual or partial.
- Report only checks actually run and disclose limitations or residual risks.
- Include screenshots or recordings for visible UI changes.
- Complete required local work before authorized publication and honor the user's
  existing Ready for review or draft preference. A remote CI run may still be
  pending after creation; disclose that status and never claim approval from it.

## Provider evidence and required checks

- Merging requires the ordinary native correctness/security CI, CodeQL, CodeRabbit and configured SonarCloud checks,
  at least one approving review and resolved review conversations. Apply
  protection to administrators, dismiss stale approvals and require an up-to-date
  branch. Use the native approval count; no separate publisher or custom approval
  check is required. See [branch protection](../../docs/validation.md).
- Verify actual provider evidence for the current PR head. Missing, pending,
  failed, skipped or quota-limited review/analysis must not be reported as a
  completed review or passing analysis. Do not remove checks to hide a failure.
- Match protection to the declared published phase, changing remote requirements
  only with explicit authorization. A foundation with `applicationReady: false`
  requires its actual phase CI, CodeQL, scanner and CodeRabbit; numerical Sonar gates are advisory. It
  must not claim unpublished application checks. Before any runnable application
  merge, introduce real build, end-to-end and visual jobs, observe them pass, add
  them to required checks and expand the full canonical application gate.
- Inspect actual check details, review results and project binding for the latest
  PR head. Configuration files, installed apps and a successful status alone do
  not prove analysis or review ran; success may represent a skipped review.
- Before any CodeRabbit request, complete the preflight below. A skipped automatic
  review does not authorize an immediate manual request.
- Treat Sonar scanner execution and its provider quality gate as separate results.
  Import genuinely measured LCOV from the same checkout and describe its actual
  source scope. Do not attribute governance-script coverage to unpublished runtime
  code. For setup/status checks, inspect secret names only, never token values.
- Verify the proposed source tree directly; unrelated integration evidence does
  not establish this application's activation or successful execution.
- A `pull_request_target` guard must execute only trusted default-branch code,
  pinned to the immutable workflow commit with `github.workflow_sha`. Never execute
  unreviewed PR head/base code in that context; keep token permissions minimal.

## CodeRabbit request preflight

- Bind the evidence to the latest published PR head and its applicable Sonar
  project/PR or analyzed branch. Any new commit invalidates the preflight.
- Every required non-CodeRabbit correctness/security check must have passed,
  including protected build, end-to-end and visual checks when required and the
  Sonar scanner job. Numerical metric gates are advisory. Exclude CodeRabbit's own check/approval from this
  prerequisite to avoid a cycle; they remain merge requirements.
- Inspect the complete applicable latest Sonar report and distinguish concrete
  technical findings from advisory metrics. A zero-issue report or passing
  metric gate is not a prerequisite. Record the revision, analysis/report link
  and unresolved findings; do not rewrite source merely to reduce an issue count.
- Missing, pending, skipped, failed or stale required correctness/security checks
  block the request. Preserve genuine failures rather than excluding files,
  weakening assertions or suppressing security controls.
- Only after this preflight passes and remote-request authorization exists, request
  one manual review by posting only `@coderabbitai review`. Do not duplicate an
  in-flight request for the same head. Wait at least one hour after the last
  CodeRabbit review request and respect the provider's actual allowance.

See [validation](../../docs/validation.md),
[testing](../../docs/testing.md),
[Sonar guidance](../../docs/validation.md) and [safety](safety.md).

Post standalone PR comments only with prior explicit user authorization.
Authorization to fix, commit, push or reply to review threads does not authorize
a standalone comment.

Do not create, update, mark ready, merge or close a pull request without explicit
authorization covering that action. Honor authorization and preferences already
provided in the conversation; do not introduce another approval step for the same
authorized action. A request to publish a PR includes the necessary branch push.
