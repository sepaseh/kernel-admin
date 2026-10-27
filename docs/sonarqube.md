# SonarQube Cloud analysis

[English](sonarqube.md) · [فارسی](sonarqube.fa.md)

The [workflow](../.github/workflows/sonar.yml) performs CI-based analysis for this
repository. Configure and verify this repository independently; another
project's successful integration does not establish this one's activation.

## Setup

1. Give the SonarQube Cloud app access through
   [GitHub installed applications](https://github.com/settings/installations).
2. [Import the repository](https://sonarcloud.io/projects/create) into the
   `sepaseh` organization and choose **With GitHub Actions**. Select **Linux** for
   the `ubuntu-latest` runner, including when local development uses Windows.
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

[sonar-project.properties](../sonar-project.properties) analyzes published `src`
and `scripts`, classifies test files separately and imports two real reports:
`coverage/unit/lcov.info` and `coverage/governance/lcov.info`. The workflow
generates both from the same checked-out revision. They cover the published
catalogs, real translation/date runtime adapters, pure Persian calendar data,
primitives and tooling. They do not cover React screens, HTTP integration or a
complete panel.

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

Runtime-localization protection follows its published scope and requires the CI/provider
contexts in [branch protection](branch-protection.md). Before any runnable panel
merges, real build/e2e/visual jobs must pass and become required checks, with the
canonical full gate expanded. Phase alignment does not waive scanner execution,
the actual quality gate or the zero-open-issue request condition.

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
