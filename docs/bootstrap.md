# Application verification publication phase

[English](bootstrap.md) · [فارسی](bootstrap.fa.md)

The `assistant-guidance` phase extends the workshop with canonical English assistant rules/skills, local hooks, task navigation and read-only evaluation procedures. Human explanations keep complete English/Persian companions. The [canonical manifest](../.agents/validation.json) separates the seventeen blocking local/PR checks from complete browser/visual verification and the temporary advisory performance profile. Blocking coverage retains snapshot/CI policy, guidance, audit, boundaries, types, lint/format, unit/governance reports, Storybook build/accessibility, unused-code analysis, production build/bundle, contracts and Chromium application journeys. Complete scheduled/manual pre-release verification replaces Chromium with all four browser projects and compares approved images once. It does not authorize an operational release.

Each applicable suite runs once per tested source tree. CI reuses measured reports and build outputs only when their head, destination base, merge commit/tree and workflow-run identities match. Title/body-only PR edits do not repeat application work; changed code or base invalidates reuse. Visual applicability covers source, public assets/fonts/styles/catalogs, build/browser configuration, lockfile, fixture/runner and baseline changes. Missing reliable diff evidence requires validation.

The semantic CI guard checks this approved workflow and artifact flow. The actual scanner job imports verified LCOV from the successful check run; it does not install browsers or duplicate application validation. Local code publication does not require matching the reviewed CI Windows runtime. Lighthouse follows the owner, expiry and actual-result requirements in [performance policy](performance.md).

Unit tests produce `coverage/unit/lcov.info`; Node governance tests produce
`coverage/governance/lcov.info`. Both are measured in this checkout and imported
by [Sonar](sonarqube.md). Do not fabricate reports or describe this selected
coverage as coverage of a full panel. Catalog data and calendar integrity tests
run inside the existing unit suite and produce measured coverage from these
published modules.

## Hosted review

[CI](../.github/workflows/ci.yml) validates the published snapshot.
[PR policy](../.github/workflows/pr-policy.yml) uses read-only permissions and
trusted default-branch code pinned to `github.workflow_sha`. It must never execute
PR-head code in a `pull_request_target` event.

The PR-policy workflow is published on the default branch. It validates the
100-file cap using trusted default-branch code; the ordinary unprivileged PR CI
also performs its early read-only file-count check. Verify actual hosted results
for the proposed head instead of treating the workflow's presence as execution
evidence.

CodeRabbit reviews are manual-only. Before requesting one, complete
[the latest-head preflight](../CONTRIBUTING.md#before-requesting-coderabbit): every
required non-CodeRabbit check for the published phase must pass, including the
scanner and actual Sonar quality gate, with zero open/unresolved issues of any
severity in the complete applicable Sonar report, including existing code.
Missing evidence or an open documented false positive blocks requests; a new
commit invalidates preflight. Exclude CodeRabbit's own check/approval only to avoid
a cycle. Require authorization, available quota and no in-flight duplicate. Follow
[branch protection](branch-protection.md).

## Runnable panel readiness

The inherited CI/provider contexts remain required. The genuine `check` job owns blocking code validation and applicable image comparison; the actual scanner imports its verified reports. Complete browser compatibility has a scheduled/manual pre-release role. Do not introduce duplicate suites solely to create separate contexts, or claim a skipped result is fresh execution.

Before runnable merge, verify applicable current-source blocking results and follow [branch protection](branch-protection.md). Preserve installed protection and obtain separate authorization for any remote transition. Source admission does not install protection, verify the independent API provider or authorize deployment.

## Finite operations and quality prerequisites

Earlier publication stages admitted the public preparation helpers and application closure separately. The current [inventory](../.github/bootstrap-policy.json) owns the maintained source paths, while the PR delta remains a distinct review limit. Historical phase counts do not establish current execution or permit unrelated local files.

The exact example exceptions are `.env.example`, `deploy/docker/.env.example` and `deploy/native/hosts.env.example`. Only deliberately declared, reviewed synthetic Git sources qualify; arbitrary environment files, credentials and local operator state remain forbidden. The four PNGs and their metadata retain historical bytes and review dates, not current approval.

Pure unit and synthetic governance/lifecycle cases remain inside the existing measured commands. The manifest assigns seventeen blocking `full` checks, complete compatibility and a time-bounded advisory performance role. No operational alias or deployment authorization follows from a test profile. Provider, Docker, staging, mutation and deployment require their own observed evidence. See [deployment](deployment.md), [coverage scope](component-coverage.md) and [visual history](visual-regression.md).

Visual/Lighthouse runners and build metadata stamping remain import-safe. Injected lifecycle/provenance tests do not start the application, Chrome or an API. The admitted application commands separately execute owned synthetic previews and browsers; preserve matching runtime provenance, actual human image approval and the unchanged CI update prohibition. Provider, Docker, staging and deployment operation require separate authorization and evidence.
