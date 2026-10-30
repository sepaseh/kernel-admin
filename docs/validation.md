# Canonical validation policy

[English](validation.md) · [فارسی](validation.fa.md)

[The manifest](../.agents/validation.json) owns check IDs, commands, kinds, scopes, CI jobs and profiles. The application-verification phase retains all twelve inherited checks and adds seven application checks, for nineteen required full entries. Settings project `full` in order; guidance checking verifies that projection, navigation/evaluation paths, instruction links and maintained Markdown. CI is validated through the existing semantic workflow guard, rather than expecting each nested command as a separate YAML step.

Start with the smallest relevant check. `npm run validate -- guidance` and `npm run test:guidance` are focused development tools. Before every explicitly authorized commit, push or PR handoff, export the exact proposed Git tree to a fresh independent directory and run:

```sh
npm ci
npm run browser:install
npm run validate -- full
```

Use the Node release in [`.nvmrc`](../.nvmrc) and its bundled npm. Full runs every required check once and stops on failure; unknown, omitted, repeated or advisory entries cannot replace required commands. Audit failure or unavailability is a failure. Both CI and scanner perform dependency installation, Chromium installation and the same unconditional root full command. Verify current-head hosted results separately from configuration.

Unit tests emit `coverage/unit/lcov.info`; Node governance tests include guidance and portable safety-hook regressions and emit `coverage/governance/lcov.info`. Bash wrapper cases run where a usable Bash exists and otherwise report their optional skip; portable Node safety tests remain required. The optional post-edit formatter uses Node to parse its input and the project-local ESLint CLI to fix only the selected file; its disposable regression verifies that unrelated files remain unchanged. Report exact results and unavailable prerequisites without calling skips passes.

The optional safety hook models literal Bash/sh/dash/zsh commands with a 65,536-character limit and at most four nested shells or wrappers. Inline Git `-c` accepts only `color.ui` with literal values `true`, `false`, `auto`, `always` or `never`. Other inline keys, `GIT_CONFIG`/`GIT_CONFIG_*` names or assignments in the modeled `export`, `declare`, `typeset`, `readonly` and `local` builtins, `xargs` and the execution actions of `find` are blocked. This development convenience does not model arbitrary program behavior or replace host authorization.

Storybook uses its isolated Vite configuration, disables environment-file and ambient VITE discovery, fully replaces feature APIs and the shared client, and runs real Chromium play/accessibility assertions with violations treated as errors. No environment file or real API is required. Generated output stays under `coverage` and is never committed. Preserve production coverage scope and thresholds; browser output is not unit LCOV.

The application-verification phase preserves all twelve inherited checks and adds unused-code analysis, production build, bundle budgets, Pact consumer contracts, application browser journeys, visual comparison and Lighthouse. The canonical full profile has nineteen required checks. Source admission does not establish a successful run, API-provider compatibility, human visual approval or deployment. The production build and browser checks use explicit synthetic configuration and owned resources. Real provider, Docker, staging/DAST and deployment execution remain separate. Read [testing](testing.md), [Contributing](../CONTRIBUTING.md) and [comprehension evaluation](comprehension-evaluation.md).

## Finite prerequisite extension

The inventory now admits 471 maintained files in the application-verification phase. The manifest owns nineteen required full entries and the advisory focused guidance definition, their order and native job ownership. CI and scanner use matching Windows prerequisites. Pure helper and synthetic rendering/packaging/Docker lifecycle cases remain inside the existing two coverage commands, without duplicate full-suite execution.

The exact public-template exceptions are `.env.example`, `deploy/docker/.env.example` and `deploy/native/hosts.env.example`, containing reviewed synthetic values. Do not read arbitrary local environments to validate source. Some helper CLIs load selected files, write outputs or make network requests; use pure APIs with explicit synthetic fixtures during tests and require authorization for real operation.

Only the exact-tree run and its actual results can establish local readiness. Historical Win32 metadata, release configuration, policy evaluation or a rendered fixture does not establish a production artifact, deployed TLS, current visual review or real Lighthouse result.

Visual/Lighthouse runners and build metadata stamping remain import-safe. Injected lifecycle/provenance tests do not start the application, Chrome or an API. The admitted application commands separately execute owned synthetic previews and browsers; preserve matching runtime provenance, actual human image approval and the unchanged CI update prohibition. Provider, Docker, staging and deployment operation require separate authorization and evidence.

`npm run test:lighthouse` builds the current source before auditing it, including when run outside the full profile. Supply the explicit synthetic production configuration for both steps. The preview CSP permits the configured API and observability origins for connections and the optional `PUBLIC_ASSET_ORIGIN` for images, matching the deployment template while keeping scripts restricted to the application origin.
