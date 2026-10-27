# ADR 0003: One system language, complete catalogs

[English](0003-single-active-language.md) · [فارسی](0003-single-active-language.fa.md)

Status: accepted.

Scope updated: 27 October 2026. The `core-auth` publication has
`applicationReady: false`. Its Core/Ant Design providers and authentication forms
implement the client language ownership below; the application entry point,
App/Routes composition, settings/calendar business screens and browser language
journeys remain unpublished.

One persisted active language belongs to API settings for the system. Changing it
requires super-admin authorization in the API. Core loads public settings and
authentication forms consume its language through the local translation adapter.
No visitor language selector, browser language preference or language storage
event is introduced. The API's authorization and persistence need separate API
verification; this record is not evidence of that service's deployment.

The client starts with fixed Persian (`fa`) until public settings succeed.
Initial failure is visible and retryable; a refresh failure retains the last
accepted settings. Focus revalidation reads changes made elsewhere. i18next, Ant
Design and Day.js follow accepted API metadata. Only theme and compact mode are
browser preferences with cross-tab synchronization.

The settings HTTP boundary validates the complete language metadata. Core retains
code, direction, calendar and names from that response. Supported regional codes
normalize to available base-code adapters without replacing other server fields.
Invalid metadata fails visibly; bootstrap metadata never substitutes for a
successful response. Ant Design and HTML consume API direction; Day.js consumes
API calendar. Local mappings select vendor locales and translate `gregorian` to
the Day.js name `gregory`. They do not infer direction or calendar from a code.

Future settings UI must restrict its language control to the super-admin and
omit `languageCode` from ordinary editors' theme/logo updates. API field
authorization remains required; hiding a control is not authorization. Future
calendar UI must follow API calendar metadata, including a calendar-only change,
while coordinating Gregorian `YYYY-MM-DD` wire keys with API owners. No such
business-page or browser result is claimed by this phase.

Keep ten complete flat code-named catalogs with genuine strings and matching
interpolation. Bootstrap fallback does not excuse missing translations. Read
[Core](../../src/app/providers/core/Core.tsx),
[i18next](../../src/shared/i18n/index.ts), [localization](../localization.md),
[HTTP ownership](../http-client.md), [Core/auth ownership](../core-auth.md) and
[publication policy](../bootstrap.md).
