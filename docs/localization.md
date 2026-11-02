# Language, direction and calendar

Use this reference when changing translated text, language settings or displayed dates. The API owns the active language, direction, calendar and public/native language names. Only a system super-admin changes the global language. There is no visitor language selector, browser-language inference or stored language preference. Theme and compact mode are separate browser preferences.

The `runtime-localization` snapshot admits catalogs, normalization, i18next initialization and date adapters. Settings HTTP validation, Core and Ant Design providers, application screens and Storybook fixtures are later integration requirements. Their descriptions below define the intended ownership; current module tests do not establish those application flows.

## Find the owner

| Responsibility                                  | Source                                                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Supported product codes and complete catalogs   | [`locales.ts`](../src/shared/i18n/locales.ts), [`catalogs.ts`](../src/shared/i18n/catalogs.ts) and [`locales`](../src/shared/i18n/locales) |
| Fixed bootstrap language and code normalization | [`config/language.ts`](../src/shared/config/language.ts)                                                                                   |
| Runtime validation of server metadata           | Settings API (`src/features/settings/api.ts`, planned for a later PR)                                                                      |
| Applying accepted language and calendar         | Core (`src/app/providers/core/Core.tsx`, planned for a later PR)                                                                           |
| Ant Design locale and document `lang`/`dir`     | Antd provider (`src/app/providers/antd/Antd.tsx`, planned for a later PR)                                                                  |
| Date locales and calendar adapters              | [`date.ts`](../src/shared/i18n/date.ts) and [Persian date data](../src/shared/i18n/dayjs/fa.ts)                                            |

## Catalog ownership

[`src/shared/i18n/locales.ts`](../src/shared/i18n/locales.ts) registers `ar`, `de`, `en`, `es`, `fa`, `fr`, `it`, `pt`, `ru` and `tr`. Each code has one complete flat catalog in `locales/<code>.ts`. Preserve matching keys, nonempty genuine translations and i18next interpolation names. Reuse an existing semantic key before adding another label; do not add English spreads, aliases, nested common objects or per-language directories.

`catalogs.ts` loads those exact objects. Individual catalog files, the code list and Persian date data remain pure modules; any type imports are fully erased local types. They do not initialize React, i18next, Day.js or runtime adapters. The English catalog owns the erased key shape. English-only repository documentation does not remove Persian or other product translations.

To change a product message:

1. Find an existing semantic key before adding another label.
2. Update that key in every registered catalog, preserving interpolation names and genuine translations.
3. Run the admitted catalog, initialization and date tests through [testing](testing.md). When UI source is admitted, also exercise the affected control with long text and both text directions using its component, provider or browser cases.

For a new supported code, update the registered catalogs, language validation and both vendor adapters together. Follow the localization rule (`.agents/rules/localization.md`, planned for a later PR) and the installed-adapter tests rather than treating an English fallback as completed support.

## Runtime metadata

[`index.ts`](../src/shared/i18n/index.ts) initializes i18next/react-i18next with the local catalogs and fixed Persian bootstrap/fallback. Module loading awaits initialization. Missing keys retain their identity and produce a diagnostic; fallback does not excuse an incomplete catalog.

`config/language.ts` normalizes supported regional code prefixes to a catalog code only. It does not infer direction or calendar. When admitted, the settings HTTP adapter must require a supported code, explicit `ltr`/`rtl`, Gregorian/Jalali calendar and nonblank names. It must preserve server direction/calendar even when they differ from code conventions and reject malformed metadata with a controlled translated error.

The later Core provider must apply accepted metadata to i18next and Day.js. The Ant Design provider must select the matching vendor locale and apply server language/direction to the document. Application integration must refresh public settings on window focus. Ordinary settings editors retain theme/logo rights and omit `languageCode`; only a system super-admin changes it.

## Dates

`date.ts` registers the matching Day.js locales and Jalaliday. Callers pass the supported product code through `dayjsLocaleName(code)` before selecting a Day.js locale; English `en` resolves to the vendor name `en-gb`. Gregorian Persian month names and Jalali month names remain distinct. Callers explicitly select the API-provided calendar, resetting retained date instances when it changes.

The calendar screen (`src/features/calendar/Calendar.tsx`, planned for a later PR) formats HTTP keys as Gregorian `YYYY-MM-DD` even when the displayed calendar is Jalali. Keep this wire format separate from localized display formatting.

## Fixtures and checks

Later Storybook controls must select complete synthetic language metadata, independently exercising direction and theme without creating production preferences. Their preview, Core fixture, document, Ant Design, i18next and Day.js must stay synchronized. All production catalogs remain complete.

If text, direction or dates disagree, inspect the accepted settings metadata before changing a catalog or vendor adapter. The settings tests (`src/features/settings/api.test.ts`, planned for a later PR), Core tests (`src/app/providers/core/Core.test.tsx`, planned for a later PR) and [date tests](../src/shared/i18n/date.test.ts) cover these boundaries separately. Key/interpolation parity, pure-data imports and catalog registration are also checked by the existing source gates. See [validation](validation.md) for the applicable commands and required gate.
