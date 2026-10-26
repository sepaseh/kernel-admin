# Local catalog ownership

[English](localization.md) · [فارسی](localization.fa.md)

The current [catalogs phase](bootstrap.md) publishes pure local translation and
calendar data. It does not initialize i18next, React, date vendors or a browser.
`applicationReady:false` remains deliberate.

## One catalog per language

[`src/shared/i18n/locales.ts`](../src/shared/i18n/locales.ts) owns the ten supported
catalog codes: `ar`, `de`, `en`, `es`, `fa`, `fr`, `it`, `pt`, `ru` and `tr`.
Each code has exactly one `locales/<code>.ts` file and one complete object with
110 root string messages. [`catalogs.ts`](../src/shared/i18n/catalogs.ts) registers
those same objects directly; do not create copied or compatibility objects.

Reuse an existing semantic root key before adding another label. Do not introduce
nested `common` objects, `common.` prefixes, split admin/common files, per-language
directories or obsolete aliases. Keep every translation nonempty and genuine;
English spreads, copied English placeholders and runtime fallback do not provide
a translation. Preserve i18next `{{variable}}` interpolation names in every locale.
The English catalog owns the key shape, and the other catalogs satisfy that
shape through the erased `TranslationCatalog` type.

The leaf `locales/<code>.ts` catalogs, code metadata in `locales.ts` and calendar
data in `dayjs/fa.ts` may import only fully erased local types, such as
`TranslationCatalog`. They must not load fallback data through runtime imports,
runtime re-exports, dynamic imports or `require`. Only the `catalogs.ts` registry
may load the canonical local catalog objects at runtime. Runtime translation
engines, UI libraries, date packages and source from other checkouts do not belong
in these data modules. The independent API and website own their own catalogs and
contracts; their source is not a runtime dependency of this application.

## Language authority and calendar data

The code registry selects available local catalogs only. The API owns the active
language, direction, calendar, public name and native name. Future HTTP/runtime
adapters must validate and preserve that complete metadata, rather than infer
direction or calendar from a language code. There is no visitor language chooser
or persisted browser language preference. Only a system super-administrator may
change the active language through API settings.

The future runtime starts with a fixed Persian bootstrap until validated API
settings load, and must retain explicit retry/error behavior. That fallback never
excuses missing catalog data. Theme and compact preferences are separate concerns.
Language loading, runtime switching and browser behavior are not implemented or
verified by this pure-data phase.

[`dayjs/fa.ts`](../src/shared/i18n/dayjs/fa.ts) is pure Persian calendar-vendor data,
separate from UI messages. Keep Gregorian `months` distinct from Jalali `jmonths`,
with complete weekday, format and relative-time data. The object's structure is
vendor data, not a nested message catalog or an active-calendar setting. A future
date adapter must register the real vendor locales and use the API-selected
calendar; this data alone does not establish date-rendering behavior.

## Integrity checks and evidence

[`catalogs.test.ts`](../src/shared/i18n/catalogs.test.ts) checks complete nonempty
root keys, placeholder parity, one code-named file per registered language,
canonical object identity, pure imports, removed split catalogs and published
source callers. Its caller inspection covers the source actually published here;
it does not claim coverage of absent UI, Storybook or browser fixtures. Human
review still evaluates translation quality and meaning.

Run the [canonical full gate](../.agents/validation.json):

```sh
npm ci
npm run validate -- full
```

All nine required phase checks run on each PR regardless of changed paths.
Catalog tests join the existing Node-based Vitest run, with environment-file
discovery disabled and actual measured LCOV from the same checkout. Preserve
the [Sonar and review preflight](sonarqube.md); passing pure-data tests does not
establish a runnable panel.

When runtime adapters arrive, add their actual i18next initialization, API-language
validation, vendor-locale/calendar, component and browser tests to the canonical
gate before runnable publication. Do not use a source-only pass, placeholder jobs
or tests over unpublished files as integration evidence.
