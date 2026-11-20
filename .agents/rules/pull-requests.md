# Pull requests

Use the [contribution guide](../../CONTRIBUTING.md) and
[pull request template](../../.github/PULL_REQUEST_TEMPLATE.md).

## Before creation

- Verify the intended base from the request or repository metadata. Review the
  complete base-to-head diff for unrelated work.
- Count additions, deletions, renames and binaries. Count one entry per rename.
- Plan for at most 80 GitHub changed-file entries per PR. Verify the live
  intended base before opening a PR or pushing further changes. Recount the
  entire PR after scope or base changes. Record the verified count, scope
  rationale and any approved exception in the PR description.
- The mandatory limit is 100 entries. Split larger changes into reviewable PRs.
  If a dependency prevents a practical split, prepare a concrete proposal and obtain
  explicit user authorization for that specific oversized scope before publishing.
  Cohesion, an explanatory PR body, or permission to commit/push does not by
  itself waive the maximum. Do not exclude required tests or source to lower the
  count or change the base solely to hide unrelated changes.
- For an existing oversized PR, report its current count and discuss a split or
  a scoped exception before further publication. Do not automatically close or
  recreate it, rewrite published history, or delete source. This assistant
  publication rule does not cap the repository's total admitted source inventory
  and does not itself add a CI file-count failure or change branch protection.
- Read the declared phase, `applicationReady` and admitted files in the
  [publication policy](../../.github/bootstrap-policy.json). Stay within the
  authorized admission scope. Run the phase's full gate on an
  [exact verification-only export](../../docs/validation.md#validate-the-exact-proposed-source)
  and record the phase, commit/tree and actual checks. Use the full application
  gate when publishing runnable code.

## Body and linkage

- Explain the problem, chosen approach and resulting behavior.
- Use `Closes #123` or `Fixes #123` only when the pull request fully resolves an issue.
- Use `Refs #123` or `Related to #123` when linkage is contextual or partial.
- Report only checks actually run and disclose limitations or residual risks.
- Include screenshots or recordings for visible UI changes.
- Use a [Conventional Commit title](commits.md#commit-message) for the eventual
  squash commit.

## Publish a pull request

- Complete required local work before authorized publication and honor the user's
  existing Ready for review or draft preference. A remote CI run may still be
  pending after creation; disclose that status and never claim approval from it.
- Obtain explicit authorization for each remote PR action, including creation,
  updates, marking ready, merging and closure. A request to publish a PR includes
  the necessary branch push. Follow the separate
  [standalone comment rule](safety.md#standalone-pr-comments).

## Provider evidence and required checks

- Merge with successful current-head correctness/security CI, CodeQL, CodeRabbit
  and configured SonarCloud checks, at least one native approving review and
  resolved review conversations. Apply protection to administrators, dismiss
  stale approvals and require an up-to-date branch. Use GitHub's native approval
  count. [Hosted checks and review](../../docs/validation.md#hosted-checks-and-review)
- Match protection to the published phase and obtain explicit authorization
  before changing remote requirements. The current application gate requires
  hosted build and end-to-end evidence, plus visual evidence when that job is
  required. For a foundation-only snapshot, require its phase CI, CodeQL,
  scanner and CodeRabbit.
  Numerical Sonar gates are advisory for that phase. Report the checks that ran
  for the applicable phase. [Publication policy](../../.github/bootstrap-policy.json)
- Verify [actual review evidence](code-review.md#evidence) for the current head.
  Missing, pending, failed, skipped, stale or quota-limited required checks
  block merge. Keep the required checks in place.
- Treat Sonar scanner execution and its provider quality gate as separate results.
  Import genuinely measured LCOV from the same checkout and describe its actual
  source scope. Do not attribute governance-script coverage to unpublished runtime
  code. Follow the [sensitive-file rule](safety.md#secrets-and-local-state) during
  setup and status checks.
- Apply the [remote action boundaries](safety.md#external-systems) before changing
  a provider finding's classification.
- A `pull_request_target` guard must execute only trusted default-branch code,
  pinned to the immutable workflow commit with `github.workflow_sha`. Never execute
  unreviewed PR head/base code in that context; keep token permissions minimal.

## CodeRabbit request preflight

- Bind the evidence to the latest published PR head and its applicable Sonar
  project/PR or analyzed branch. Any new commit invalidates the preflight.
- Require passing non-CodeRabbit correctness and security checks, including the
  applicable protected build, end-to-end and visual checks and the Sonar scanner.
  Missing, pending, skipped, failed or stale required evidence blocks the request.
  CodeRabbit's own check and approval are merge requirements.
- Inspect the complete applicable latest Sonar report and distinguish concrete
  technical findings from advisory metrics. A zero-issue report or passing
  metric gate is not a prerequisite. Record the revision, analysis/report link
  and unresolved findings; do not rewrite source merely to reduce an issue count.
- Preserve genuine failures without excluding required files, weakening
  assertions or suppressing security controls.
- Only after this preflight passes and remote-request authorization exists, request
  one manual review by posting only `@coderabbitai review`. Do not duplicate an
  in-flight request for the same head. Wait at least one hour after the last
  CodeRabbit review request and respect the provider's actual allowance.
