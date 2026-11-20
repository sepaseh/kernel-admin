# Kernel Admin localization

Use this reference when changing translated text, language settings or displayed dates. The API owns active language, direction, calendar and language names. Theme and compact mode are browser preferences.

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

[`src/shared/i18n/locales.ts`](../src/shared/i18n/locales.ts) registers `ar`, `de`, `en`, `es`, `fa`, `fr`, `it`, `pt`, `ru` and `tr`. Each code has one complete flat catalog in `locales/<code>.ts`. Keep catalog keys and interpolation placeholders consistent across languages. Keep genuine translations nonempty and preserve i18next interpolation names. Reuse an existing semantic key before adding another label; do not add English spreads, aliases, nested common objects or per-language directories.

`catalogs.ts` loads those exact objects. Individual catalog files, the code list and Persian date data remain pure modules; any type imports are fully erased local types. They do not initialize React, i18next, Day.js or runtime adapters. The English catalog owns the erased key shape. English-only repository documentation does not remove Persian or other product translations.

Choose the catalog key based on the meaning the control needs to express.

1. Reuse an existing key when its meaning matches. For a new meaning, add the same key to every catalog.
2. Update each translation and preserve the interpolation names used by the call site.
3. Run the catalog, initialization and date tests. Exercise the affected control with long text and both directions in the applicable component, provider or browser cases. [Testing](testing.md)

For a new supported code, update the registered catalogs, supported-code types and both vendor adapters together. Follow the admitted [localization rule](../.agents/rules/localization.md) and installed-adapter tests rather than treating an English fallback as completed support.

## Review sensitive translations

Review the meaning of changed translations in the rendered message or API
response. Check that each translation preserves the original action and its
consequence, including negation, irreversibility, permission, expiry and retry
conditions. Check the message in context with representative interpolated
values. Catalog checks verify keys and placeholders. Record the languages
reviewed and any pending linguistic review with the change evidence.

For a delete confirmation, verify that each translation communicates that
confirming will delete the selected item. Preserve any warning about
irreversibility in the source message.

## Runtime metadata

[`index.ts`](../src/shared/i18n/index.ts) initializes i18next/react-i18next with the local catalogs and fixed English bootstrap/fallback. Module loading awaits initialization and reports initialization rejection. Missing keys retain their identity and produce a diagnostic; fallback does not excuse an incomplete catalog.

The settings HTTP adapter uses the language metadata returned by `GET /settings` and `PUT /settings`. The backend sends a registered code, explicit `ltr` or `rtl` direction, calendar value `gregory` or `jalali`, and `name` and `native_name`. The adapter converts JSON keys to camel case and relies on that response shape. [Settings response types](../src/features/settings/types.ts) · [Settings adapter](../src/features/settings/api.ts)

Core fetches settings on mount, offers inline retry after an initial failure and cancels a pending read when saved settings are accepted. It applies accepted metadata to i18next and Day.js. The Ant Design provider selects the matching locale and sets document `lang` and `dir` from the response. [Core provider](../src/app/providers/core/Core.tsx) · [Ant Design provider](../src/app/providers/antd/Antd.tsx)

Settings sends `language_code` only for a system super-admin. An ordinary settings editor can save supported palette and logo changes while the language selector is disabled. Every editor's interface uses the accepted response, including any language metadata the backend returns. [Settings form](../src/features/settings/Settings.tsx) · [Language authority browser tests](../e2e/language-authority.spec.ts)

## Dates

`date.ts` registers the matching Day.js locales and Jalaliday. Callers pass the supported product code through `dayjsLocaleName(code)` before selecting a Day.js locale; English `en` resolves to the vendor name `en-gb`. Gregorian Persian month names and Jalali month names remain distinct. Callers explicitly select the API-provided calendar, resetting retained date instances when it changes.

The calendar screen sends Gregorian `YYYY-MM-DD` to the API while the calendar grid and month labels follow the selected display calendar. Persian text with a Gregorian calendar and English text with a Jalali calendar are both valid metadata combinations. [Calendar implementation](../src/features/calendar/Calendar.tsx) · [Date adapter tests](../src/shared/i18n/date.test.ts)

## Fixtures and checks

Use the English and Persian language fixtures in Storybook. The direction control can override the selected fixture's direction, so exercise both directions independently of language when reviewing layout. The preview uses the same Ant Design provider, catalogs and date adapter as the application with synthetic settings. [Storybook preview](../.storybook/preview.tsx) · [Story frame](../.storybook/PreviewFrame.tsx)

If text, direction or dates disagree, inspect the accepted settings metadata before changing a catalog or vendor adapter. The [settings tests](../src/features/settings/api.test.ts), [Core tests](../src/app/providers/core/Core.test.tsx) and [date tests](../src/shared/i18n/date.test.ts) cover these boundaries separately. Preserve key/interpolation parity, pure-data imports and catalog registration through their owning tests and review. See [validation](validation.md) for the applicable commands and required gate.
