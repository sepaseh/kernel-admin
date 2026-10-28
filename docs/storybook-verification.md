# Storybook verification

[English](storybook-verification.md) · [فارسی](storybook-verification.fa.md)

The current `assistant-guidance` publication inherits this workshop and adds guidance consistency to the [canonical full gate](../.agents/validation.json). The workshop remains isolated component evidence with `applicationReady: false`.

The earlier `storybook-verification` phase introduced an isolated component workshop to the
published UI, Core/authentication and business modules. `applicationReady: false`
remains deliberate: there is no application entry point or assembled App/Routes
tree. A static workshop build and component interactions in Chromium do not
establish a production panel build, complete application E2E journey, production
API integration, visual regression or field performance.

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
an unpublished application Vite configuration. Its declared static directory
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

`browser:install` installs Playwright Chromium and its required system
dependencies. CI performs this installation after `npm ci` and before the
unconditional canonical full gate in its existing `check` job.

The current [canonical manifest](../.agents/validation.json) retains the snapshot, CI-policy, audit, boundaries, type, lint, formatting, unit-coverage and governance checks, plus `build-storybook`, `test:storybook` and guidance consistency. The build produces real static output under
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

Before a runnable panel merges, introduce the actual application composition and
expand the canonical gate to the full nineteen genuine application checks,
including production build, complete E2E and visual jobs. Observe those results
and make their contexts required as described in [branch protection](branch-protection.md).
