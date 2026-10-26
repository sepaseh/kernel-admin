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
generates both from the same checked-out revision. They cover the foundation
primitives and tooling, not React screens, HTTP integration or a complete panel.

Retain source/security analysis and honest coverage. Do not exclude code or
weaken a quality gate to hide a failure. Review actual findings and correct real
defects before rerunning affected checks.

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
[foundation scope](bootstrap.md). See the
[official scanner](https://github.com/SonarSource/sonarqube-scan-action) and
[analysis-method documentation](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/automatic-analysis).
