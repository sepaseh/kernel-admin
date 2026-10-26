# Branch protection policy

[English](branch-protection.md) · [فارسی](branch-protection.fa.md)

Use native GitHub CI, CodeRabbit and SonarQube Cloud checks. The merge policy
requires current-head CI and provider results, at least one approving review and
resolved conversations. Apply protection to administrators, dismiss stale
approvals, require an up-to-date branch and prohibit force pushes and deletion.
Repository administrators manage the actual remote settings.

Required checks follow the published phase. Catalog-phase protection requires these
four native contexts with their observed GitHub App identities:

| Required context           | Provider       | App ID   |
| -------------------------- | -------------- | -------- |
| `check`                    | GitHub Actions | `15368`  |
| `SonarQube Cloud analysis` | GitHub Actions | `15368`  |
| `SonarCloud Code Analysis` | SonarCloud     | `12526`  |
| `CodeRabbit`               | CodeRabbit     | `347564` |

Verify the actual remote settings and current-head results; adding a workflow or
documenting a context does not install protection. Preserve the approval count,
administrator enforcement, stale-approval dismissal, conversation resolution,
strict up-to-date checks, linear history and force-push/deletion prohibitions
when applying an authorized phase transition.

CodeRabbit automatic review is disabled. Request a manual review only after the
[latest-head preflight](../CONTRIBUTING.md#before-requesting-coderabbit): all required
non-CodeRabbit checks, scanner and actual Sonar quality gate pass, and the complete
applicable Sonar report has zero open/unresolved issues of any severity, including
existing code. Missing or stale evidence and open documented false positives block
requests; new commits invalidate preflight. Exclude CodeRabbit's own check/approval
only to avoid a cycle. Require authorization, actual quota and no in-flight duplicate.
Inspect substantive findings and approval: a successful progress status
may describe a skipped review. Automatic approval can satisfy the normal approval
count after a clean completed review, but the native GitHub count also accepts
other eligible reviewers; it does not enforce a particular bot's identity.

The catalogs phase has `applicationReady: false`; its approved protection does not
require full panel **build**, **e2e** or **visual** jobs that it does not supply.
Before any runnable panel merges, introduce genuine application jobs, expand the
canonical full gate, observe their current-revision results pass and add all three
contexts to required checks. Do not use placeholder jobs, successful skips or
unpublished source to establish readiness. Any protection change requires
authorization and verification against actual hosted results.

Require the actual asynchronous Sonar quality gate as well as scanner execution.
Missing, failed, pending, skipped or quota-limited evidence must not be presented
as completed review. Read [Sonar setup](sonarqube.md) and
[Contributing](../CONTRIBUTING.md) before reporting merge readiness.
