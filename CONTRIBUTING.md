# Contributing to Kernel Admin

[English](CONTRIBUTING.md) · [فارسی](CONTRIBUTING.fa.md)

This phase also publishes [local guidance](.agents/README.md), [task navigation](docs/source-navigation.md) and read-only [comprehension procedures](docs/comprehension-evaluation.md). Human guides are English/Persian; active assistant instructions and prompts are English only. Their static consistency check joins the canonical full gate.

The manifest separates the seventeen blocking `full` checks from complete browser/visual verification and the temporary advisory performance profile. Local and ordinary PR validation use Chromium. Scheduled and manually requested pre-release verification replace that browser run with the complete four-project matrix, then compare the six approved images once. Each suite runs once per tested source tree; Sonar consumes its verified measured reports. This source verification does not authorize an operational release or deployment.

## Source ownership

Transport state and types belong in `src/shared/api`, the cross-feature profile
limit in `src/shared/contracts`, and pure display/data helpers in `src/shared/lib`.
Pure catalog objects, the code registry and Persian calendar data belong in
`src/shared/i18n`; read [localization](docs/localization.md). Keep all ten code-named
catalogs complete and flat, with matching keys and interpolation. Runtime adapters own i18next/React translation initialization and Day.js/Jalaliday
registration. Their real integration tests run in Node with synthetic storage.
Read [HTTP ownership](docs/http-client.md) and [request lifecycle](docs/request-lifecycle.md).
[UI foundation](docs/ui-foundation.md) owns the published widgets, theme engine, compact/theme-only preferences and assets. [Core and authentication](docs/core-auth.md) owns provider/form/layout behavior and access metadata. [Business screens](docs/business-screens.md) adds the guarded account/management/settings/calendar modules. Application startup belongs to src/main.tsx, src/app/App.tsx and src/app/Routes.tsx.
Do not add source dependencies on another checkout, npm workspaces, local-package
links or backend SDKs. Keep API behavior behind HTTP in the separate API project.

Preserve access-token generation semantics: login/logout invalidates the previous
generation, while refreshing a token stays within the same generation. Keep
transforms and contrast calculations independent of UI initialization and private
state.

The [publication inventory](.github/bootstrap-policy.json) declares the exact
maintained snapshot. Update it deliberately for reviewed phase files. Its
size is separate from the 100-file limit on each PR's diff.

## Validation

Use [`.nvmrc`](.nvmrc), the Node range in [`package.json`](package.json) and the npm bundled with that release. Validate an independent export of the exact proposed source; never mix unpublished local application files into the test snapshot.

```sh
npm ci
npm run browser:install
npm run validate -- full
```

The manifest separates the seventeen blocking `full` checks from complete browser/visual verification and the temporary advisory performance profile. Local and ordinary PR validation use Chromium. Scheduled and manually requested pre-release verification replace that browser run with the complete four-project matrix, then compare the six approved images once. Each suite runs once per tested source tree; Sonar consumes its verified measured reports. This source verification does not authorize an operational release or deployment.

The blocking plan preserves snapshot and CI-policy validation, guidance, dependency audit, architectural boundaries, types, lint, formatting, measured unit/governance coverage, Storybook build and interactions, unused-code analysis, production build/bundle budgets, consumer contracts and Chromium application journeys. Keep 69% lines, 68% statements, 59% functions and 54% branches. Storybook accessibility violations remain errors, and synthetic fixtures reject unexpected requests.

Title/body-only PR edits do not repeat application validation. Changing the code, destination base or tested merge tree invalidates reuse. Visual applicability includes source, public assets/fonts/styles/catalogs, build/browser configuration, lockfile, fixtures/runners and approved baselines; incomplete comparison evidence requires validation. The six approved image bytes and tolerances are preserved. Local code publication does not require a Windows VM matching CI.

The CI policy validates the approved workflow structure and exact artifact identity. Sonar imports real `coverage/unit/lcov.info` and `coverage/governance/lcov.info` for the same tested head, base and merge tree; it does not install browsers or repeat the suite. Require the actual scanner and asynchronous provider quality gate separately. Configuration and reused artifacts are not proof that a different revision passed.

Lighthouse remains a real measured audit with unchanged numerical budgets and throttling. Until the temporary exception expires on **2026-11-07T00:00:00Z**, its failures are reported separately and do not turn an otherwise successful PR check red. The **Kernel Admin frontend/test maintainer** owns fixture-startup repair and review before that deadline; expiry requires a renewed explicit decision or restored blocking enforcement. Preserve the first failure and distinguish an unavailable audit from a failed performance score. An advisory failure is not a pass.

Tests use synthetic values. Never read real environments, credentials, browser state, databases or uploads, and never contact production for validation. Keep generated coverage, builds and dependencies out of commits.

## Pull requests

1. Use a focused `codex/<purpose>` branch and inspect the entire base-to-head diff.
2. Keep the PR at **100 or fewer GitHub changed-file entries**. Additions,
   deletions, renames and binaries count; a GitHub rename is one entry.
3. Use a Conventional Commit title and the existing
   [PR template](.github/PULL_REQUEST_TEMPLATE.md). State the phase, checked
   revision, executed checks and limitations.
4. Commit, push, comment or merge only with explicit authorization. Publish authorized PRs Ready for review; keep incomplete work local until reviewable and preserve unrelated user changes.
5. CodeRabbit reviews are manual-only. Complete the
   [request preflight](#before-requesting-coderabbit) before requesting one review
   within an authorized cycle; local validation alone is insufficient.
6. Fix actionable findings and verify the actual current-head CI, Sonar analysis,
   provider quality gate and approving review. Resolve review conversations.

Follow [branch protection](docs/branch-protection.md). A skipped status is not a new execution, and scanner success is distinct from the asynchronous Sonar quality gate. Require applicable current-source blocking results, approval and resolved conversations. Metadata-only events may reuse a prior real passing result only for the same head, base and checked merge tree; stale or missing evidence cannot establish readiness. Remote protection changes retain their own authorization.

## Before requesting CodeRabbit

Require all non-CodeRabbit required checks for the published phase to pass for the
latest published head, including scanner execution and the actual
Sonar quality gate. The complete applicable latest PR/branch Sonar report must
contain zero open/unresolved issues, across every severity and existing/new code;
inspect every page. A green quality gate or zero new-code issues alone is not
enough. Record the revision, analysis/report link and complete issue count.
Missing, pending, skipped, failed or stale checks, or absent zero-issue evidence,
block the request. A new commit invalidates preflight.

A documented false positive still open in Sonar, including S9382, blocks a request.
It needs properly authorized provider classification or a real fix and fresh
analysis; documentation alone is not resolution. Do not exclude or suppress code
or weaken checks to bypass this condition. Exclude CodeRabbit's own check/approval
only from preflight to avoid a cycle; they remain merge requirements. Once the
preflight passes and remote authorization exists, request one review, respecting
actual quota and avoiding duplicate in-flight requests for the same head. Do not
assume a quota reset time or retry repeatedly.

## Preparatory tooling scope

The inherited phase now includes finite release/deployment and quality prerequisites alongside the admitted application. Keep exact public examples synthetic; never read a local real environment, key or operator state to prepare a source change. Use explicit in-memory values and disposable directories in helper tests.

Bundle/Lighthouse policy and production/target-input tests remain in existing unit coverage; rendering, packaging and Docker lifecycle cases remain in governance coverage. Preserve their assertions and honest LCOV while running suites once per tested tree. The manifest assigns blocking, complete and advisory profiles. Direct helper CLIs can write files or contact targets; source publication does not authorize operational execution.

Read [deployment](docs/deployment.md), [test reliability](docs/test-reliability.md) and [visual provenance](docs/visual-regression.md). The application gate owns actual build, synthetic consumer/browser, visual and Lighthouse checks. Real API-provider, Docker, staging and deployed checks remain separate operation. Retained images and release configuration are not fresh approvals or executed releases.

Visual/Lighthouse runners and build metadata stamping remain import-safe. Injected lifecycle/provenance tests do not start the application, Chrome or an API. The admitted application commands separately execute owned synthetic previews and browsers; preserve matching runtime provenance, actual human image approval and the unchanged CI update prohibition. Provider, Docker, staging and deployment operation require separate authorization and evidence.

For a metadata-only event, a skipped new job is not a new passing run. Reuse only a prior real successful execution whose head, base and checked merge tree still match, with verified artifact identity. A changed source/base, missing matching evidence, or an applicable failed/pending check blocks readiness. Record visual not-applicable and Lighthouse advisory outcomes separately; neither is a substitute for a required product pass.
