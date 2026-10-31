# Canonical validation policy

[English](validation.md) · [فارسی](validation.fa.md)

[The manifest](../.agents/validation.json) owns check IDs, commands, kinds, profiles and CI responsibility. Its blocking `full` profile has seventeen entries, including Chromium application E2E. The complete compatibility profile substitutes the full four-project browser matrix for Chromium, then verifies the six approved screenshots once. Performance has a separate temporary advisory profile. Settings project `full` in order; the guidance checker validates this projection and source navigation.

Start with focused checks. Before an explicitly authorized commit, push or PR handoff, export the exact proposed Git tree into a fresh independent directory and run:

```sh
npm ci
npm run browser:install
npm run validate -- full
```

Use the Node release in [`.nvmrc`](../.nvmrc) and its bundled npm. Blocking validation runs each required entry once and stops at its first failure. Unknown, omitted or duplicated definitions cannot replace required checks. Dependency audit unavailability is a failure. Local code verification does not require matching the reviewed Windows CI screenshot runtime.

| Profile       | Command                           | Responsibility                                                                                                 |
| ------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `full`        | `npm run validate -- full`        | Seventeen blocking entries; ordinary PR and local Chromium validation.                                         |
| `complete`    | `npm run validate -- complete`    | Sixteen non-E2E checks, one full four-project browser run and one approved-image comparison; eighteen entries. |
| `visual`      | `npm run validate -- visual`      | One applicable image comparison on the approved CI runtime.                                                    |
| `performance` | `npm run validate -- performance` | One real Lighthouse audit against the verified current build, with the temporary advisory policy below.        |

`npm run browser:install` installs Chromium for ordinary validation. Before complete compatibility verification, use `npm run browser:install:all`. The daily workflow runs at 01:30 UTC; the manual workflow's `verification` selector defaults to `complete` for pre-release source verification. Existing build reuse is accepted only after the checked source/configuration proof matches; a different or stale build is rejected. Standalone `npm run test:lighthouse` still builds its current source first.

Ordinary PRs run Chromium. Scheduled and manually requested pre-release verification run the full browser matrix instead of first repeating Chromium; this is source verification, not an operational release. Hosted visual comparison runs once on its approved environment when conservative visual inputs change or complete verification is requested. Include source, assets/fonts/styles/catalogs, build/browser configuration, lockfile, fixtures/runners and baselines in that decision. An unavailable diff requires validation. Keep approved images, provenance and tolerances intact.

Title/body-only edits do not repeat application work. A code or destination-base change invalidates reused evidence. CI binds artifacts to the actual head, base, merge commit/tree and workflow run, and verifies report integrity. The actual job named **SonarQube Cloud analysis** imports the resulting unit/governance LCOV without installing browsers or running the suite again. The scanner and asynchronous Sonar quality gate remain distinct required results. No metadata, stale report or skipped job establishes a new source-tree pass.

Unit tests emit `coverage/unit/lcov.info`; Node governance tests emit `coverage/governance/lcov.info`. Storybook and synthetic browser/consumer results remain separate evidence. Never fabricate LCOV or describe this selected scope as provider verification. Preserve all product assertions, 69% line / 68% statement / 59% function / 54% branch coverage, bundle budgets, contrast, authorization and unexpected-request guards. Optional Bash cases explicitly report unavailable prerequisites; portable Node safety regressions remain mandatory.

The optional safety hook models literal Bash/sh/dash/zsh commands with a 65,536-character limit and at most four nested shells or wrappers. Inline Git `-c` accepts only `color.ui` with literal values `true`, `false`, `auto`, `always` or `never`. Other inline keys, `GIT_CONFIG`/`GIT_CONFIG_*` names or assignments in the modeled `export`, `declare`, `typeset`, `readonly` and `local` builtins, `xargs` and the execution actions of `find` are blocked. This development convenience does not model arbitrary program behavior or replace host authorization.

Storybook uses its isolated Vite configuration, disables environment-file and ambient VITE discovery, fully replaces feature APIs and the shared client, and runs real Chromium play/accessibility assertions with violations treated as errors. No environment file or real API is required. Generated output stays under `coverage` and is never committed. Preserve production coverage scope and thresholds; browser output is not unit LCOV.

Lighthouse remains a real audit with unchanged metric budgets and throttling. Its temporary advisory exception expires on **2026-11-07T00:00:00Z**. The **Kernel Admin frontend/test maintainer** owns fixture-startup repair and review before expiry. Report the original audit/setup failure separately; it is not a pass. An expired exception blocks validation until a renewed explicit decision or restored blocking enforcement is recorded.

The exact public-template exceptions are `.env.example`, `deploy/docker/.env.example` and `deploy/native/hosts.env.example`, containing reviewed synthetic values. Never read a private local homonym. Rendering, packaging, health and deployment CLIs can write files or contact targets; pure imports and synthetic fixtures do not authorize operation.

Build, visual and Lighthouse tooling remains import-safe. Resource tests use disposable owned fixtures. Historical screenshots, configuration and a passed local profile do not establish hosted execution, human review, provider compatibility or deployment. See [testing](testing.md), [visual provenance](visual-regression.md), [performance policy](performance.md) and [Contributing](../CONTRIBUTING.md).
