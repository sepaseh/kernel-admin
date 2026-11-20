# Authentication and request lifecycles

Use this reference when changing an HTTP adapter, session transition or asynchronous screen. The owner and regression examples for each change are listed below.

| Change                                        | Owner                                                                              | Regression examples                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Dispatch, refresh, replay or transport errors | [`client.ts`](../src/shared/api/client.ts)                                         | [`client.test.ts`](../src/shared/api/client.test.ts)                                          |
| Credential lifetime or generation             | [`token.ts`](../src/shared/api/token.ts)                                           | [`token.test.ts`](../src/shared/api/token.test.ts)                                            |
| Login, registration or logout                 | [Authentication API](../src/features/auth/api.ts)                                  | [Logout lifecycle](../src/features/auth/logout.test.ts)                                       |
| OTP cancellation and cooldown                 | [OTP request hook](../src/features/auth/useOtpRequest.ts)                          | [OTP lifecycle](../src/features/auth/useOtpRequest.test.tsx)                                  |
| Account loading and logout in protected UI    | [Default layout](../src/layouts/default/Default.tsx)                               | [Layout lifecycle](../src/layouts/default/Default.test.tsx)                                   |
| Read cancellation and replacement             | [Calendar screen](../src/features/calendar/Calendar.tsx)                           | [Calendar lifecycles](../src/features/calendar/Calendar.test.tsx)                             |
| Profile mutation and refresh                  | [Profile form](../src/features/account/components/profile-form/ProfileForm.tsx)    | [Profile lifecycles](../src/features/account/components/profile-form/ProfileForm.test.tsx)    |
| Password mutation and session cleanup         | [Password form](../src/features/account/components/password-form/PasswordForm.tsx) | [Password lifecycles](../src/features/account/components/password-form/PasswordForm.test.tsx) |

The backend owns database operations, authorization, session revocation and cookie and CORS policy. The frontend uses account permissions to decide which routes and controls to present. The API authorizes each operation independently.

## Backend integration

Select a compatible backend through `VITE_API_BASE_URL`. Local feature `api.ts` and `types.ts` files define the requests and expected responses. Adapt those owners when integrating a service with a different contract. [Public configuration](usage.md#application-configuration-reference)

Startup requires a compatible `GET /settings` response before routes render. For a signed-in session, the authentication endpoints supply credentials and `GET /account/me` supplies the current user and permissions. Use the transport, consumer-contract and browser fixtures for synthetic request and response examples. Verify the chosen service separately against those expectations. [HTTP transport tests](../src/shared/api/transport.test.ts) · [Settings fixture](../e2e/fixtures.ts) · [Application HTTP fixtures](../e2e/shared/admin-fixtures.ts) · [Consumer contracts](../contract/api.contract.test.ts)

Paginated list adapters, including the [users list adapter](../src/features/users/api.ts), send only the page number and their declared filters. The backend owns the fixed page size of 24; adapters omit `size` from HTTP requests, query inputs and URL filters. Select declared request fields explicitly so an extra `size` URL parameter cannot reach the API. Tables use `defaultPageSize` from [shared configuration](../src/shared/config/constants.ts), also 24, for pagination and row numbering.

## Transport contract

The shared client configures Axios with credentials and explicit cancellation, without a general request timeout. Refresh has a 15-second bound per attempt. The settings API owner also bounds `fetchSettings` reads to 15 seconds while preserving caller cancellation, so initial loading can reach the error and Retry state. Language reads, settings writes and uploads do not inherit that settings-read timeout. [`config.ts`](../src/shared/api/config.ts) reads the public `VITE_API_BASE_URL`, falling back to the browser origin when that value is absent. See [usage](usage.md) for configuration.

Feature adapters pass IDs through the shared [path validator](../src/shared/api/path.ts) before constructing a request URL. It rejects empty IDs and the exact IDs `.` and `..`, which URL normalization would treat as dot segments, with a `TypeError` before transport. Other IDs remain opaque and are encoded as one path segment; ordinary dots and literal percent sequences are preserved as identifier data.

JSON request keys become snake case and response keys become camel case. FormData and binary payloads keep their identity. Key conversion returns `unknown`; it does not validate a generic DTO. Authentication access tokens receive explicit runtime validation; settings use TypeScript models without runtime envelope validation.

`AdminApiError` preserves the HTTP status, a nonempty API message and its structured cause when supplied. Other failures use translated timeout, network or unexpected-error text. Only bounded safe request IDs are retained. Cancellation remains an Axios cancellation. Keep credentials and request payloads out of diagnostics.

The client uses the request method and path to decide which operations can refresh the session.

| Request                                                      | Session behavior                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `GET` or `HEAD` of `/settings`                               | Public read; no authentication-generation attribution. Its failure cannot refresh or expire the current login.                       |
| Authentication endpoints in `publicAuthUrls`                 | A 401 cannot start the protected-request refresh flow. Login and registration separately validate and guard credential installation. |
| Settings writes, `/languages` and other protected operations | Capture the initiating generation and participate in the eligible protected-401 flow.                                                |

The classification is defined in `client.ts`. Public settings reads may still carry an existing bearer header; public status does not imply that the client strips credentials.

## Session generations

Bearer credentials stay in memory. Signing in or clearing the token advances the authentication generation and aborts requests bound to the old generation. Refreshing replaces the token in the current generation. On a protected page, an initial `GET /account/me` that returns 401 can refresh the session through the backend cookie, even after a page reload has cleared memory. [Token handling](../src/shared/api/token.ts) · [Refresh handling](../src/shared/api/refresh.ts)

A protected operation captures its generation synchronously when called. The queued interceptor checks it before dispatch, and the client checks again after fulfillment before returning data. A stale generation is cancelled before it can return data or expire a newer login.

Concurrent protected 401s share one refresh per generation. A delayed 401 joins an active refresh or reuses the newer token if refresh already completed. Each eligible request can replay once while its caller and session generation are active. Cancelling a caller releases that caller and lets the shared refresh continue for other requests. [Replay tests](../src/shared/api/client.test.ts)

Refresh retries a network, timeout or server failure once after one second. If that retry fails with a transient error, the client preserves the session and reports the error for a later manual retry. Definitive rejection, an invalid refresh token response or a 401 after replay clears the current session. A 403 from `GET /account/me` also ends the current session. Other protected 403 responses report the operation's authorization failure. [Session handling](../src/shared/api/client.ts) · [Refresh handling](../src/shared/api/refresh.ts)

Public or unattributed failures cannot refresh or clear a login. Network failures, timeouts, 429s and 5xx responses do not automatically replay mutations. The eligible 401 replay is separate from an ordinary network retry.

Login and registration validate a nonblank access token and check cancellation and generation after transport completes. Logout shares one request within its initiating generation and clears that generation locally when the request settles. Server-session revocation depends on the backend's response and cookie handling. [Authentication adapter](../src/features/auth/api.ts) · [Logout tests](../src/features/auth/logout.test.ts)

## Read resources

Screens and layouts own their read state and direct effects. Bind each read to every filter, route identifier and permission that changes its meaning. Forward an owned AbortSignal to the feature API and cancel the request when that scope changes or its owner unmounts. Check cancellation before accepting data or presenting failures, including when a mocked or custom loader ignores its signal. Shared filter hooks parse query state and debounce text input without changing the transport contract.

Use [`useAbortController`](../src/shared/hooks/useAbortController.ts) where the owning request workflow needs a replaceable controller: `start()` aborts its previous request, and `cancel()` invalidates pending work. Keep independent list and optional lookup loading, error and retry state separate. A failed optional lookup must not erase a usable list. Preserve accepted data on a refresh failure and expose an explicit retry; cancellation does not create a user-visible failure.

The default layout owns current-user loading. It waits for the initial accepted user before rendering protected children and exposes that user, an awaitable reload and local session cleanup through its outlet context. Initial and subsequent retryable failures use the [shared error fallback](../src/shared/ui/error-boundary/ErrorFallback.tsx) with a request-specific title and a retry action that reloads the current user. Subsequent failures keep the outlet and accepted identity visible. Session expiration clears the protected state and returns to sign-in. The layout checks its mounted state, request cancellation and initiating generation before accepting data or handling a failure. [Default layout](../src/layouts/default/Default.tsx) · [Outlet context](../src/layouts/default/types.ts)

## Mutation guards

Feature `api.ts` operations accept an optional `AbortSignal` as the last argument and forward it to the HTTP client. Uploads keep the progress callback before the signal. Callers own cancellation.

Put asynchronous submit work directly in the owning form's typed submit handler. Use [`useLock`](../src/shared/hooks/useLock.ts) for synchronous duplicate-submit protection alongside submitting state, and own cancellation with `useAbortController`. Enter and button submission must use the same validation and lock. Abort abandoned requests and ignore cancellation errors. A stale completion must not unlock or reset a replacement operation.

The transport rejects a protected operation after its initiating authentication generation changes, including after HTTP fulfillment. Login and registration also check the caller's signal and initiating generation before installing validated credentials. Account forms capture their generation and check it before submission and after each request, before feedback, form resets or session cleanup. Changing the current account or generation cancels the old form scope and releases the new scope for submission. Keep these consumer guards when mocking an API boundary, because a mock can ignore transport cancellation.

The [profile form](../src/features/account/components/profile-form/ProfileForm.tsx) submits first and last names, retaining the shared profile-name length limit. A successful profile PATCH warrants `profileUpdated` feedback even if the subsequent current-user GET fails; the layout owns refresh failure feedback and retains its accepted user. The [password form](../src/features/account/components/password-form/PasswordForm.tsx) validates confirmation, submits the current and new passwords, then resets the form and clears the session only while that operation remains current. Login displays the optional logo selected from current settings by the browser theme.

The OTP request hook binds intent before asynchronous mobile validation. Changing the mobile number cancels its pending request, clears old OTP and cooldown state, and releases loading and its lock immediately. An older cancelled request cannot set a cooldown or unlock a replacement request when it settles. Registration requires first and last names without imposing a client-side length ceiling.

The [user form](../src/features/users/components/user-form/UserForm.tsx) and [password reset](../src/features/users/Users.tsx) must reveal a generated password only after a successful API response and while the initiating login is current. They must display a notification and attempt to copy the value to the clipboard. The notification must still appear if clipboard access fails. The form's navigation and completion callbacks also require the mutation to remain current. Preserve those separate guards and the owning feature's field validation.

The API independently enforces administrator safeguards and authorizes each mutation. Cancellation protects client continuation. Server mutations and browser cookie effects can persist after cancellation.

## Settings and troubleshooting

The settings adapter returns typed API responses without runtime envelope validation. Core preserves accepted settings across refresh failures and replaces older reads when a save succeeds. [Settings adapter](../src/features/settings/api.ts) and [localization](localization.md).

The settings form tracks light and dark logo operations independently through the image control's `onLoadingChange` callback. Decoding, cropping and uploading keep Submit and Reset unavailable, and the submit handler checks pending logo work before acquiring its save lock. Crop confirmation and cancellation remain available. Saving resumes after both controls finish and uses their accepted logo identifiers.

| Symptom                                               | First check                                                                                                                        |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Settings cannot load or the UI fails to render        | Check the API base URL, response shape and exact allowed browser origin. See [runtime metadata](localization.md#runtime-metadata). |
| A protected request repeatedly returns 401            | Trace its initiating generation, the shared refresh result and the single replay in `client.test.ts`.                              |
| A request returns 403                                 | Check the API's permission decision and the current account; changing a menu guard cannot grant access.                            |
| A completed request changes the wrong screen or login | Check loader dependencies, mutation identity, signal forwarding and post-fulfillment guards.                                       |

Record a sanitized route template such as `/users/:id`, with query values and user identifiers removed, plus the HTTP status and safe `X-Request-Id`. Exclude credentials and payloads. Document changed HTTP/session expectations at the local integration boundary and use the synthetic fixtures described in [testing](testing.md).
