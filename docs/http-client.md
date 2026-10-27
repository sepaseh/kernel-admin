# HTTP client and server settings

[English](http-client.md) · [فارسی](http-client.fa.md)

The non-runnable [publication phase](bootstrap.md) includes the Axios transport
and seven feature HTTP owners: authentication, account, roles, users, settings,
calendar and settings logo uploads. Their local types describe HTTP data, not
server implementations. Database, authentication execution and storage belong to
the independent API. No backend SDK, other checkout or UI barrel is imported.

## Transport boundary

[config.ts](../src/shared/api/config.ts) uses the explicit VITE_API_BASE_URL when
provided, otherwise the browser origin. This is frontend public configuration;
never place credentials in it. Tests disable environment-file discovery and
supply a synthetic URL before loading the transport.

[client.ts](../src/shared/api/client.ts) uses the installed Axios implementation,
credentials, a 15-second timeout and explicit AbortSignal propagation. JSON
request keys become snake case and response keys become camel case. FormData and
binary responses retain their identity. The generic DTO methods assert the
declared wire shape at this HTTP boundary; key conversion itself returns unknown
and does not validate that shape. Authentication replies and application settings
receive explicit runtime validation before changing session or application state.

Errors preserve a nonempty API message and structured cause, or use translated
timeout/network/unexpected-error text. Only request IDs matching the bounded
safe identifier format are retained. Cancellation stays an Axios cancellation.
No credentials or payloads are logged.

## Session authority

Every protected operation captures the current session generation synchronously
when the client method is called. The queued Axios interceptor cancels an intent
if login/logout already changed that generation, before sending its payload.
Every client method checks that same generation again after Axios fulfills,
before returning data or converting keys. Login/registration also check before
committing a token. Late success, 401 and refresh responses from an older account
cannot affect the new account. Public GET/HEAD settings reads remain independent of a session.

A protected 401 shares one refresh per generation and retries once. A refresh
updates the token within that generation; login/logout invalidates it. A canceled
waiter does not cancel another waiter's shared refresh. Transient failures and
malformed refresh replies leave authentication retryable. Definitive refresh
401/403 and a current retried 401 expire the current session once. Unattributed
401 responses cannot authorize clearing a session. Login, registration and
refresh validate a nonblank string access token before storing it. Logout
deduplicates within its initiating generation and cannot clear a newer login.

## Server-owned settings

[settings/api.ts](../src/features/settings/api.ts) validates the complete settings
envelope, both seven-field theme palettes and optional logo records. Empty theme
strings remain valid overrides for a future theme adapter. The canonical
[appearance contract](../src/shared/contracts/appearance.ts) is pure vocabulary;
it does not initialize Ant Design or provide theme defaults. Future UI adapters
must import this contract instead of defining another palette shape.

Every language needs a supported code, explicit ltr/rtl direction, explicit
Gregorian/Jalali calendar and nonblank public/native names. Regional codes may
normalize to their registered catalog; direction, calendar and names stay exactly
as the server sent them, even when they differ from code conventions. Missing or
unsupported metadata produces a localized controlled error. There is no browser
language inference, localStorage language preference or static direction table.
Only a super-administrator changes the server's active language.

## Evidence and limits

Owner tests cover wrapper paths/methods/payloads, real Axios requests intercepted
by installed MSW, snake/camel data, multipart bytes, refresh races, malformed
tokens/settings, server language authority and cancellation. Binary dispatch is
also tested through an Axios adapter returning an actual Blob. MSW 3 uses
onUnhandledFrame:error so undeclared network traffic fails. All responses and
credentials are synthetic; no running API or production service is contacted.
This is transport evidence, not browser-cookie, server authorization, full panel
or production integration evidence. Follow [request lifecycle](request-lifecycle.md)
and the unchanged [full validation](../CONTRIBUTING.md).
