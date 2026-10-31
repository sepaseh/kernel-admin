# SonarQube Cloud analysis

[English](sonarqube.md) · [فارسی](sonarqube.fa.md)

The [publication policy](../.github/bootstrap-policy.json) and [validation manifest](../.agents/validation.json) declare the current source scope and readiness. The shared analysis workflow does not activate the application. Provider evidence for the actual tested source must be verified independently; documentation and local checks do not establish hosted analysis.

The [workflow](../.github/workflows/ci.yml) performs CI-based analysis for this
repository. Configure and verify this repository independently; another
project's successful integration does not establish this one's activation.

## Setup

1. Give the SonarQube Cloud app access through
   [GitHub installed applications](https://github.com/settings/installations).
2. [Import the repository](https://sonarcloud.io/projects/create) into the
   `sepaseh` organization and choose **With GitHub Actions**. Follow the committed
   `windows-2025` workflow rather than adding the wizard's duplicate Linux workflow.
3. Disable **Automatic Analysis** under **Administration → Analysis Method**;
   automatic and CI-based analysis must not run together.
4. Generate a token in [My Account → Security](https://sonarcloud.io/account/security)
   and store its value only in repository Actions secret **`SONAR_TOKEN`**.
   Never print, commit or paste that value into a PR or chat.
5. Set Actions variable **`SONAR_PROJECT_KEY`** to the project's actual imported
   key. **`SONAR_HOST_URL`** defaults to `https://sonarcloud.io`. Use the existing
   workflow rather than adding a duplicate workflow from the wizard.

The token label, secret name and project key are different concepts. Verify
secret names and configuration metadata without reading token values. A
configured project or secret does not prove analysis ran. If initial branch
analysis is needed, follow the actual provider error; do not merge incomplete
work to create a baseline.

## Scope and evidence

[sonar-project.properties](../sonar-project.properties) owns analyzed published source, test classification and measured coverage paths. The actual **SonarQube Cloud analysis** job imports `coverage/unit/lcov.info` and `coverage/governance/lcov.info` from the completed check job. Artifact identity binds the tested head, destination base, checked commit/tree, workflow run and original producer attempt, including both report digests. It scans that same source without installing browsers or rerunning the suite. These reports cover only genuinely measured modules and tooling. Test files, Storybook stories and support fixtures remain classified separately from production code. Application entry/composition, browser fixtures or build configuration count as current analyzed source only when the publication policy admits them; module/workshop coverage alone never proves a complete application or independent API compatibility.

Retain source/security analysis and honest coverage. Do not exclude code or
weaken a quality gate to hide a failure. Review actual findings and correct real
defects before rerunning affected checks.

## Static catalog data and label findings

The first catalog PR analysis reported **66.5% duplicated lines on new code**.
The ten complete language records intentionally repeat the same required key
schema with different translated values. This data repetition is not duplicated
runtime logic, and removing it through English spreads or fallback catalogs would
break local translation ownership.

The authorized duplication-only exception is exactly
`sonar.cpd.exclusions=src/shared/i18n/locales/*.ts`, covering only the ten language
data files. It does not exclude these files from source or
security analysis, tests or measured coverage. Registry code, locale metadata,
Persian calendar data and all other source remain in duplication analysis. The
catalog AST regression requires each excluded leaf module to contain only its
flat literal string object, fully erased type imports and type aliases; executable
helpers, spreads, computed values and initialization calls are forbidden. Keep
that regression when changing this exception and verify a fresh provider result.

Sonar classifies the `typescript:S2068` finding `AaF5MEhhW1T9WAfdDDLs` on the
Spanish catalog's
[`password: "Contraseña"` label](../src/shared/i18n/locales/es.ts#L65) as
**False Positive**, under separate explicit user authorization. The value is
visible UI text, not an authentication credential. The translation is unchanged;
no security-rule suppression or source/coverage exclusion was added. This
classification applies only to this exact literal-label finding and does not
authorize classifying other issues. Before requesting CodeRabbit, verify a fresh
report for the exact current head with zero open/unresolved issues and a passing
actual quality gate.

## Review readiness

Before any CodeRabbit request, require every non-CodeRabbit required check for the
published phase to pass for the latest head, including the scanner and
the actual quality gate. Inspect the complete applicable latest PR/branch Sonar
report, all pages and all severities including existing code: zero open/unresolved
issues are required. A green quality gate or zero new-code issues is insufficient.
Record the revision, project/context, report link and complete count. Missing,
pending, skipped, failed or stale checks or zero-issue evidence block the request;
new commits invalidate preflight. Follow
[the request policy](../CONTRIBUTING.md#before-requesting-coderabbit) for explicit
authorization, actual quota and no duplicate in-flight request for the same head.
CodeRabbit's own check/approval is excluded only from preflight to avoid a cycle.

Follow [branch protection](branch-protection.md) for current-source CI/provider contexts. Readiness false requires its actual module/workshop profile; readiness true requires the admitted genuine application checks and applicable image comparison. Complete compatibility and any time-bounded advisory performance role follow the manifest. These roles do not waive scanner execution, the asynchronous quality gate or complete zero-unresolved-issue evidence before an authorized CodeRabbit request.

The PR-size guard uses the **100-file limit** to avoid unnecessary pagination.
It rejects over-limit metadata before listing files, then requests one page with
`per_page=100` for an eligible PR. Any next-page link is inconsistent with that
scope and fails closed without following the target. Complete file metadata,
duplicate detection and stable head/base/count checks remain required. This
reduces requests without suppressing a rule, parallelizing dependent pages or
weakening the cap. Require fresh provider analysis to establish that the earlier
S9382 finding is resolved; a code change or this explanation alone is not
zero-open-issue evidence.

Missing credentials or project settings must produce a visible setup failure.
`sonar.qualitygate.wait=false` means the scanner does not wait for the
asynchronous provider decision. A successful scanner job and a passing native
**SonarCloud Code Analysis** quality gate are separate requirements. Inspect
their actual current-head results before reporting success.

Credentialed analysis does not run for fork PRs. Read-only CI and PR-size checks
still apply. Maintainers must review code before placing it on an authorized
branch for credentialed analysis. Local tests do not contact SonarQube Cloud or
copy another repository's token.

Follow [branch protection](branch-protection.md) and the
[published scope](bootstrap.md). See the
[official scanner](https://github.com/SonarSource/sonarqube-scan-action) and
[analysis-method documentation](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/automatic-analysis).

Source and test classification must match the published inventory and actual Sonar settings for that revision. Never exclude production modules from analysis, coverage or duplication checks to hide a finding. Synthetic tests do not establish independent API-provider or deployed behavior.

The protected check job executes on every applicable event. Title/body-only PR edits may reuse the original measured coverage only when the latest earlier CI run really succeeded for the same head, destination base and checked commit/tree, and the producer/run identity and both LCOV digests verify. Missing or mismatched evidence falls back to a fresh full run. A skipped job is not successful verification; retargeting the base always invalidates reuse. The actual job named **SonarQube Cloud analysis** then scans the tested source using the verified reports, without installing browsers or rerunning the suite.
