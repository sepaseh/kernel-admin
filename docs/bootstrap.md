# Foundation phase

[English](bootstrap.md) · [فارسی](bootstrap.fa.md)

The [publication policy](../.github/bootstrap-policy.json) declares the
**foundation** phase with `applicationReady: false`. Its eight source files
contain token state, transport/profile contracts, HTTP key transforms,
color-contrast helpers and their unit tests. This scope is not a runnable panel.
See [README](../README.md) for source ownership and
[Contributing](../CONTRIBUTING.md) for validation and review policy.

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
current-phase gate. It checks the exact inventory, audit, source boundaries,
types, lint, formatting and both test runs. Vitest runs in Node with environment
file discovery disabled. Tests use synthetic inputs; no UI, API process, browser
or real environment/state is required.

Unit tests produce `coverage/unit/lcov.info`; Node governance tests produce
`coverage/governance/lcov.info`. Both are measured in this checkout and imported
by [Sonar](sonarqube.md). Do not fabricate reports or describe this selected
coverage as coverage of a full panel.

## Hosted review

[CI](../.github/workflows/ci.yml) validates the published snapshot.
[PR policy](../.github/workflows/pr-policy.yml) uses read-only permissions and
trusted default-branch code pinned to `github.workflow_sha`. It must never execute
PR-head code in a `pull_request_target` event.

An empty initial default branch has no trusted policy workflow yet. The ordinary
unprivileged PR CI therefore performs the read-only file-count check during the
initial publication. Do not report the trusted default-branch guard as installed
until it actually exists there.

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

Foundation protection requires the published CI and provider checks listed in
[branch protection](branch-protection.md). This phase provides no production
build, end-to-end or visual job and does not require those application-only jobs.
Do not add placeholder passing jobs or describe skipped checks as evidence.

Introduce the actual React/Vite panel, HTTP integration, complete catalogs,
component tests, production build, browser, accessibility, performance and visual
evidence in coherent later work. Before any runnable panel merges, expand the
canonical full gate and inventory, observe genuine build/e2e/visual jobs pass and
add them to required checks. Passing this foundation gate cannot
establish those results in advance.
