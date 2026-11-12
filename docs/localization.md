# Language, direction and calendar

Use this reference when changing translated text, language settings or displayed dates. The API owns the active language, direction, calendar and public/native language names. Only a system super-admin changes the global language. There is no visitor language selector, browser-language inference or stored language preference. Theme and compact mode are separate browser preferences.

The admitted application includes catalogs, i18next initialization, date adapters,
settings HTTP types, shared controls, Core/Ant Design providers and route composition.

## Find the owner

| Responsibility                                | Source                                                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Supported product codes and complete catalogs | [`locales.ts`](../src/shared/i18n/locales.ts), [`catalogs.ts`](../src/shared/i18n/catalogs.ts) and [`locales`](../src/shared/i18n/locales) |
| Fixed bootstrap language                      | [`index.ts`](../src/shared/i18n/index.ts)                                                                                                  |
| Server metadata types and HTTP boundary       | [Settings API](../src/features/settings/api.ts)                                                                                            |
| Applying accepted language and calendar       | [Core](../src/app/providers/core/Core.tsx)                                                                                                 |
| Ant Design locale and document `lang`/`dir`   | [Antd provider](../src/app/providers/antd/Antd.tsx)                                                                                        |
| Date locales and calendar adapters            | [`date.ts`](../src/shared/i18n/date.ts) and [Persian date data](../src/shared/i18n/dayjs/fa.ts)                                            |

## Catalog ownership

[`src/shared/i18n/locales.ts`](../src/shared/i18n/locales.ts) registers `ar`, `de`, `en`, `es`, `fa`, `fr`, `it`, `pt`, `ru` and `tr`. Each code has one complete flat catalog in `locales/<code>.ts`. Preserve matching keys, nonempty genuine translations and i18next interpolation names. Reuse an existing semantic key before adding another label; do not add English spreads, aliases, nested common objects or per-language directories.

`catalogs.ts` loads those exact objects. Individual catalog files, the code list and Persian date data remain pure modules; any type imports are fully erased local types. They do not initialize React, i18next, Day.js or runtime adapters. The English catalog owns the erased key shape. English-only repository documentation does not remove Persian or other product translations.

To change a product message:

1. Find an existing semantic key before adding another label.
2. Update that key in every registered catalog, preserving interpolation names and genuine translations.
3. Run the admitted catalog, initialization and date tests through [testing](testing.md). When UI source is admitted, also exercise the affected control with long text and both text directions using its component, provider or browser cases.

For a new supported code, update the registered catalogs, language validation and both vendor adapters together. Follow the admitted [localization rule](../.agents/rules/localization.md) and installed-adapter tests rather than treating an English fallback as completed support.

## Runtime metadata

[`index.ts`](../src/shared/i18n/index.ts) initializes i18next/react-i18next with the local catalogs and fixed English bootstrap/fallback. Module loading awaits initialization. Fallback does not excuse an incomplete catalog.

The settings HTTP adapter returns typed language metadata without runtime code
normalization or validation. The contract includes a supported code, explicit
`ltr`/`rtl`, Gregorian/Jalali calendar and names. Malformed metadata handling is
a pending decision in [source-change requests](source-change-requests.md).

Core applies accepted metadata to i18next and Day.js; it currently has no window-focus refresh. The Ant Design provider selects the matching vendor locale and applies server language and direction to the document. Ordinary settings editors retain theme and logo rights while the language chooser remains disabled. Their save may include the current `languageCode`; the backend ignores unauthorized language changes. Only a system super-admin changes the selected language, and the accepted API response remains authoritative for every editor.

## Dates

`date.ts` registers the matching Day.js locales and Jalaliday. Callers pass the supported product code through `dayjsLocaleName(code)` before selecting a Day.js locale; English `en` resolves to the vendor name `en-gb`. Gregorian Persian month names and Jalali month names remain distinct. Callers explicitly select the API-provided calendar, resetting retained date instances when it changes.

The [calendar screen](../src/features/calendar/Calendar.tsx) formats HTTP keys as Gregorian `YYYY-MM-DD` even when the displayed calendar is Jalali. Keep this wire format separate from localized display formatting.

## Fixtures and checks

Storybook controls must select complete synthetic language metadata, independently exercising direction and theme without creating production preferences. Their preview, Core fixture, document, Ant Design, i18next and Day.js must stay synchronized. All production catalogs remain complete.

If text, direction or dates disagree, inspect the accepted settings metadata before changing a catalog or vendor adapter. The [settings tests](../src/features/settings/api.test.ts), [Core tests](../src/app/providers/core/Core.test.tsx) and [date tests](../src/shared/i18n/date.test.ts) cover these boundaries separately. Preserve key/interpolation parity, pure-data imports and catalog registration through their owning tests and review. See [validation](validation.md) for the applicable commands and required gate.
