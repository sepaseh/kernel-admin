# Contributing to Kernel Admin

[English](CONTRIBUTING.md) · [فارسی](CONTRIBUTING.fa.md)

The current [foundation phase](docs/bootstrap.md) contains framework-free admin
primitives and repository tooling. Preserve its declared scope and independent
project boundary.

## Source ownership

Transport state and types belong in `src/shared/api`, the cross-feature profile
limit in `src/shared/contracts`, and pure display/data helpers in `src/shared/lib`.
Do not add source dependencies on another checkout, npm workspaces, local-package
links or backend SDKs. Keep API behavior behind HTTP in the separate API project.

Preserve access-token generation semantics: login/logout invalidates the previous
generation, while refreshing a token stays within the same generation. Keep
transforms and contrast calculations independent of UI initialization and private
state.

The [publication inventory](.github/bootstrap-policy.json) declares the exact
maintained snapshot. Update it deliberately for reviewed foundation files. Its
size is separate from the 100-file limit on each PR's diff.

## Validation

Use [`.nvmrc`](.nvmrc), the Node range in [`package.json`](package.json) and the npm
bundled with that Node.js release.

```sh
npm ci
npm run validate -- full
```

[`.agents/validation.json`](.agents/validation.json) is the canonical command
inventory. Start with a focused check during development, then run the complete
`full` profile before every explicitly authorized commit or PR handoff. Validate
an isolated checkout/export of the exact proposed snapshot. Passing checks over
unpublished, untracked application files do not validate a partial PR.

The complete phase gate covers snapshot integrity, dependencies, boundaries,
types, lint, formatting, measured unit tests and governance tests. The selected
unit scope retains minimum coverage thresholds of 69% lines, 68% statements,
59% functions and 54% branches. Do not reduce them to hide a failure or fabricate
LCOV. Unit and governance reports must come from the same checked-out revision.

Tests use synthetic data. Do not read real environment files, credentials,
browser state, databases or uploads, and do not contact production. Keep generated
coverage and dependency directories out of commits.

## Pull requests

1. Use a focused `codex/<purpose>` branch and inspect the entire base-to-head diff.
2. Keep the PR at **100 or fewer GitHub changed-file entries**. Additions,
   deletions, renames and binaries count; a GitHub rename is one entry.
3. Use a Conventional Commit title and the existing
   [PR template](.github/PULL_REQUEST_TEMPLATE.md). State the phase, checked
   revision, executed checks and limitations.
4. Commit, push, comment or merge only with explicit authorization. Keep
   incomplete work in draft and preserve unrelated user changes.
5. CodeRabbit reviews are manual-only. Complete the
   [request preflight](#before-requesting-coderabbit) before requesting one review
   within an authorized cycle; local validation alone is insufficient.
6. Fix actionable findings and verify the actual current-head CI, Sonar analysis,
   provider quality gate and approving review. Resolve review conversations.

Follow [branch protection](docs/branch-protection.md). A successful skipped status
is not a substantive review, and a scanner job is not the asynchronous Sonar
quality gate. Do not remove required build, end-to-end or visual checks to merge
this foundation. A runnable panel must add its actual application, complete
validation and UI evidence before declaring readiness.

## Before requesting CodeRabbit

Require all non-CodeRabbit required checks to pass for the latest published head,
including protected build/e2e/visual checks, scanner execution and the actual
Sonar quality gate. The complete applicable latest PR/branch Sonar report must
contain zero open/unresolved issues, across every severity and existing/new code;
inspect every page. A green quality gate or zero new-code issues alone is not
enough. Record the revision, analysis/report link and complete issue count.
Missing, pending, skipped, failed or stale checks, or absent zero-issue evidence,
block the request. A new commit invalidates preflight.

A documented false positive still open in Sonar, including S9382, blocks a request.
It needs properly authorized provider classification or a real fix and fresh
analysis; documentation alone is not resolution. Do not exclude or suppress code
or weaken checks to bypass this condition. Exclude CodeRabbit's own check/approval
only from preflight to avoid a cycle; they remain merge requirements. Once the
preflight passes and remote authorization exists, request one review, respecting
actual quota and avoiding duplicate in-flight requests for the same head. Do not
assume a quota reset time or retry repeatedly.
