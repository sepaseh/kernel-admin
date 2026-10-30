# Branch protection policy

[English](branch-protection.md) · [فارسی](branch-protection.fa.md)

The application-verification source supplies real native build, e2e and visual jobs alongside the inherited contexts below. The canonical check job retains every inherited check. Source configuration does not prove hosted execution or installed remote protection.

Use native GitHub CI, CodeRabbit and SonarQube Cloud checks. The merge policy
requires current-head CI and provider results, at least one approving review and
resolved conversations. Apply protection to administrators, dismiss stale
approvals, require an up-to-date branch and prohibit force pushes and deletion.
Repository administrators manage the actual remote settings.

Required checks follow the published phase. Retain these five inherited native contexts with their observed GitHub App identities; add the application's genuine build/e2e/visual contexts only through an authorized, verified remote protection transition before runnable merge:

| Required context           | Provider       | App ID   |
| -------------------------- | -------------- | -------- |
| `check`                    | GitHub Actions | `15368`  |
| `PR file limit`            | GitHub Actions | `15368`  |
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

The application source supplies genuine native **build**, **e2e** and **visual** jobs, and `check` runs the complete nineteen-check profile including the inherited Storybook suite. Dedicated jobs add separately required evidence. Before runnable merge, observe actual current-head passes and obtain authorization to require all three native contexts from GitHub Actions App 15368 while preserving existing protection. Visual comparison needs matching runtime provenance and unchanged human-approved images. These synthetic browser/consumer checks do not establish API-provider compatibility or deployment. Placeholder jobs and skipped successes are not readiness evidence.

Require the actual asynchronous Sonar quality gate as well as scanner execution.
Missing, failed, pending, skipped or quota-limited evidence must not be presented
as completed review. Read [Sonar setup](sonarqube.md) and
[Contributing](../CONTRIBUTING.md) before reporting merge readiness.
