# Local catalog and runtime ownership

[English](localization.md) · [فارسی](localization.fa.md)

The localization contract preserves API authority and has no visitor language preference. Read the [publication policy](../.github/bootstrap-policy.json), [source inventory](bootstrap.md) and [canonical gate](../.agents/validation.json) for the capabilities admitted by the checked revision. A declared command or source file is not evidence that it ran successfully.

Complete local catalogs and real translation/date adapters have tests against their installed dependencies in Node; synthetic Core/Ant Design provider tests run in isolated jsdom. Isolated Storybook checks demonstrate their component scope. Application composition and complete browser journeys require their own admitted checks and actual results; neither catalog nor provider tests establish those results.

## One complete catalog per language

[src/shared/i18n/locales.ts](../src/shared/i18n/locales.ts) owns ten codes: ar, de,
en, es, fa, fr, it, pt, ru and tr. Each has exactly one locales/<code>.ts object
with 111 nonempty root string messages. [catalogs.ts](../src/shared/i18n/catalogs.ts)
registers those same objects; do not copy them or add compatibility wrappers.
Reuse semantic root keys, preserve i18next {{variable}} names and maintain genuine
translations. No nested common object, common. prefix, split admin/common file,
per-language directory, English spread or fallback placeholder is permitted.
The English catalog owns the erased TranslationCatalog key shape.

Leaf catalogs, locales.ts and [dayjs/fa.ts](../src/shared/i18n/dayjs/fa.ts) may import
only fully erased local types. No runtime fallback imports, re-exports, dynamic
imports or require. Only catalogs.ts loads canonical catalog objects. Data cannot
import runtime adapters or packages. The independent API and website own their
own source; neither checkout is a runtime dependency.

## Translation initialization and authority

[index.ts](../src/shared/i18n/index.ts) owns i18next/react-i18next initialization
using the actual local catalogs and a fixed Persian bootstrap/fallback. Module
loading awaits initialization, so consumers receive an initialized engine. It does
not inspect or persist browser language preferences. React is a runtime dependency
of the translation plugin. Published authentication forms consume its resources. A missing key retains its
identity and emits a diagnostic; fallback never excuses missing translations.

[language.ts](../src/shared/config/language.ts) normalizes registered code prefixes
including region variants. It selects a supported catalog only, with no direction
or calendar table. The API owns active language, direction, calendar and both
public/native names; only a super-administrator may change the active language.
The [HTTP settings adapter](http-client.md) validates and preserves complete server
metadata and localized errors. Missing/unsupported metadata fails without local
direction/calendar inference. The [Core provider](core-auth.md) applies accepted server metadata to i18next and Day.js; the Ant Design provider selects its exact locale and mirrors the server direction/code to the document. No visitor language chooser is provided; complete application journeys need their own executed evidence. Theme and compact
preferences are separate concerns.

[Storybook](storybook-verification.md) uses explicit synthetic English/Persian API
metadata objects. Its test-only language toolbar selects a complete object, while
direction and theme controls remain independent. It synchronizes the preview,
StoryShell, document, Ant Design, i18next and Day.js; it does not persist a visitor
language or infer production direction/calendar from a code. Translated play
selectors use the active local engine. Both fixture languages retain all ten
complete production catalogs and server authority.

The [error helper](../src/shared/lib/error.ts) preserves actual Error messages and
uses the active translation engine's unexpectedError message for other thrown
values. It does not trust a message property on an arbitrary object.

## Date registration

[date.ts](../src/shared/i18n/date.ts) registers nine vendor Day.js locales plus
the local Persian locale and the Jalaliday plugin. English maps to the vendor name en-gb. The
registration adds localized Persian-calendar month names without changing the
active language or calendar. Callers explicitly choose the API-selected calendar;
this module does not infer it from a code. Gregorian months and Jalali jmonths
remain distinct in the pure Persian data.

Tests with the actual libraries verify the nine vendor locales and local Persian
locale, Gregorian/Jalali years,
nonempty distinct month names and twelve unique Persian-calendar month names.
Persian Gregorian September and Jalali Shahrivar labels are checked directly.
No browser or operating-system locale is used to select the active language.

## Validation and evidence

Catalog integrity tests inspect complete root keys, interpolation, canonical
identity, pure imports and the literal-data AST. Adapter tests use actual engines,
all ten catalogs, fixed fallback, synthetic storage spies and code normalization.
The boundary guard permits only exact adapter package paths contained in this
checkout, while keeping contracts and data pure. Every new production module
remains in measured coverage and source/security/duplication analysis; the existing
ten literal language-data files alone retain their authorized CPD exception.

Run npm ci, npm run browser:install, then npm run validate -- full. All canonical checks run on every
PR regardless of changed paths, with environment-file discovery disabled and real
LCOV from this exact checkout. Required static Storybook build and real Chromium
play/a11y checks add isolated component evidence; they do not replace those reports.
Follow [Sonar preflight](sonarqube.md). Complete application integration, production
build, E2E and visual evidence must join the full application gate before any runnable
panel merges.
