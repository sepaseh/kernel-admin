# Contributing to Kernel Admin

[English](CONTRIBUTING.md) · [فارسی](CONTRIBUTING.fa.md)

The application-verification phase admits one standalone React/Vite application with Ant Design, React Router and Axios. Read [root guidance](AGENTS.md), [the source map](docs/source-navigation.md), [the exact inventory](.github/bootstrap-policy.json) and [canonical validation](.agents/validation.json). Assistant tools are optional development aids, never runtime dependencies.

## Source ownership

src/main.tsx starts App and Routes; features own screens, HTTP adapters and wire types. Shared transport/session infrastructure stays in src/shared/api, pure HTTP vocabulary in src/shared/contracts and complete local translation data/adapters in src/shared/i18n. Keep all ten code-named catalogs, matching keys/interpolation, fixed Persian bootstrap and API-owned language/direction/calendar authority. Browser preferences own theme/compact only. The separate API owns authentication execution, authorization, DB/migrations and storage. Do not import another checkout, backend SDK or local workspace package.

Preserve originating request/session generations, shared refresh, login/logout invalidation, cancellation, guarded mutations and same-login password acknowledgements. Manual read retry and bounded protected-401 replay remain separate mechanisms. Source admission and synthetic fixtures do not verify the API provider.

## Validation

Use [.nvmrc](.nvmrc) and its bundled npm. Start with the smallest affected check. Before every authorized commit, push or PR handoff, validate a fresh independent export of the exact proposed tree with npm ci, npm run browser:install and npm run validate -- full. The manifest owns every command/profile/job and order. Full preserves all twelve inherited checks and adds seven genuine application checks; no missing, duplicate, manual or advisory entry can replace a required command.

Preserve genuine unit/governance LCOV from that same revision and unit minimums of 69% lines, 68% statements, 59% functions and 54% branches. Keep existing stress inputs, deadlines, performance budgets and blocking accessibility rules. Missing prerequisites, audit unavailability, failures and skips must be reported honestly. Do not narrow checks or fabricate evidence.

Storybook remains isolated with full API/client mocks and fail-closed unexpected requests. The production build, bundle budgets, Pact consumer interactions and application browser/accessibility/visual/Lighthouse checks must actually run. Use explicit synthetic values and owned temporary resources; never load real environment files, credentials, databases, uploads or production. Visual capture requires provenance and actual human approval of every new image. Historical image bytes/dates remain unchanged.

## Pull requests and merge

Use a focused codex/ branch, Conventional Commit title and [the PR template](.github/PULL_REQUEST_TEMPLATE.md). Inspect the full base-to-head diff and keep at most 100 GitHub changed-file entries, including renames, deletions and binaries. Preserve unrelated tracked/untracked/staged work and historical versions. Publish authorized PRs Ready for review after all required local work is complete. Preparation does not authorize commit, push, remote messages or merge; existing explicit session authorization persists.

Merge requires actual current-head native CI/provider results, approving review and resolved conversations under [branch protection](docs/branch-protection.md). Before a runnable merge, observe real native build/e2e/visual jobs and obtain authorization for any required remote protection transition. Source declarations do not install protection; a scanner job is separate from the asynchronous Sonar quality gate. A skipped CodeRabbit check is not approval.

## Before requesting CodeRabbit

CodeRabbit reviews are manual-only. Require all latest-head non-CodeRabbit protected checks, scanner execution and the actual same-head Sonar quality gate to pass. Read every page of the complete applicable unresolved report across all severities and existing/new code; it must contain zero unresolved issues. Quality Gate OK or zero new issues alone is insufficient. Record revision, analysis/report link and count. Missing, pending, failed, skipped, stale or absent evidence blocks the request. An open documented false positive, including S9382, still blocks it; resolve through a real fix/fresh analysis or properly authorized provider classification, never exclusions or weaker checks.

Only with remote-request authorization and a successful preflight request one review, respecting actual allowance and avoiding duplicate accepted/in-flight requests. A new commit invalidates preflight. Verify bot acceptance and real processing; quota responses or skips are not successful review. CodeRabbit itself is excluded only from preflight to avoid a cycle and remains a merge requirement.

## Public preparation and operation

Only .env.example, deploy/docker/.env.example and deploy/native/hosts.env.example are deliberately reviewed synthetic source exceptions. A matching filename never permits reading an existing operator copy. Direct helpers may read selected files, write configuration/artifacts or contact a target; source tests use pure APIs and disposable synthetic inputs. API-provider verification, independent release/security/operator workflows, Docker, staging and deployment require separate authorization and actual evidence. No source publication or local application pass establishes production readiness. Read [deployment](docs/deployment.md), [testing](docs/testing.md) and [visual provenance](docs/visual-regression.md).
