# Validate a source change

The [validation manifest](../.agents/validation.json) defines check commands,
profiles and execution order.
[Settings](../.agents/settings.json) project required and advisory checks and
CI responsibility from that inventory. Use this guide to prepare evidence for
a commit or PR. See [testing](testing.md) for fixtures and [deployment](deployment.md)
for packaging and authorized target operations.

## Choose a profile

| Need                                                             | Profile       | What it establishes                                                                                         |
| ---------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------- |
| Iterate on documentation or assistant guidance                   | `guidance`    | Guidance consistency and its focused regressions. It does not replace the required gate.                    |
| Prepare the exact proposed source for a commit or PR             | `full`        | Every required check, including the synthetic build and Chromium application journeys.                      |
| Verify the configured browser matrix and approved images         | `complete`    | Replaces the ordinary Chromium run with the full matrix, then compares images once on the approved runtime. |
| Compare approved images for an applicable rendering change       | `visual`      | Image comparison with unchanged provenance and tolerances.                                                  |
| Measure the verified build with Lighthouse                       | `performance` | A real audit under the manifest's current performance policy.                                               |
| Measure the four configured helper modules with mutation testing | `mutation`    | Every mutant runs the four complete owner test files; the numerical score is advisory.                      |
| Check an explicitly authorized staging deployment                | `staging`     | Four browser projects validate public journeys, assets, accessibility, headers and API health.              |
| Check an explicitly authorized released deployment               | `smoke`       | Chromium checks the public application, API health and served immutable release identity.                   |

The `full` profile includes the required [actionlint runner](../scripts/run-actionlint.mjs). It verifies the pinned official archive's SHA-256 and checks the actual workflows. A run without a verified cached archive needs access to the official release asset. The runner disables optional ShellCheck and Pyflakes integrations.

Use the Node release in [`.nvmrc`](../.nvmrc) and its bundled npm. Install locked dependencies before running a check. Start a documentation change by checking links, guidance and their focused regressions from the repository root.

```sh
npm run validate -- guidance
```

The runner prints each command as it starts and stops at the first failure with a nonzero exit code. This also applies to advisory checks that you explicitly select.

## Validate the exact proposed source

Implement in the existing checkout under the [working-checkout rule](../.agents/rules/branches.md#working-checkout). Use a disposable export only for verification.

1. Select the exact proposed publication snapshot. Check its actual phase, `applicationReady` and admitted paths in [the publication policy](../.github/bootstrap-policy.json). Export only that selection into a new ignored repository-local directory such as `coverage/validation/` and record its source commit/tree and included changes. Preserve file bytes and exclude unrelated local work and operator state. A pass over extra local files does not validate a different partial PR.
2. Open a PowerShell session in that verification export's root. Set the public synthetic values used by CI before building or running the full profile:

   ```powershell
   $env:KERNEL_SYNTHETIC_ENV = "1"
   $env:STORYBOOK_DISABLE_TELEMETRY = "1"
   $env:VITE_API_BASE_URL = "https://api.example.com"
   $env:VITE_APP_BASE_URL = "/"
   $env:VITE_RELEASE_ID = "application-verification"
   ```

   These values disable operator environment-file discovery and identify the synthetic verification build. Direct this session's `TMP`, `TEMP` and `TMPDIR` to an existing ignored repository-local scratch directory so temporary fixtures also stay inside the repository. Set `GIT_CEILING_DIRECTORIES` to their common verification parent directory so fixtures cannot discover the implementation repository through an ancestor; owned Git fixtures initialize their own repository below it. Do not load a real environment, browser profile, credential, database or upload as a fixture.

3. Install the locked dependencies and Chromium, then run the complete required gate in the same PowerShell session. Run each command only after the preceding one succeeds.

   ```powershell
   npm ci --strict-peer-deps --no-audit --no-fund
   npm run browser:install
   npm run validate -- full
   ```

   A successful result means every required entry completed successfully on that source. The runner stops at the first failure; a focused subset cannot replace `full`. Dependency audit unavailability is a failure.

4. Preserve the first failure and its diagnostics. Resolve it within scope and reverify the affected source. Do not omit files, reduce assertions or weaken controls to obtain a pass. When production source must remain unchanged, present the exact file, trigger, evidence and minimal proposal in the current chat or PR and discuss an edit first.
5. Confirm that maintained source stayed unchanged during validation. Report the checked commit/tree, actual commands, results and remaining limits in the handoff. Keep generated evidence inside the repository's ignored directories.

For `complete`, install browsers with `npm run browser:install:all` before running `npm run validate -- complete`. It substitutes the full configured matrix rather than first repeating the ordinary Chromium run. Approved-image comparison additionally requires the reviewed OS release, architecture, Playwright and Chromium runtime. The original and current Node versions must satisfy the project's supported range and share a major version; supported minor or patch differences warn and continue with image comparison while preserving both exact versions. See [image comparison](testing.md#compare-and-approve-images) for the compatibility and provenance requirements. Local `full` does not require reproducing that image environment.

## Resolve a failed check

| Failure                                                          | Next action                                                                                                                                                                                           |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Unexpected bootstrap path`                                      | Compare the reported path with the allowed files in the publication policy. Keep unrelated local files out of the export and resolve any intended source additions through the publication inventory. |
| `Verification build reuse requires the synthetic CI environment` | Apply the public values above in the same session, then rerun the required profile.                                                                                                                   |
| Browser executable or host dependency missing                    | Run the declared browser installation for the selected profile, then retain any setup failure as an unavailable prerequisite.                                                                         |
| Missing approval or visual runtime mismatch                      | Use the approved runtime and reviewed baseline. Do not promote new captures or change tolerances as a workaround.                                                                                     |
| Stale build or changed report bytes                              | Produce fresh evidence for the exact source; reject the old build or artifact.                                                                                                                        |
| Required Git executable unavailable                              | Restore the supported tool prerequisite. Evidence commands use an absolute Git executable rather than searching `PATH`.                                                                               |
| Formatting fails in a fresh Windows checkout                     | Compare its file endings with the committed bytes and the applicable [Git attributes](../.gitattributes). Verify the fix against the fresh checkout form that failed.                                 |

`performance` uses the configured Lighthouse budgets and throttling. CI evaluates the manifest's bounded audit exception immediately before running Lighthouse. Once that exception expires, a Lighthouse execution failure blocks the CI aggregate. Numerical coverage, duplication, complexity, mutation, bundle and performance scores remain advisory. Preserve meaningful assertions, type/lint/build checks, report validation and security controls.

## Review the temporary dependency exception

`npm run audit` preserves the complete raw npm report and its high-severity
threshold. Until **2026-12-01T00:00:00Z**, it can accept only
[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
and transitive findings caused solely by that advisory. Every locked copy of
`picomatch` must be version `4.0.7`, appear in the report and be marked as a
development dependency. Every reported package in the blocking dependency chain
must also be development-only. An unrelated high or critical advisory, an
incomplete report, an unverifiable lockfile, a different version or an expired
exception remains a failure. Unrelated lower-severity findings remain visible
under the existing high-severity threshold.

GitHub and [Snyk](https://security.snyk.io/vuln/SNYK-JS-PICOMATCH-21248802)
both list the advisory as withdrawn. The local exception still applies its
deadline and lockfile checks whenever npm reports the advisory. The relevant
tool configurations use source-controlled glob patterns. Untrusted tooling
changes can still exhaust CI resources. The command prints an acceptance notice
when the exception applies. At expiry, retain any failure and review the
upstream advisory and available releases before an ordinary dependency update
or removal of the exception. Do not extend it automatically.

## Interpret the evidence

The mutation workflow runs weekly or on explicit dispatch, outside the ordinary
PR gate. It uses the locked Stryker command runner with the real Vitest CLI;
it does not depend on the Vitest adapter's per-test selection. Mutation sandboxes
and reports stay under `coverage/`. Run `npm run validate -- mutation` on an
isolated public source export, never with operator files or a real environment.

Staging and deployment smoke workflows are manual-only. Their commands enforce
the same allowlists as the workflow before any browser or HTTP request. Install
staging's locked browser matrix with `npm run browser:install:all`. The hosted
smoke workflow installs locked Chromium with `npm run browser:install`. The
local smoke command uses the installed Chrome channel. Staging requires
`STAGING_BASE_URL`, `STAGING_API_HEALTH_URL`,
`STAGING_ALLOWED_APP_HOST` and `STAGING_ALLOWED_API_HOST`. Smoke requires the
corresponding `SMOKE_` variables plus matching `SMOKE_DEPLOYMENT_ID` and
`SMOKE_EXPECTED_DEPLOYMENT_ID`; the served `_kernel/build.json` must also carry
that release ID. With explicitly authorized targets configured, use
`npm run validate -- staging` or `npm run validate -- smoke`. These profiles do
not replace `full`, and local configuration/listing is not deployment evidence.

| Evidence                                                             | Scope                                                                                                       |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `coverage/unit/lcov.info`                                            | Measured unit coverage for the source selected by the Vitest configuration; numerical coverage is advisory. |
| `coverage/governance/lcov.info`                                      | Measured Node tooling and governance coverage.                                                              |
| `coverage/storybook/lcov.info`                                       | Measured Chromium coverage for application source exercised by the existing Storybook tests.                |
| `coverage/governance/powershell.xml`                                 | Genuine executable PowerShell line hits and misses from the Windows process-tree fixture.                   |
| Application E2E, visual and Lighthouse diagnostics under `coverage/` | Separate execution results; they do not substitute for LCOV or provider compatibility.                      |

A configured test is not an executed result. Consumer contracts and synthetic browser journeys do not verify a configured backend. A new screenshot capture remains pending until the exact images receive human approval; CI cannot update approved baselines. See [testing](testing.md#review-appearance) for fixture and image-review responsibilities.

Build reuse verifies the admitted public source, synthetic environment, build identity and output bytes before and after an operation. Source ordering remains deterministic; ordinary-file, containment and no-link guards still apply. Missing or stale proof requires a fresh build.

The full and complete coordinators pass a source fingerprint to the verification
build only after their own required typecheck succeeds on unchanged source. The
builder verifies that fingerprint before compiling, avoiding a second typecheck.
Standalone production and verification builds still perform their own typecheck.

## Configure SonarQube Cloud

Copy/paste detection (CPD) is intentionally disabled for all source files through
the versioned [scanner configuration](../sonar-project.properties):

```properties
sonar.cpd.exclusions=**/*
```

The project does not collect a measured duplication report. An empty or zero
provider value must not be described as zero actual duplication or as measured
duplication that is merely advisory. This exception applies only to CPD. Preserve
source and test analysis, enabled bug and security rules, coverage inputs,
scanner execution and the remaining quality-gate conditions. Do not broaden
source, test or coverage exclusions to obtain a passing result.

The smoke and staging Playwright specs, setup modules and configs stay in
static analysis. The current SonarQube Cloud scope defaults to the whole project
and reports `sonar.sources`, `sonar.tests` and `sonar.test.inclusions` as
inactive. The scanner lists these six files under `sonar.coverage.exclusions`.
Verify their static analysis in the Sonar branch view when the files are outside
the pull request diff. Verify their coverage exclusions in the scanner log.

After importing, moving or recreating the repository, organization or Sonar
project:

1. Restore the versioned scanner configuration and configure the destination's
   organization and project identifiers. Confirm that CI reads this file and
   that scanner arguments do not override its CPD exclusion. Scanner
   configuration on the CI/CD host takes precedence over the same UI setting;
   a UI-only exclusion does not replace the versioned property.
2. Run an authorized fresh analysis of the current revision. Verify that the
   all-source CPD exclusion is effective and that the analyzed project and
   revision match the intended source.
3. Check scanner completion and the resulting provider quality gate separately.
   This opt-out does not provision or assign a custom quality gate; keep the
   existing gate and its other conditions unchanged.
4. If configuration drift restores duplication detection, restore the versioned
   CPD property, resolve any conflicting scanner override and analyze again.
   Do not compensate by excluding files from source or coverage analysis.

See [duplication exclusions](https://docs.sonarsource.com/sonarqube-cloud/managing-your-projects/project-analysis/setting-analysis-scope/exclude-from-coverage-duplication)
and [matching patterns](https://docs.sonarsource.com/sonarqube-cloud/appendices/defining-matching-patterns).

## Hosted checks and review

Local success does not establish hosted CI, scanner execution, the asynchronous Sonar quality gate or review approval. Before an authorized review request or merge:

1. Read the latest published PR head/base and live branch protection. Match required check contexts to their configured provider applications. A CodeRabbit request preflight requires all applicable non-CodeRabbit checks to pass; its own pending or skipped review check is not a prerequisite to requesting that review. Merge still requires every applicable check, including CodeRabbit, with no stale, pending, failed or skipped evidence.
2. Verify the scanner job and actual matching Sonar Quality Gate separately. Inspect the complete unfiltered unresolved report for technical findings; numerical metric gates and a zero-issue report are not prerequisites for a CodeRabbit request.
3. Request one manual review with only `@coderabbitai review`, after authorization and successful preflight. Wait at least one hour after the last CodeRabbit review request, respect provider capacity and avoid an existing or in-flight request for that head. A new commit requires fresh preflight.
4. Merge only with separate authorization, current-head approval, successful required checks and resolved review conversations. A successful CodeRabbit status can reflect a skip or quota limit. Verify the actual substantive review.

Preserve strict up-to-date checks, one native approving review, stale approval dismissal, resolved conversations, linear history, administrator enforcement and blocked force pushes and deletions. The [CodeQL workflow](../.github/workflows/codeql.yml) and its native GitHub security result are separate from the CI scanner and Sonar quality gate.

CI serializes events by event type, ref and selected manual profile. An active
Windows run finishes its cleanup; only the newest pending event in that group is
retained. PR metadata changes therefore cannot build an unbounded queue, and
nightly/manual compatibility runs use separate groups.

PR title and description edits trigger fresh verification. Application and
analysis jobs check out `${{ github.sha }}`, matching the scope job's default
checkout. In a PR run, this SHA is the event's merge commit. Confirm the PR
head, base and verified merge tree before relying on its results.
Independent jobs partition the canonical required profile:

| Job                          | Responsibility                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| Static checks                | Snapshot, CI policy, actionlint, guidance, boundaries, ESLint, formatting and Knip         |
| Dependency audit             | The explicit locked dependency audit                                                       |
| Unit tests                   | Measured unit, component and integration tests                                             |
| Governance tests             | Measured repository tooling and policy regressions, including Windows PowerShell coverage  |
| Storybook tests              | Storybook build and Chromium interactions/accessibility with measured application coverage |
| Application build and bundle | One typecheck, the verified application build and bundle budgets                           |
| API contract tests           | Consumer HTTP contracts against owned synthetic providers                                  |
| Application E2E tests        | Chromium journeys, or the complete browser matrix on scheduled/manual complete runs        |
| Visual comparison            | Approved images when rendering inputs changed, and on complete runs                        |
| Lighthouse                   | The existing performance audit with advisory numerical scores                              |

The required `check` executes no test suite. It runs after the producers and
requires each selected job to succeed. A skipped visual job is accepted only
when the scope explicitly did not request image comparison. Failures,
cancellations and unexpectedly skipped jobs block the aggregate.

The build job runs typecheck and build together, retaining the successful source
fingerprint so the build does not repeat typecheck. It publishes the immutable
distribution and its source-bound build evidence once. E2E, visual and Lighthouse
jobs independently verify that producer's source, attempt and file hashes before
reusing the same build.

Unit, governance and Storybook jobs publish separate immutable coverage artifacts. Each
records the tested repository, head, base, commit, tree, workflow, run and producer
attempt, together with the measured report hashes. Governance evidence includes
the genuine PowerShell report on Windows. Analysis depends directly on all three
producers, verifies each actual successful attempt, and imports their reports
without rerunning tests. This also supports failed-job and analysis-only reruns.

Browser, visual and Lighthouse diagnostics are uploaded separately, including on
failure. Build and report downloads reject digest mismatches and verify source
identity and contents again before use. Artifacts have three-day retention.

Dependency installs use npm's download cache and skip automatic audit submissions;
the explicit required audit remains in the full profile. Sonar installs locked
dependencies with lifecycle scripts disabled and imports the original measured
reports without running tests again.

Each producer has its own declared job budget. Functional Playwright suites keep
their 20-minute global timeout and visual comparison keeps five minutes, leaving
time for cleanup and report upload. See [the CI workflow](../.github/workflows/ci.yml),
[coverage and build evidence](../scripts/ci-evidence.mjs) and
[Git guidance](../.agents/rules/pull-requests.md) for the execution and authorization
boundaries.

## Run CI on GitLab or Gitea

GitLab runs `full-validation` for merge requests within the project and
pushes to the default branch. Gitea runs **Full validation** for pull requests
within the repository and pushes to `main`. Fork requests are outside the
scope of these jobs. [GitLab pipeline](../.gitlab-ci.yml) · [Gitea workflow](../.gitea/workflows/ci.yaml)

Use a dedicated, isolated Windows x64 worker with PowerShell 7, Git for Windows
and the Node version in [`.nvmrc`](../.nvmrc) on its PATH. Assign the
`kernel-windows-x64` tag to the GitLab runner with the PowerShell Core shell.
For Gitea, enable repository Actions and use the `kernel-windows-x64:host`
runner label. Keep the worker and its job environment free of production
credentials and services. Allow access to the npm registry and official
Playwright and actionlint downloads. The Gitea runner also fetches the pinned
checkout action from GitHub. [GitLab shells](https://docs.gitlab.com/runner/shells/) · [Gitea runner labels](https://docs.gitea.com/runner/labels/)

Each job installs the locked dependencies and Chromium and executes the
canonical `full` profile with synthetic inputs. After a run, inspect the job
on the merge or pull request and use its log to identify the first failing
check. If the job is pending, check that an eligible worker with the
required tag or label is online. Configure required status checks on the
destination separately if they should block merges. GitHub's CodeQL, Sonar
and review provider evidence belongs to the GitHub workflows and protection
settings.

## Review PR scope before opening

Before opening a PR or pushing further changes, verify its live intended base and
count the complete base-to-proposed-head GitHub diff. Include additions,
deletions, renames and binaries; one rename counts once. Recount the whole PR
after scope or base changes, rather than counting only the latest commit.

| Proposed PR scope     | Required assistant action                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| At most 80 entries    | Preferred planning target; retain a coherent, reviewable scope.                                                                                                     |
| 81 to 100 entries     | Within the mandatory maximum; review whether independent work should be split.                                                                                      |
| More than 100 entries | Stop publication, prepare a reviewable split or concrete oversized scope, and obtain prior explicit user authorization for a scoped exception before publishing it. |

Record the verified count and any approved exception in the PR description.
Cohesion, a scope explanation, or ordinary permission to commit/push does not
waive the mandatory maximum. For an existing oversized PR, discuss its actual
count and proposed split/exception before further publication; do not silently
close/recreate it, rewrite history, remove required source/tests or change the
base just to reduce the count. This assistant publication rule does not limit
the repository's total admitted source inventory or change CI/branch protection.

## Release automation

The [Release workflow](../.github/workflows/release.yml) is manual and runs only on `main`. Its guard requires `applicationReady: true` and [CHANGELOG](../CHANGELOG.md) both listed in the publication policy and present in the checkout. Configure `RELEASE_PLEASE_TOKEN` as a dedicated GitHub credential with contents and pull-request write access. It lets the release PR trigger its required checks automatically. A missing secret stops the workflow before Release Please runs. Dispatch requires separate authorization.
