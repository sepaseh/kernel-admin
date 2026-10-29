# Branch protection policy

[English](branch-protection.md) · [فارسی](branch-protection.fa.md)

The application-verification source admits real native build, e2e and visual jobs in addition to all inherited checks. Source configuration is not proof that remote protection is installed or that those jobs ran. Before any runnable merge, obtain authorization for the required remote phase transition, observe the current-head jobs actually pass and verify the live settings.

The inherited native contexts and their observed provider identities remain:

| Context                  | Provider       | App ID |
| ------------------------ | -------------- | ------ |
| check                    | GitHub Actions | 15368  |
| PR file limit            | GitHub Actions | 15368  |
| SonarQube Cloud analysis | GitHub Actions | 15368  |
| SonarCloud Code Analysis | SonarCloud     | 12526  |
| CodeRabbit               | CodeRabbit     | 347564 |

The target application merge policy also requires native build, e2e and visual contexts from GitHub Actions App 15368 after genuine matching-platform execution is observed. Preserve at least one approving review, resolved conversations, administrator enforcement, stale-approval dismissal, strict up-to-date checks, linear history and prohibitions on force push/deletion. Do not silently change remote settings or use placeholder/skipped jobs.

Every check job executes the complete canonical [full profile](../.agents/validation.json), including the real application build, browser/visual and performance checks. Dedicated application jobs add separately required evidence. Browser fixtures are synthetic and are not API-provider verification. Visual checks require exact runtime/source provenance and actual human approval of every fresh baseline image; historical assets cannot establish that approval.

CodeRabbit automatic review remains disabled. Before one authorized manual request, apply [the latest-head preflight](../CONTRIBUTING.md#before-requesting-coderabbit): every non-CodeRabbit protected check, scanner execution and same-head asynchronous Sonar quality gate must pass, and every page of the complete report must contain zero unresolved issues across all severities and existing/new code. Missing, pending, failed, skipped or stale evidence blocks the request. New commits invalidate preflight. An open documented false positive still blocks it; use a real fix/fresh analysis or authorized provider classification, never weaker checks.

Respect actual allowance and avoid duplicate accepted/in-flight review requests. Verify substantive processing and approval, not a skipped success or quota reply. CodeRabbit is excluded only from preflight to avoid a cycle and remains a merge requirement. Native approval count permits other eligible reviewers; do not claim it enforces one bot identity. Scanner execution is separate from the actual provider quality gate. Read [Sonar](sonarqube.md), [Contributing](../CONTRIBUTING.md) and [validation](validation.md).
