# Validate a source change

Use the [publication policy](../.github/bootstrap-policy.json) to identify this snapshot's phase, readiness and admitted files. The [validation manifest](../.agents/validation.json) owns commands, profiles and required checks; [settings](../.agents/settings.json) project that inventory. Run the actual phase's complete `full` gate without claiming unpublished application capabilities.

## Validate the exact proposed source

Use the existing checkout under the [working-checkout rule](../.agents/rules/branches.md#working-checkout). Additional implementation worktrees, clones and copied checkouts require prior explicit authorization. A disposable verification export is evidence only.

1. Select the precise proposed base-to-head snapshot and its admitted files. Record the source commit/tree, selected changes and phase. Preserve bytes and unrelated work; extra unpublished files must not supply missing dependencies to a partial PR.
2. Export that selection under an ignored repository-local directory such as `coverage/validation/`. Keep private operator state out. Direct `TMP`, `TEMP` and `TMPDIR` to an existing ignored scratch directory. Set `GIT_CEILING_DIRECTORIES` to their common verification parent so fixture Git commands cannot discover the implementation repository.
3. Use the Node release pinned in [`.nvmrc`](../.nvmrc) and its bundled npm. From the export root, install locked dependencies with `npm ci --strict-peer-deps --no-audit --no-fund`. Install the browsers required by that phase before its browser checks.
4. In that verification session, use explicit synthetic public inputs:

   ```powershell
   $env:KERNEL_SYNTHETIC_ENV = "1"
   $env:STORYBOOK_DISABLE_TELEMETRY = "1"
   $env:VITE_API_BASE_URL = "https://api.example.com"
   $env:VITE_APP_BASE_URL = "/"
   $env:VITE_OBSERVABILITY_URL = ""
   $env:VITE_RELEASE_ID = "application-verification"
   npm run validate -- full
   ```

   These inputs prevent ambient operator environment discovery where supported and identify synthetic verification. The release label is not an application-readiness claim. Never load a real environment as a fixture.

5. Preserve the first failure and resolve it within scope. Revalidate changed source. Do not omit required files or checks, suppress findings, lower coverage or tolerances, or weaken security controls to obtain a pass.
6. Verify that maintained source stayed unchanged. Record actual execution, the checked tree and material limitations in the handoff. Keep generated evidence in ignored repository-local directories.

A complete local pass applies only to that exact snapshot and phase. It does not establish hosted provider results, an assembled application, deployment, production access or human visual approval.

Static checks include `npm run check:actions`, which runs the reviewed official actionlint 1.7.12 binary on actual `.github/workflows/` YAML files. The [runner](../scripts/run-actionlint.mjs) supports Windows and Linux x64, verifies the release archive's pinned SHA-256 on every use and extracts a fresh executable under ignored `coverage/tools/`. The first run needs access to the official GitHub release asset. Optional ShellCheck and Pyflakes integrations are disabled consistently; actionlint diagnostics are not filtered. Historical workflow test data is outside this scan. No global installation, additional CI job or repeated test suite is needed.

## Hosted checks and review

Protected `main` requires its provider-bound correctness and security checks, including `check`, `CodeQL`, `SonarQube Cloud analysis`, `SonarCloud Code Analysis` and `CodeRabbit`. Keep strict up-to-date checks, one native approving review, stale-review dismissal, resolved conversations, linear history, administrator enforcement, and blocked force pushes/deletions. Verify live protection and provider application bindings; a declaration is not proof of server enforcement.

The [CodeQL workflow](../.github/workflows/codeql.yml) analyzes JavaScript, TypeScript and GitHub Actions with `security-extended` on every PR base, pushes to `main`, weekly and manually. Both interpreted languages share one analysis job without an explicit single-language build mode. Its Actions job runs the analysis and uploads findings; the native `CodeQL` result from GitHub Advanced Security (App `57789`) evaluates those findings separately. Require the native result before merging. CodeQL is a hosted security gate, not an additional local full-profile command. Workflow source and local policy validation do not establish hosted analysis or live protection; applying remote requirements needs separate authorization.

Before an authorized review request or merge:

1. Bind all evidence to the latest published PR head and applicable Sonar project/report. Check native CI, the actual scanner execution and the provider's asynchronous quality gate separately. Missing, pending, failed, stale, skipped or quota-limited results are not completed verification.
2. Before requesting CodeRabbit, every applicable non-CodeRabbit required check must have passed. Inspect every page of the complete applicable unresolved Sonar report across severities and existing/new code; it must contain zero issues. A passing quality gate, zero new issues or an unanalysed project does not establish that result. An open finding classified only in prose still blocks the request.
3. Request one manual review with only `@coderabbitai review` after that preflight and authorization covering the review request. PR creation does not authorize this request. Wait at least one hour after the last CodeRabbit review request, respect actual provider capacity and avoid an existing in-flight request. A new commit requires fresh preflight.
4. Inspect CodeRabbit's actual review and disposition. Its successful status can mean a skipped or rate-limited review, and the native one-review count can be satisfied by another reviewer. Preserve the configured author-approval restriction. Never describe status alone as CodeRabbit approval.
5. Merge only with separate authorization, successful current-head required checks, the required approving review and resolved conversations. Do not bypass protection to complete the sequence.

Keep Sonar project binding and source scope accurate. The scanner imports genuinely measured LCOV from the same tested revision and reports only that scope. Scanner execution and the quality gate are separate results. Inspect secret names only during setup; never read or print token values. Provider classification requires its own authorization; do not replace real fixes with exclusions or suppressions.

CI exposes the actual PR1 checks independently. These disjoint profiles partition the complete local `full` profile; every required check executes once:

| GitHub job   | Display name     | Manifest profile | Actual scope                                                                          |
| ------------ | ---------------- | ---------------- | ------------------------------------------------------------------------------------- |
| `quality`    | Static checks    | `ci-quality`     | Snapshot, CI policy, actionlint, guidance, boundaries, typecheck, lint and formatting |
| `audit`      | Dependency audit | `ci-audit`       | Locked dependency audit                                                               |
| `unit`       | Unit tests       | `ci-unit`        | Measured tests for the published audit tool                                           |
| `governance` | Governance tests | `ci-governance`  | Measured repository-policy and tooling regressions                                    |

The required `check` runs after every producer, including failures, and succeeds only when all four jobs succeeded. It executes no tests. Missing, failed, cancelled or skipped jobs fail the aggregate. CodeQL remains its separate security workflow. PR1 contains no application build, E2E, browser, visual or performance job; those require admitted application source and genuine tests in a later PR.

Each test suite publishes its own immutable run/attempt artifact. The [coverage evidence owner](../scripts/ci-evidence.mjs) binds the suite and LCOV hash to the repository, PR head/base, tested commit/tree, workflow, run and producing attempt. Sonar depends on the successful aggregate and receives both suites' outputs directly. It verifies each report independently before scanning, so a rerun uses each successful producer's actual attempt without combining or rerunning suites. Missing configuration, reports or mismatched evidence blocks analysis. Analysis installs locked dependencies with package scripts disabled; scanner execution and the native provider quality gate remain separate results.

CI keeps active verification running and coalesces pending events by event and ref. The [single-pass test fixture](../scripts/ci-single-pass.test.yml) preserves existing policy regressions; it is test data outside `.github/workflows/` and does not represent current jobs or application execution.

## Review PR scope before opening

Before opening a PR, review its complete base-to-head diff and aim for at most 80 GitHub changed-file entries initially. Count additions, deletions, renames and binaries; a rename counts as one entry. Split independent changes when useful and explain why a larger cohesive change belongs together.

This is advisory guidance, outside CI and required checks. Exceeding 100 files alone must not fail CI or require deleting and recreating a PR. Keep the actual correctness, security, coverage and review requirements intact.
