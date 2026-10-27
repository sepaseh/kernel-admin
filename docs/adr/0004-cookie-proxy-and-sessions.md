# ADR 0004: API sessions and the website cookie proxy

[English](0004-cookie-proxy-and-sessions.md) · [فارسی](0004-cookie-proxy-and-sessions.fa.md)

Date: 23 October 2026. Status: accepted.

Scope updated: 27 October 2026. The non-runnable `core-auth` publication has
`applicationReady: false`. This record preserves consumer ownership and required
integration behavior. It does not freshly verify API/website implementation,
cookie deployment, session revocation, OTP delivery or production security.

## Context and decision

The API owns credentials, session persistence, authentication execution and
authorization. The admin's published Axios client keeps bearer credentials in
memory and coordinates a separate cookie-based refresh request. Token replies
are runtime-validated; request/login generations prevent old responses, refresh
or logout from changing a new login. Optional auth abort signals preserve that
guard and are checked before login/registration installs a token.

The independent website owns its cookie/proxy consumer. A same-origin HttpOnly
auth/account proxy must have narrowly allowed paths, preserve native Set-Cookie
headers, reject foreign mutation Origins, strip successful auth token fields from
website JSON and prevent private-response caching. These are requirements for its
owners to verify separately, not capabilities supplied or tested by this admin
snapshot. Neither consumer owns password hashing or database authorization.

## Consequences

The admin needs trusted API origins and XSS defenses; in-memory bearer storage
does not itself provide either. Refresh handling does not establish server token
rotation or reuse detection. Terminal client failure clears local credentials,
not server sessions. Cancellation cannot undo a server mutation already committed
or a browser cookie side effect.

Verify session representation, expiration, explicit logout, password-change and
recovery revocation with API owners. Verify cookie/status/error behavior with
website owners. Production OTP delivery and abuse controls need separate evidence
before any OTP-dependent journey is considered ready. Older findings in these
areas are historical context, not a fresh pass/fail for those repositories.

## Source and verification

Read the [admin client](../../src/shared/api/client.ts),
[auth owner](../../src/features/auth/api.ts), [HTTP ownership](../http-client.md),
[request lifecycle](../request-lifecycle.md), [Core/auth ownership](../core-auth.md)
and [authentication review checklist](../security/authentication-review.md).
Local synthetic Axios/MSW and provider/form/layout tests exercise client guards;
they do not cover real server persistence, cookies or a browser deployment.
The [publication guide](../bootstrap.md) defines the nine-check phase gate and
the later runnable requirements. Supersedes: none.
