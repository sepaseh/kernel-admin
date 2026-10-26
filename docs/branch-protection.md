# Branch protection policy

[English](branch-protection.md) · [فارسی](branch-protection.fa.md)

Use native GitHub CI, CodeRabbit and SonarQube Cloud checks. The merge policy
requires current-head CI and provider results, at least one approving review and
resolved conversations. Apply protection to administrators, dismiss stale
approvals, require an up-to-date branch and prohibit force pushes and deletion.
Repository administrators manage the actual remote settings.

The foundation supplies **check** from CI, **SonarQube Cloud analysis** from
GitHub Actions and the provider's **SonarCloud Code Analysis**. The native
**CodeRabbit** status remains part of review policy. Verify actual observed
checks and their provider identity; adding a workflow does not install protection.

CodeRabbit automatic review is disabled. Request a manual review only within an
authorized cycle once the revision is ready, and respect the provider's reported
allowance. Inspect substantive findings and approval: a successful progress status
may describe a skipped review. Automatic approval can satisfy the normal approval
count after a clean completed review, but the native GitHub count also accepts
other eligible reviewers; it does not enforce a particular bot's identity.

The foundation does not supply full panel **build**, **e2e** or **visual** jobs.
Existing requirements for those checks remain blocking. Do not remove, replace
or spoof them merely to merge this phase. A runnable phase must supply genuine
application evidence, and any authorized protection change must be checked
against real hosted results.

Require the actual asynchronous Sonar quality gate as well as scanner execution.
Missing, failed, pending, skipped or quota-limited evidence must not be presented
as completed review. Read [Sonar setup](sonarqube.md) and
[Contributing](../CONTRIBUTING.md) before reporting merge readiness.
