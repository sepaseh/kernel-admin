# Authentication and session review

[English](authentication-review.md) · [فارسی](authentication-review.fa.md)

Scope updated: 27 October 2026. This is a review checklist for the non-runnable
`core-auth` phase (`applicationReady: false`), not a completed security audit or
approval. Providers, authentication forms, layouts and HTTP modules can be tested
with synthetic fixtures; the application entry point, App/Routes composition,
business pages, production build and browser journeys are not published.

Before session/credential changes, review [client.ts](../../src/shared/api/client.ts),
[token.ts](../../src/shared/api/token.ts), [auth API](../../src/features/auth/api.ts)
and their tests. Check that bearer credentials remain memory-only, a successful
login replaces identity, simultaneous attributed 401s share one refresh, and a
protected request replays at most once. Old-generation responses, refresh, logout
and mutations must not change a newer login. Public or unattributed failures must
not refresh or clear current authentication. Network, timeout, 429 and 5xx
failures must not automatically replay mutations.

Check optional `AbortSignal` propagation for login, registration, forgot-password
and OTP requests. Login/registration must check abort and generation before
installing a validated token, even if an adapter finishes after cancellation.
Forms must ignore obsolete/unmounted results and release their busy state.
Cancellation protects client state; it cannot undo an already committed server
mutation or browser cookie side effect.

Inspect code and synthetic test storage, URLs, analytics and log output for
credential exposure. Use synthetic fixtures to test login, rejected login,
logout, account restoration, expiry, transient/offline failures and cancellation.
The default layout must hide protected children while checking the account or
showing a transient error. Core must preserve server-owned language/direction/
calendar, with only theme/compact preferences in browser storage. Do not read
real environment files, credentials, browser state or private logs as test inputs.

Terminal client refresh failure clears local credentials; it does not revoke
server sessions. Verify session representation, expiration, password/recovery
revocation, authorization, CORS/Origin policy, abuse controls and private
cache/cookie behavior with API owners when contracts change. Website HttpOnly
cookie/proxy behavior belongs to its independent repository. This checklist is
not fresh evidence for either service or a token-rotation/reuse-detection claim.

Run the [published full gate](../bootstrap.md) on the exact isolated snapshot and
record actual results. Real browser/deployment checks belong to the later
runnable gate. Never contact real targets or send a security review without
authorization. Read [HTTP ownership](../http-client.md),
[request reliability](../admin-request-reliability.md),
[Core/auth ownership](../core-auth.md) and the [session ADR](../adr/0004-cookie-proxy-and-sessions.md).
