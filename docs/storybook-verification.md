# Storybook verification

[English](storybook-verification.md) · [فارسی](storybook-verification.fa.md)

Read the checked revision's [publication policy](../.github/bootstrap-policy.json), [source inventory](bootstrap.md) and [canonical full gate](../.agents/validation.json) for its admitted capabilities. The Storybook workshop remains isolated component evidence regardless of application readiness.

A static workshop build and component interactions in Chromium alone do not establish a production panel build, complete application E2E journey, production API integration, visual regression or field performance. A declared capability or available command is not a successful execution result; record each admitted check's evidence separately.

## Synthetic ownership

[Preview](../.storybook/preview.tsx) fully automocks the account, authentication,
calendar, roles, settings, upload and users API owner modules, plus the shared
HTTP client. These are replacement mocks, without spy passthrough to the real
implementations. [Mocks](../.storybook/mocks.ts) reset synthetic records and all
configured calls before each story. A story may override a response to demonstrate
loading, failure, retry, cancellation or permission behavior. Never read real
environment files, credentials, browser state, API records or uploads.

Unconfigured shared-client requests throw and are recorded by the
[request guard](../.storybook/request-guard.ts). The browser setup asserts the
recorded requests after every story, so a component catching the thrown error
cannot make an unexpected client call pass unnoticed. This guard covers the
shared HTTP client; it does not claim arbitrary browser networking is intercepted.
Keep all feature calls behind the declared owner mocks.

The [dedicated Vite configuration](../.storybook/vite.config.ts) disables
environment-file discovery and root public-directory discovery, sets synthetic
API/release values and a blank observability endpoint, and resolves `@` within
this checkout. Storybook explicitly uses that configuration rather than loading
the application Vite configuration implicitly. Its declared static directory
contains the published local assets. No production entry point is needed.

## Explicit language and appearance fixtures

The language toolbar selects complete English or Persian synthetic API metadata
from [fixtures](../src/test/storybook/fixtures.ts), including code, direction,
calendar and both names. The independent direction toolbar overrides only the
test fixture's direction; the theme toolbar selects light or dark. This allows
language, direction and theme to be exercised separately without inferring
production metadata from a code or storing a visitor language preference.

[PreviewFrame](../.storybook/PreviewFrame.tsx) and
[StoryShell](../src/test/storybook/StoryShell.tsx) synchronize the real i18next,
Day.js and Ant Design adapters, document metadata and component surface. Stories
use synthetic Core/router/account context and real Ant Design controls. Play
queries use named controls and the active translation engine; role/permission
titles supplied by the synthetic server remain explicit fixture data. All ten
production catalogs stay complete and the separate API retains production authority.

## Required validation

Use the repository's Node/npm versions, then run:

```sh
npm ci
npm run browser:install
npm run validate -- full
```

`browser:install` installs the Playwright browsers declared in package.json and their required system dependencies; Storybook uses Chromium. CI performs this installation after `npm ci` and before the
unconditional canonical full gate in its existing `check` job.

The [canonical manifest](../.agents/validation.json) owns every required check for that revision; do not maintain a separate complete list. `build-storybook` produces real static output under
`coverage/storybook-static`. The separate
[browser project](../vitest.storybook.config.ts) runs all registered stories and
their play assertions in real headless Chromium through Playwright.
`a11y.test: "error"` makes accessibility violations fail that browser run; do not
disable audits or suppress failures to make a story pass.

The unit thresholds remain 69% lines, 68% statements, 59% functions and 54%
branches. Every production module remains measured. Static workshop output and
browser results do not replace `coverage/unit/lcov.info` or
`coverage/governance/lcov.info`; generated artifacts are not committed. Report
actual results for the exact proposed snapshot, not configuration as execution
evidence. See [Sonar](sonarqube.md) and [Contributing](../CONTRIBUTING.md).

Before a runnable panel merges, its actual composition and complete canonical application gate, including production build, complete E2E and visual checks, must be present and genuinely executed. Observe those results and make their contexts required as described in [branch protection](branch-protection.md). Storybook results replace neither those checks nor human approval of visual baselines.
