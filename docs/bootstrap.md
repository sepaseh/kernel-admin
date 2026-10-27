# Runtime-localization phase

[English](bootstrap.md) · [فارسی](bootstrap.fa.md)

The [publication policy](../.github/bootstrap-policy.json) declares the
**runtime-localization** phase with `applicationReady: false`. It contains ten complete flat
catalogs, their code registry, pure Persian calendar data and integrity tests,
alongside token state, transport/profile contracts, HTTP key transforms and
color-contrast helpers. The real i18next/react-i18next adapter initializes fixed Persian bootstrap
resources, while Day.js/Jalaliday registers nine vendor locales plus the local
Persian locale. Supported-code
normalization and translated error messages are also published. These adapters
are tested against their real dependencies in Node. This scope is not a runnable panel.
See [README](../README.md) for source ownership and
[localization](localization.md) for catalog rules. [Contributing](../CONTRIBUTING.md)
defines validation and review policy.

## Exact snapshot

The inventory guard requires the exact declared maintained files and rejects
unexpected source, private paths and symbolic links. Only ordinary root
`node_modules` and `coverage` directories, plus Git metadata, are outside the
maintained inventory. Do not use ambient untracked application files to make a
partial publication appear complete.

The inventory may grow beyond 100 files. The separate **100-file PR cap** applies
to each GitHub diff and counts additions, deletions, renames and binaries.

## Complete phase gate

Use [`.nvmrc`](../.nvmrc), the Node range in
[`package.json`](../package.json) and the npm bundled with that Node.js release:

```sh
npm ci
npm run validate -- full
```

The [canonical manifest](../.agents/validation.json) defines the complete
current-phase gate. Its nine required checks cover the exact inventory, semantic CI policy, audit, source boundaries,
types, lint, formatting and both test runs. Vitest runs in Node with environment
file discovery disabled. Tests use synthetic inputs; no UI, API process, browser
or real environment/state is required.

Initial publication is staged under the 100-file PR cap. Every PR runs this
complete published-scope gate through the same `npm run validate -- full` command
used locally, with no selection by changed paths. CI does not maintain a second
list of checks. The runner validates the selected command plan before execution:
duplicate check definitions or profile entries, unknown IDs, missing required
checks and manual/advisory entries in `full` fail the gate. Focused profiles are
development helpers; application checks join the complete gate when their source
is published, before any runnable panel merges.

The CI policy check parses YAML with unique mapping keys and requires one
unconditional `npm ci` before one unconditional canonical full run. It rejects
PR path/branch filters, omitted lifecycle events, conditional or advisory check
execution, non-root working directories and shell overrides. Other conditional
steps such as the PR-size guard or artifact upload do not make validation optional.
The current policy allows only the `check` job for full-profile checks; introduce
job-aware validation and update this policy explicitly before adding build,
browser or Windows visual checks.

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

Runtime-localization protection requires the published CI and provider checks listed in
[branch protection](branch-protection.md). This phase provides no production
build, end-to-end or visual job and does not require those application-only jobs.
Do not add placeholder passing jobs or describe skipped checks as evidence.

Introduce the actual React/Vite panel, HTTP integration and validated server
language/direction/calendar metadata, component tests, production build, browser,
accessibility, performance and visual
evidence in coherent later work. Before any runnable panel merges, expand the
canonical full gate and inventory, observe genuine build/e2e/visual jobs pass and
add them to required checks. Passing this runtime-localization phase gate cannot
establish those results in advance.
