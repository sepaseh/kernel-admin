# Application verification publication phase

[English](bootstrap.md) · [فارسی](bootstrap.fa.md)

The `assistant-guidance` phase extends the workshop with canonical English assistant rules/skills, local hooks, task navigation and read-only evaluation procedures. Human explanations keep complete English/Persian companions. The [canonical manifest](../.agents/validation.json) adds guidance consistency without removing an inherited check.

The [publication policy](../.github/bootstrap-policy.json) declares the
**application-verification** phase with `applicationReady: true`. It contains ten complete flat
catalogs, their code registry, pure Persian calendar data and integrity tests,
alongside token state, transport/profile contracts, HTTP key transforms and
color-contrast helpers. The real i18next/react-i18next adapter initializes fixed Persian bootstrap
resources, while Day.js/Jalaliday registers nine vendor locales plus the local
Persian locale. Supported-code
normalization and translated error messages are also published. The phase also publishes [HTTP transport and feature adapters](http-client.md),
complete server language/palette metadata validation, pure appearance vocabulary
and [request lifecycle hooks](request-lifecycle.md). Tests use real Axios with
fail-closed MSW and real React hook rendering in isolated jsdom, alongside Node
translation/date tests. The current phase additionally admits the standalone entry, App/Routes composition and genuine application checks; actual execution remains separate evidence.
See [README](../README.md) for source ownership and
[localization](localization.md) for catalog rules. [Contributing](../CONTRIBUTING.md)
defines validation and review policy.

The phase also publishes [UI foundation](ui-foundation.md): seven Ant Design widgets, theme/preferences/observability adapters, route-back behavior and six validated local assets. [Core and authentication](core-auth.md) adds Core/Ant Design providers, typed access/navigation metadata, authentication forms and layout modules. [Business screens](business-screens.md) adds account, users/roles, settings, calendar and a dashboard frame with guarded mutation and permission checks. [Storybook verification](storybook-verification.md) adds all registered component stories, complete synthetic API owner mocks, a static workshop build and real Chromium play/accessibility checks. The policy owns the exact maintained file inventory; the independent PR delta remains limited to 100 files. Application startup is in src/main.tsx, src/app/App.tsx and src/app/Routes.tsx; the separate API provider remains outside this repository.

## Exact snapshot

The inventory guard requires the exact declared maintained files and rejects
unexpected source, private paths and symbolic links. Only explicitly declared generated
directories, including root `node_modules`, `coverage` and admitted application `dist`, plus Git metadata, are outside
the maintained inventory. Static Storybook output belongs under `coverage/storybook-static`.
Do not use ambient untracked application files to make a
partial publication appear complete.

The inventory may grow beyond 100 files. The separate **100-file PR cap** applies
to each GitHub diff and counts additions, deletions, renames and binaries.

## Complete phase gate

Use [`.nvmrc`](../.nvmrc), the Node range in
[`package.json`](../package.json) and the npm bundled with that Node.js release:

```sh
npm ci
npm run browser:install
npm run validate -- full
```

The [canonical manifest](../.agents/validation.json) defines the complete
current-phase gate. Its required checks cover the exact inventory, semantic CI policy, audit, source boundaries,
types, lint, formatting, both measured test runs, `build-storybook`, `test:storybook` and guidance consistency. It adds unused-code analysis, production build, bundle budgets, Pact consumer contracts, application E2E, visual comparison and Lighthouse, for nineteen required checks.
Unit tests use Node or isolated jsdom with environment-file discovery disabled.
Storybook uses its dedicated Vite configuration, complete synthetic feature/client
mocks and real headless Chromium. All registered stories run their play assertions
and accessibility audits with violations treated as errors. Application checks start their own synthetic preview/browser resources; no running external API or real environment/state is required.

Initial publication is staged under the 100-file PR cap. Every PR runs this
complete published-scope gate through the same `npm run validate -- full` command
used locally, with no selection by changed paths. CI does not maintain a second
list of checks. The runner validates the selected command plan before execution:
duplicate check definitions or profile entries, unknown IDs, missing required
checks and manual/advisory entries in `full` fail the gate. Focused profiles are
development helpers; application checks join the complete gate when their source
is published, before any runnable panel merges.

The CI policy check parses YAML with unique mapping keys and requires one
unconditional `npm ci`, then `npm run browser:install`, before one unconditional canonical full run. It rejects
PR path/branch filters, omitted lifecycle events, conditional or advisory check
execution, non-root working directories and shell overrides. Other conditional
steps such as the PR-size guard or artifact upload do not make validation optional.
The current policy retains every required check in `check`, including Storybook verification, and declares genuine additional build/e2e/visual job ownership. The application workflow and scanner use matching Windows prerequisites; observe actual current-head results separately.

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

The inherited native CI/provider contexts remain required. Application source now supplies real build, E2E and visual jobs, while `check` executes the entire nineteen-check full profile. Do not add placeholder passing jobs or describe skipped checks as evidence.

Before any runnable panel merges, observe genuine current-head build/e2e/visual passes and obtain authorization to add their native contexts to live protection, preserving every existing setting. A declared source phase does not install remote protection, verify the independent API or authorize deployment. Follow [branch protection](branch-protection.md).

## Finite operations and quality prerequisites

The earlier assistant-guidance stage added 70 maintained prerequisites, bringing its inventory to 436 with applicationReady false. The current application-verification phase retains them and admits the finite application closure, for 471 maintained paths. The inventory and this PR's changed-file count remain separate quantities.

The exact example exceptions are `.env.example`, `deploy/docker/.env.example` and `deploy/native/hosts.env.example`. Only deliberately declared, reviewed synthetic Git sources qualify; arbitrary environment files, credentials and local operator state remain forbidden. The four PNGs and their metadata retain historical bytes and review dates, not current approval.

Pure unit and synthetic governance/lifecycle cases still run once inside the two existing measured test commands. Full now has nineteen required entries and retains the advisory focused guidance definition. No deployment alias or new operator profile is implied. Source or helper cases do not establish a real provider, Docker, staging, mutation or deployment run. See [deployment](deployment.md), [coverage scope](component-coverage.md) and [visual history](visual-regression.md).

Visual/Lighthouse runners and build metadata stamping remain import-safe. Injected lifecycle/provenance tests do not start the application, Chrome or an API. The admitted application commands separately execute owned synthetic previews and browsers; preserve matching runtime provenance, actual human image approval and the unchanged CI update prohibition. Provider, Docker, staging and deployment operation require separate authorization and evidence.
