# Assistant guidance publication phase

[English](bootstrap.md) · [فارسی](bootstrap.fa.md)

The `assistant-guidance` phase extends the workshop with canonical English assistant rules/skills, local hooks, task navigation and read-only evaluation procedures. Human explanations keep complete English/Persian companions. The [canonical manifest](../.agents/validation.json) adds guidance consistency without removing an inherited check.

The [publication policy](../.github/bootstrap-policy.json) declares the
**assistant-guidance** phase with `applicationReady: false`. It contains ten complete flat
catalogs, their code registry, pure Persian calendar data and integrity tests,
alongside token state, transport/profile contracts, HTTP key transforms and
color-contrast helpers. The real i18next/react-i18next adapter initializes fixed Persian bootstrap
resources, while Day.js/Jalaliday registers nine vendor locales plus the local
Persian locale. Supported-code
normalization and translated error messages are also published. The phase also publishes [HTTP transport and feature adapters](http-client.md),
complete server language/palette metadata validation, pure appearance vocabulary
and [request lifecycle hooks](request-lifecycle.md). Tests use real Axios with
fail-closed MSW and real React hook rendering in isolated jsdom, alongside Node
translation/date tests. This scope is not a runnable panel.
See [README](../README.md) for source ownership and
[localization](localization.md) for catalog rules. [Contributing](../CONTRIBUTING.md)
defines validation and review policy.

The phase also publishes [UI foundation](ui-foundation.md): seven Ant Design widgets, theme/preferences/observability adapters, route-back behavior and six validated local assets. [Core and authentication](core-auth.md) adds Core/Ant Design providers, typed access/navigation metadata, authentication forms and layout modules. [Business screens](business-screens.md) adds account, users/roles, settings, calendar and a dashboard frame with guarded mutation and permission checks. [Storybook verification](storybook-verification.md) adds all registered component stories, complete synthetic API owner mocks, a static workshop build and real Chromium play/accessibility checks. The policy owns the exact maintained file inventory; the independent PR delta remains limited to 100 files. No application entry point or App/Routes composition is published.

## Exact snapshot

The inventory guard requires the exact declared maintained files and rejects
unexpected source, private paths and symbolic links. Only explicitly declared generated
directories, including root `node_modules` and `coverage`, plus Git metadata, are outside
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
types, lint, formatting, both measured test runs, `build-storybook`, `test:storybook` and guidance consistency.
Unit tests use Node or isolated jsdom with environment-file discovery disabled.
Storybook uses its dedicated Vite configuration, complete synthetic feature/client
mocks and real headless Chromium. All registered stories run their play assertions
and accessibility audits with violations treated as errors. No running panel,
API process or real environment/state is required.

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
The current policy keeps all required checks, including Storybook build/browser
verification, in `check`. Introduce job-aware validation and update this policy
explicitly before adding separate application or Windows visual jobs.

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

Assistant-guidance protection requires the published CI and provider checks listed in
[branch protection](branch-protection.md). Static workshop build and isolated component
browser/a11y checks run within `check`; they are not a production panel build,
complete application E2E journey or visual-regression job.
Do not add placeholder passing jobs or describe skipped checks as evidence.

Introduce the actual React/Vite entry point and App/Routes composition, production build, browser,
accessibility, performance and visual
evidence in coherent later work. Before any runnable panel merges, expand the
canonical full gate and inventory, observe genuine build/e2e/visual jobs pass and
add them to required checks. Passing this assistant-guidance phase gate cannot
establish those results in advance.
