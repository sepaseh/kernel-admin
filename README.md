# Kernel Admin

[English](README.md) · [فارسی](README.fa.md)

Kernel Admin is a standalone TypeScript project. The current **http-lifecycle**
phase publishes HTTP/feature adapters, request lifecycle hooks, server-owned settings
validation, local catalogs, real translation/date adapters and their tests. `applicationReady` is
**false**: this snapshot does not provide a runnable management panel.

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
  each of the ten [local codes](src/shared/i18n/locales.ts), with 110 root messages
  per language. [Persian calendar data](src/shared/i18n/dayjs/fa.ts) stays separate
  from UI messages. Read [localization](docs/localization.md) for ownership and
  integrity checks.

- [HTTP transport and feature owners](docs/http-client.md) preserve session generations,
  validate token/settings replies and consume the independent API.
- [Read lifecycle hooks](docs/request-lifecycle.md) cancel obsolete work and preserve
  accepted data across refresh failures.
- [Appearance vocabulary](src/shared/contracts/appearance.ts) owns Theme and seven
  palette fields without initializing Ant Design.

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
This phase contains HTTP and real hook tests with synthetic MSW/jsdom fixtures,
with no React screens, Ant Design engine, server or browser journeys. The separate API owns
authentication, database and storage, plus active language, direction and calendar.

## Install and validate

Use the Node.js version in [`.nvmrc`](.nvmrc), within the supported range in
[`package.json`](package.json), and the npm bundled with that Node.js release.

```sh
npm ci
npm run validate -- full
```

The [validation manifest](.agents/validation.json) owns all nine required
current-phase checks: exact snapshot, semantic CI policy, dependency audit, source boundaries,
types, lint, formatting, measured unit coverage and governance tests. Tests use
synthetic values and require no environment file, running API or browser.

The two test runs produce real `coverage/unit/lcov.info` and
`coverage/governance/lcov.info` from this checkout. These reports cover the
published HTTP modules, lifecycle hooks, catalogs, runtime adapters, calendar data,
primitives and repository tooling; they are not complete panel
coverage. Generated reports are not committed. See [Sonar setup](docs/sonarqube.md).

## Contribute

Read [Contributing](CONTRIBUTING.md) and the
[publication guide](docs/bootstrap.md). Keep each PR at **100 or fewer GitHub
changed-file entries** and validate the exact proposed revision.

Use native CI, CodeRabbit and SonarQube Cloud checks with
[branch protection](docs/branch-protection.md). Configuration is not evidence of
a completed hosted check. HTTP/lifecycle protection requires its published CI and
provider checks. Before any runnable panel merges, genuine build, end-to-end and
visual jobs must pass and become required checks, and the canonical full gate
must expand to cover the application.
