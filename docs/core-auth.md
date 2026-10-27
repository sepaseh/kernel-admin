# Core providers and authentication shell

[English](core-auth.md) · [فارسی](core-auth.fa.md)

The `core-auth` publication adds Core/Ant Design providers, access and navigation
metadata, login/registration/password recovery forms, and authentication/default
layouts to the existing HTTP and UI foundations. It has
`applicationReady: false`: there is no application entry point, assembled route
tree or runnable panel. Route metadata includes future destinations; it does not
publish those business screens.

## Provider and preference ownership

`CoreProvider` loads validated application settings through the shared read
lifecycle. It starts with Persian bootstrap metadata, retains usable settings
during refresh, supports retry and refreshes on focus. Accepting a saved settings
snapshot supersedes the older read. Aborted or obsolete reads cannot overwrite
the current settings. `SettingsFeedback` exposes loading, failure and retry state
to the eventual application composition.

The API owns the active language, direction, calendar, names, logos and palettes.
Core passes the exact validated metadata to i18next, Day.js and `AntdProvider`;
the Ant Design adapter supplies all ten registered vendor locales and updates the
document language/direction. It derives appearance from the pure shared contract.
Only theme and compact mode are browser preferences, with storage-event updates.
There is no visitor language preference. See [localization](localization.md) and
[UI foundation](ui-foundation.md).

`useCore` and `useAntd` require their corresponding providers. The later
application must compose Core outside Ant Design and mount forms/layouts inside a
router. This stage tests those modules with explicit synthetic provider/router
trees rather than introducing production initialization.

## Session and access ownership

The default layout loads the current account, displays loading/retry feedback and
derives navigation from the account's permissions. Route action helpers use the
same permission vocabulary and system-administrator rule. These checks control
presentation; the separate API must authorize every protected operation.

Entering the authentication layout invalidates the previous client session.
Logout shares an in-flight operation for the current token generation. The
default layout clears its client state after logout, including a failed logout,
but an older completion cannot clear a newer login. The shared HTTP layer still
owns refresh, unauthorized handling and generation checks. Client cleanup alone
does not prove server session revocation; see [HTTP ownership](http-client.md)
and the [authentication review checklist](security/authentication-review.md).

## Form request lifecycle

Login, registration, OTP and password recovery accept an optional `AbortSignal`
at the feature HTTP boundary. Forms abort their own pending operations when they
unmount. Changing the mobile number aborts its old OTP request and clears the old
OTP/cooldown state before a new request. A pending-operation guard binds intent
before asynchronous OTP field validation. Validation failures remain inline;
canceled work does not produce a generic failure toast or a late redirect.

Login and registration also inspect cancellation after transport fulfillment and
before storing an access token, alongside the existing session-generation guard.
This closes the gap where a fulfilled promise could otherwise install a token
after its page had left. Cancellation protects client continuation and state; it
cannot undo a server-side mutation or a cookie already accepted by the browser.
Request URLs and payloads are unchanged. See [request reliability](admin-request-reliability.md).

## Evidence and later activation

Real React/Ant Design tests in jsdom exercise Core settings replacement and
focus/retry, exact locale metadata, account/navigation/layout behavior and form
validation/cancellation. Synthetic Axios/MSW transport tests cover cancellation
of the four authentication operations; a separate fulfilled-response regression
checks that aborted login/registration cannot install tokens. Regression tests
for the token race, late login navigation and invalid-mobile feedback fail
against the preceding behavior.

The canonical [nine-check phase gate](../.agents/validation.json) measures every
published production module. It includes types, formatting, lint, dependency and
boundary checks plus real unit/governance coverage. These tests establish the
declared module behavior. They do not establish API integration, a production
build, browser journeys, font loading or visual results. The later runnable
publication must expand the full gate to all nineteen genuine application
checks and observe its required build/browser/visual jobs pass before merge.

See [architecture](architecture.md), [bootstrap scope](bootstrap.md) and
[Contributing](../CONTRIBUTING.md) for the maintained boundaries and handoff rules.
