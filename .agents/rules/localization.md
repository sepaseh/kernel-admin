# Local translation catalogs

## Maintain catalogs

Keep one flat `Record<string, string>` catalog in
`src/shared/i18n/locales/<code>.ts` for each of the ten codes in `locales.ts`.
`catalogs.ts` registers the catalog objects directly. Keep
shared and admin-only messages in the same catalog for each language. Reuse
semantic root keys and remove superseded aliases.

Keep message keys and placeholders consistent across all catalogs. Give every
key a genuine, nonempty translation in each supported language.
Preserve i18next `{{variable}}` placeholders and retain English for bootstrap
and runtime fallback. Apply the [ordering rules](ordering.md) to translation keys.

Use the existing i18next adapter and `useTranslation` for user-visible text.
Use i18next pluralization for count-based messages.

Keep catalog data and its integrity tests local. Catalogs contain UI messages
and use pure data modules with only their permitted type imports. Put Persian
calendar adapter data in `dayjs/fa.ts`. Use local imports within the adapter
and `@/shared/i18n` from other frontend modules. Keep wire language codes
compatible with the local HTTP contract. [Type-only imports](imports.md#type-only-edges)

## Apply settings metadata

Public API settings own language, direction and calendar before and after sign-in.
`index.ts` initializes i18next with `en`. Core loads settings on mount and offers
an inline retry for a failed first load. Accepting a save cancels the pending read.
Keep settings independent of window-focus and storage events, and leave legacy
stored language values untouched. Preserve browser persistence and cross-tab
synchronization for theme and compact mode.

Keep the language control restricted to authorized system super-admins.
Ordinary `settings.update` saves omit `languageCode` and retain theme and logo
permissions. Apply the settings returned by the API after a save. The HTTP
adapter returns typed metadata without runtime normalization or validation.
Pass the complete language object through to consumers.

## Apply calendar metadata

Use API direction for Ant Design and `document.dir`. Use API calendar for Day.js
and Calendar. Product language codes may choose vendor locale modules. Use
`dayjsLocaleName(code)` for the mapping, including `en` to `en-gb`.

`date.ts` registers the vendor locales and uses `Intl` Persian-calendar formatting
to supply Jalali month names. Keep Gregorian Persian month data and `jmonths`
separate. Apply calendar metadata explicitly to labels and values, reset retained
date instances when the calendar changes and persist Gregorian `YYYY-MM-DD` keys.
Verify both calendars with all ten loaded vendor locales.

## Verify a localization change

Use typecheck and the unit coverage suite for catalog integrity, runtime behavior
and jsdom components. Use synthetic language metadata for an affected Storybook
check. Select commands for the current change from the manifest.
[Localization guide](../../docs/localization.md) · [Storybook fixtures](../../docs/localization.md#fixtures-and-checks) · [Validation manifest](../validation.json)
