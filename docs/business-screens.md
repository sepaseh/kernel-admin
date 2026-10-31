# Business screens and guarded forms

[English](business-screens.md) · [فارسی](business-screens.fa.md)

Account, users, roles, settings, calendar and dashboard modules build on the [Core/auth foundation](core-auth.md). The dashboard supplies a layout frame and does not implement dashboard metrics. Mutation, permission, request-generation and settings-language ownership below apply independently of publication phase.

Read the [publication policy](../.github/bootstrap-policy.json) and [canonical full gate](../.agents/validation.json) before claiming application composition or readiness. While `applicationReady` is false, independently tested modules and the isolated [Storybook workshop](storybook-verification.md) do not establish a production build, complete application journey or approved visual comparison.

## Mutation ownership

`useMutationRequest` reserves an operation before asynchronous work and rejects a
second pending call. It binds work to its mounted consumer, logical identity,
permission and token generation. Identity/permission changes, explicit cancellation
and unmount invalidate the operation. Cancellation is passed to the HTTP adapter;
an adapter that ignores it still cannot produce an accepted obsolete result.
A callback retained from an old record or session cannot start new work.
Ownership changes only at a committed layout effect; a suspended or abandoned
render cannot invalidate the operation owned by the still-visible screen.

`run` returns an accepted result object, including for a successful void response.
Callers check `result?.isCurrent()` immediately before accepting data, displaying
ordinary success feedback owned by that consumer or navigating: cancellation or
another request can intervene after the promise settles. Current errors stay available to the owning form; cancellation
does not produce a generic error toast. The hook does not retry mutations;
the HTTP client may replay an eligible protected write once after a 401 and
successful refresh in the same login generation. Transient write failures are
not automatically replayed.
Errors preserve their original value in `cause`; consumers check
`isCurrentMutationError(error)` before showing feedback from `error.cause`, since
the request can become obsolete between rejection and the caller's catch.
Aborting client work cannot undo an already committed server mutation.

Account OTP intent is bound before asynchronous email validation. Changing email
invalidates pending verification and clears old digits/countdown. Profile,
username and verified-email replies update their own account fields, so reversed
full-account responses cannot discard an already accepted independent change.
Changing password cannot clear a newer login.

Users and roles check create/update permissions at form entry and submission,
including direct hash navigation. Closing a drawer, changing record or changing
session invalidates pending continuations. Menus and disabled controls improve
presentation; the separate API must authorize every operation.
User filters retain their 500ms debounce and cancel pending timers on unmount.

Generated user passwords are a specific acknowledged outcome: after a create-user
or reset-password request resolves successfully, the initiating operation retains
the password and uses the app-level notification to show it within the same login
generation, even if its consumer unmounted, changed scope or cancelled. The
notification never crosses a login-generation change. Ordinary obsolete form
updates, navigation and error feedback remain guarded. An aborted or rejected HTTP
response does not establish whether the server applied the password and must not
be presented as confirmed success.

Settings preserve API-owned language, direction, calendar and palettes. Only a
super-administrator includes a language change; accepted settings replace the
older Core read. Removing/replacing a pending logo invalidates its upload before
clearing the selected ID. Upload and OTP controls have translated accessible names.
Calendar writes use the same lifecycle and preserve API date payloads and read retry.

## Verification boundary

The exact inventory, production dependency ownership and measured coverage grow
with these modules. All canonical checks and existing thresholds remain
required. Real React/Ant Design tests run in isolated jsdom; synthetic HTTP tests
use fail-closed mocks. Test support stays independent of another checkout. The
separate Storybook test project uses full synthetic API owner mocks and real
Chromium; it does not run application startup or replace measured unit/governance coverage.

These module tests do not establish application execution or external API behavior.
The admitted application phase adds separately executed production build and browser
journeys. The manifest owns the blocking full profile, complete compatibility,
applicable visual checks and separate performance responsibilities.
See [request reliability](admin-request-reliability.md), [input validation](input-validation.md)
and [publication policy](bootstrap.md).
