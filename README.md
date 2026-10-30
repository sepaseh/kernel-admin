# Kernel Admin

[English](README.md) · [فارسی](README.fa.md)

The `assistant-guidance` publication also adds [local development guidance](docs/README.md), canonical English rules/skills, a machine task map and read-only evaluation procedures. Optional hooks and host adapters are not application dependencies or proof of automatic loading.

Kernel Admin is one standalone React/Vite TypeScript application using Ant Design/antd-style, React Router and Axios. The current **application-verification** phase admits src/main.tsx, App/Routes composition and the genuine application gate while retaining the published modules and isolated Storybook workshop. Read `applicationReady` and the exact admitted inventory from [the publication policy](.github/bootstrap-policy.json); declarations do not replace actual verification.

## Current scope

- [Token state](src/shared/api/token.ts) stores the access token in memory and
  distinguishes login/logout generations from credential refreshes.
- [Transport types](src/shared/api/types.ts) and the
  [shared profile limit](src/shared/contracts/index.ts) define small local
  contracts.
- [Key transforms](src/shared/lib/transform.ts) convert nested plain HTTP data
  between camel case and snake case.
- [Contrast helpers](src/shared/lib/color-contrast.ts) calculate readable display
  colors without changing persisted theme choices.
- [Catalogs](src/shared/i18n/catalogs.ts) register one complete flat object for
  each of the ten [local codes](src/shared/i18n/locales.ts), with 111 root messages
  per language. [Persian calendar data](src/shared/i18n/dayjs/fa.ts) stays separate
  from UI messages. Read [localization](docs/localization.md) for ownership and
  integrity checks.

- [HTTP transport and feature owners](docs/http-client.md) preserve session generations,
  validate token/settings replies and consume the independent API.
- [Read lifecycle hooks](docs/request-lifecycle.md) cancel obsolete work and preserve
  accepted data across refresh failures.
- [Appearance vocabulary](src/shared/contracts/appearance.ts) owns Theme and seven
  palette fields without initializing Ant Design.
- [Business screens](docs/business-screens.md) adds account, users, roles, settings and calendar modules with guarded mutations; the dashboard remains a layout frame.
- [Core and authentication](docs/core-auth.md) defines provider lifecycles, server-owned settings, session-safe forms, access metadata and layout ownership.
- [Storybook verification](docs/storybook-verification.md) owns isolated component stories, complete synthetic API mocks, language/direction/theme controls and required browser checks.

Key transforms rename plain-object keys and omit null object fields. Their result
is `unknown`; validate and narrow it to the expected HTTP contract before use.
Non-plain values retain their runtime identity, but their types also require
narrowing. The HTTP client explicitly asserts ordinary DTO shapes at its contract boundary;
critical token and settings replies are runtime-validated. Key conversion never
preserves or proves a generic input type.

Contrast helpers accept hex colors and comma-form `rgb()`/`rgba()` with channels
from 0 to 255 and alpha from 0 to 1; unsupported or malformed inputs throw
`TypeError`. The display adjustment checks every rounded shade along blends toward
black and white, preserving the chosen hue where possible. If neither path can
meet every surface's target, it returns the best available shade on those paths.

The runtime uses i18next and react-i18next with React, plus Day.js and Jalaliday.
The translation adapter starts in Persian without reading or storing a visitor
language. The date adapter registers nine vendor locales plus the local Persian
locale, including English as `en-gb`, and supports explicit Gregorian/Jalali calendar selection.
Code normalization only selects a supported catalog; it does not select direction
or calendar. The translated error helper preserves real `Error` messages.
Read [UI foundation](docs/ui-foundation.md) for widget, asset and theme ownership.
This phase contains real provider/form/layout/widget/hook tests with synthetic MSW/jsdom fixtures and isolated Storybook tests in Chromium.
Application startup now belongs to [src/main.tsx](src/main.tsx), [App](src/app/App.tsx) and [Routes](src/app/Routes.tsx); application browser fixtures use synthetic HTTP and reject unexpected requests. The separate API owns
authentication, database and storage, plus active language, direction and calendar.

## Install and validate

Use the Node.js version in [`.nvmrc`](.nvmrc), within the supported range in
[`package.json`](package.json), and the npm bundled with that Node.js release.

```sh
npm ci
npm run browser:install
npm run validate -- full
```

The [validation manifest](.agents/validation.json) owns all required
current-phase checks: exact snapshot, semantic CI policy, dependency audit, source boundaries,
types, lint, formatting, measured unit coverage, governance tests, `build-storybook`,
`test:storybook` and guidance consistency, plus unused-code analysis, production build, bundle budgets, consumer contracts, application E2E, visual comparison and Lighthouse. The browser suite runs all registered stories in headless
Chromium with interaction assertions and accessibility failures treated as errors.
Tests use synthetic values and require no operator environment file or running API.

The two test runs produce real `coverage/unit/lcov.info` and
`coverage/governance/lcov.info` from this checkout. These reports cover the
published providers, forms, layouts, access metadata, widgets, theme/preferences/observability modules, HTTP modules, lifecycle hooks, catalogs, runtime adapters, calendar data,
primitives, composed application routes and repository tooling. Synthetic consumer coverage does not verify the independent API provider. Storybook build output and browser results do not replace these measured
reports. Generated outputs are not committed. See [Sonar setup](docs/sonarqube.md).

## Contribute

Read [Contributing](CONTRIBUTING.md) and the
[publication guide](docs/bootstrap.md). Keep each PR at **100 or fewer GitHub
changed-file entries** and validate the exact proposed revision.

Use native CI, CodeRabbit and SonarQube Cloud checks with
[branch protection](docs/branch-protection.md). Configuration is not evidence of
a completed hosted check. Application source supplies genuine build, end-to-end and visual jobs. Before any runnable merge, observe current-head passes and obtain authorization for the corresponding remote protection transition; configuration alone does not install protection.

## Operational and quality prerequisites

The inherited public examples, deployment/release helpers, pure quality policies and [operational guides](docs/deployment.md) remain published. The exact [inventory](.github/bootstrap-policy.json) contains 471 maintained paths. Its size is separate from the changed-file count of this PR.

New helper regressions join the existing measured unit/governance suites. They exercise explicit synthetic inputs and owned-resource failure handling; they do not start Docker/Chrome, build the panel or contact a deployed API. [Performance policy](docs/performance.md), [contract preparation](docs/contract-testing.md) and [security review](docs/security/reviews.md) describe their actual scope. The four Windows PNGs and metadata are [dated provenance](docs/visual-regression.md), not a fresh baseline approval.

No deployment or operator command is authorized by source publication. Real environments, certificates, API data and operator state remain outside source verification; only the three explicitly declared synthetic public example paths are publishable. Application build/browser/visual/Lighthouse commands must genuinely run on the exact proposed tree. Independent provider, Docker, mutation, staging and deployment checks need their own admitted source, authorization and observed evidence.
