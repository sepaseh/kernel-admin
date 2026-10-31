# Branch protection policy

[English](branch-protection.md) · [فارسی](branch-protection.fa.md)

Read the actual phase, `applicationReady` and validation roles from the [publication policy](../.github/bootstrap-policy.json) and [manifest](../.agents/validation.json). The shared single-pass workflow does not change readiness or install remote protection. Repository administrators manage the actual settings.

Require current-source blocking CI/provider results, at least one approving review and resolved conversations. Apply protection to administrators, dismiss stale approvals, require an up-to-date branch and linear history, and prohibit force pushes and deletion. Preserve these five native contexts and their observed GitHub App identities:

| Required context           | Provider       | App ID   |
| -------------------------- | -------------- | -------- |
| `check`                    | GitHub Actions | `15368`  |
| `PR file limit`            | GitHub Actions | `15368`  |
| `SonarQube Cloud analysis` | GitHub Actions | `15368`  |
| `SonarCloud Code Analysis` | SonarCloud     | `12526`  |
| `CodeRabbit`               | CodeRabbit     | `347564` |

The real `check` job owns the current declared blocking core profile. With readiness false, this verifies modules and the isolated Storybook workshop; it does not supply full-panel build, application E2E or current visual evidence. With readiness true, it executes admitted application checks and applicable approved-image comparison, with complete browser compatibility assigned to scheduled/manual pre-release verification. A complete request while readiness is false remains core-only. Do not duplicate suites solely to create more contexts or claim skipped work as execution.

The protected check job executes on every applicable event. Title/body-only PR edits may reuse original measured coverage only when the latest earlier CI run actually succeeded for the same head, destination base and checked commit/tree, with the original producer/run identity and both LCOV digests verified. Missing or mismatched evidence requires a fresh full run. A skipped job is not a successful execution, and a base change invalidates reuse. The actual **SonarQube Cloud analysis** job then scans the verified source using those reports without rerunning the suite.

Before an authorized manual CodeRabbit request, complete [the request preflight](../CONTRIBUTING.md#before-requesting-coderabbit). Every applicable non-CodeRabbit blocking check, the real scanner and asynchronous Sonar quality gate must pass for the tested source. Inspect every page/severity of the applicable provider report, including existing code: zero open/unresolved issues are required. A green quality gate, documented false positive still open in the provider, or a skipped progress check does not establish readiness. New source or base invalidates earlier evidence. Respect actual provider allowance and avoid duplicate in-flight requests.

CodeRabbit automatic review is disabled. Its skipped status is not approval; require a substantive completed review and the normal native approval count. GitHub may count other eligible reviewers and does not enforce a particular bot identity. Source fixtures and local passes do not establish API-provider compatibility, human visual review or deployment. Any remote protection transition still requires authorization and actual hosted verification.

See [Sonar setup](sonarqube.md), [validation](validation.md) and [Contributing](../CONTRIBUTING.md). Performance advisory roles are limited to the admitted manifest's actual owner/expiry policy and must be reported separately from successful audits.
