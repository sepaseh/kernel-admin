# Canonical validation policy

[English](validation.md) · [فارسی](validation.fa.md)

[The manifest](../.agents/validation.json) owns check IDs, commands, kinds, scopes, CI jobs and profiles. The `assistant-guidance` phase retains `applicationReady: false` and every inherited workshop check, adding the required guidance check. Settings project `full` in order; guidance checking verifies that projection, navigation/evaluation paths, instruction links and maintained Markdown. CI is validated through the existing semantic workflow guard, rather than expecting each nested command as a separate YAML step.

Start with the smallest relevant check. `npm run validate -- guidance` and `npm run test:guidance` are focused development tools. Before every explicitly authorized commit or PR handoff, export the exact proposed Git tree to a fresh independent directory and run:

```sh
npm ci
npm run browser:install
npm run validate -- full
```

Use the Node release in [`.nvmrc`](../.nvmrc) and its bundled npm. Full runs every required check once and stops on failure; unknown, omitted, repeated or advisory entries cannot replace required commands. Audit failure or unavailability is a failure. Both CI and scanner perform dependency installation, Chromium installation and the same unconditional root full command. Verify current-head hosted results separately from configuration.

Unit tests emit `coverage/unit/lcov.info`; Node governance tests include guidance and portable safety-hook regressions and emit `coverage/governance/lcov.info`. Bash wrapper cases run where a usable Bash exists and otherwise report their optional skip; portable Node safety tests remain required. The optional post-edit formatter uses Node to parse its input and the project-local ESLint CLI to fix only the selected file; its disposable regression verifies that unrelated files remain unchanged. Report exact results and unavailable prerequisites without calling skips passes.

The optional safety hook models literal Bash/sh/dash/zsh commands with a 65,536-character limit and at most four nested shells or wrappers. Inline Git `-c` accepts only `color.ui` with literal values `true`, `false`, `auto`, `always` or `never`. Other inline keys, `GIT_CONFIG`/`GIT_CONFIG_*` names or assignments in the modeled `export`, `declare`, `typeset`, `readonly` and `local` builtins, `xargs` and the execution actions of `find` are blocked. This development convenience does not model arbitrary program behavior or replace host authorization.

Storybook uses its isolated Vite configuration, disables environment-file and ambient VITE discovery, fully replaces feature APIs and the shared client, and runs real Chromium play/accessibility assertions with violations treated as errors. No environment file or real API is required. Generated output stays under `coverage` and is never committed. Preserve production coverage scope and thresholds; browser output is not unit LCOV.

Application entry, App/Routes composition, production build, Pact/provider journeys, application E2E, visual comparison, actual performance measurement and real deployment execution remain future work. Published pure budgets and synthetic operational fixtures are preparatory checks. Their genuine checks must join the full application gate before a runnable panel merges. Do not use synthetic application flags for unpublished configurations. Read [testing](testing.md), [Contributing](../CONTRIBUTING.md) and [comprehension evaluation](comprehension-evaluation.md).

## Finite prerequisite extension

The inventory now includes 431 maintained files in the same non-runnable phase. Twelve required full entries and thirteen registered definitions retain their command ownership/order. No operational npm aliases or new focused profile are introduced. Pure helper unit cases and synthetic rendering/packaging/Docker lifecycle cases join the two existing coverage commands without duplicate full-suite execution.

The exact public-template exceptions are `.env.example`, `deploy/docker/.env.example` and `deploy/native/hosts.env.example`, containing reviewed synthetic values. Do not read arbitrary local environments to validate source. Some helper CLIs load selected files, write outputs or make network requests; use pure APIs with explicit synthetic fixtures during tests and require authorization for real operation.

Only the exact-tree run and its actual results can establish local readiness. Historical Win32 metadata, release configuration, policy evaluation or a rendered fixture does not establish a production artifact, deployed TLS, current visual review or real Lighthouse result.
