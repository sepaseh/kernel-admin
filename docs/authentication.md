# Authentication and request lifecycles

Use this reference when changing an HTTP adapter, session transition or asynchronous screen. Start with the relevant owner and its tests:

The application composes transport, feature HTTP adapters, settings metadata, guarded requests, providers and authentication forms. Local tests use synthetic responses. Live backend integration requires separate verification.

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

Feature HTTP owners consume the configured backend. Database operations, authorization, session revocation and cookie/CORS policy belong to that service. Client presentation checks do not enforce server authorization.

## Backend integration

Developers choose a compatible backend through `VITE_API_BASE_URL`. The local feature `api.ts` and `types.ts` files define this frontend's requests and expected responses; no particular backend implementation, repository, request collection or tooling is required. Adapt this project's HTTP boundary when integrating a service with a different contract.

Use the [HTTP transport tests](../src/shared/api/transport.test.ts), [settings fixture](../e2e/fixtures.ts), [application HTTP fixtures](../e2e/shared/admin-fixtures.ts) and [consumer contracts](../contract/api.contract.test.ts) for request and response examples. Startup requires a compatible `/settings` response before routes render. Authenticated features require compatible login, refresh and permission behavior. Builds and synthetic tests need no running backend. Verify the chosen service separately when real integration testing is authorized.

Login accepts `mobile` and `password`. Authentication screens import only their named services, OTP hook and erased request models from the [authentication public index](../src/features/auth/index.ts). Registration and password recovery request an OTP for the current mobile number. The response must contain finite numeric `expiresIn` and nonnegative `remainingSeconds` values. The account API exposes current-user loading and profile updates. Its separate profile and password forms consume the default layout Outlet context; password changes retain their authentication endpoint and request model.

## Transport contract

The shared client configures Axios with credentials and explicit cancellation, without a general request timeout. Refresh has a 15-second bound per attempt. The settings API owner also bounds `fetchSettings` reads to 15 seconds while preserving caller cancellation, so initial loading can reach the error and Retry state. Language reads, settings writes and uploads do not inherit that settings-read timeout. [`config.ts`](../src/shared/api/config.ts) reads the public `VITE_API_BASE_URL`, falling back to the browser origin when that value is absent. See [usage](usage.md) for configuration.

Feature adapters pass IDs through the shared [path validator](../src/shared/api/path.ts) before constructing a request URL. It rejects empty IDs and the exact IDs `.` and `..`, which URL normalization would treat as dot segments, with a `TypeError` before transport. Other IDs remain opaque and are encoded as one path segment; ordinary dots and literal percent sequences are preserved as identifier data.

JSON request keys become snake case and response keys become camel case. FormData and binary payloads keep their identity. Key conversion returns `unknown`; it does not validate a generic DTO. Authentication access tokens receive explicit runtime validation; settings use TypeScript models without runtime envelope validation.

`AdminApiError` preserves the HTTP status, a nonempty API message and its structured cause when supplied. Other failures use translated timeout, network or unexpected-error text. Only bounded safe request IDs are retained. Cancellation remains an Axios cancellation. Keep credentials and request payloads out of diagnostics.

The client's request classification determines refresh behavior:

| Request                                                      | Session behavior                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `GET` or `HEAD` of `/settings`                               | Public read; no authentication-generation attribution. Its failure cannot refresh or expire the current login.                       |
| Authentication endpoints in `publicAuthUrls`                 | A 401 cannot start the protected-request refresh flow. Login and registration separately validate and guard credential installation. |
| Settings writes, `/languages` and other protected operations | Capture the initiating generation and participate in the eligible protected-401 flow.                                                |

The classification is defined in `client.ts`. Public settings reads may still carry an existing bearer header; public status does not imply that the client strips credentials.

## Session generations

Bearer credentials stay in memory. Login/logout starts a new authentication generation; refreshing a token remains in the existing generation.

A protected operation captures its generation synchronously when called. The queued interceptor checks it before dispatch, and the client checks again after fulfillment before returning data. A stale generation is cancelled before it can return data or expire a newer login.

Concurrent attributed protected 401s share one refresh per generation. Each eligible request can replay once after successful same-generation refresh if it has not been cancelled. A cancelled waiter does not cancel another waiter's shared refresh. Refresh retries a network or server failure once after its existing one-second retry interval. Exhausted network, timeout and server failures preserve the current session and propagate an error for a later manual retry without replaying the failed operation. Other refresh failures, including definitive 401/403 rejection or an invalid access-token response, and a current retried 401 expire the current session once.

Public or unattributed failures cannot refresh or clear a login. Network failures, timeouts, 429s and 5xx responses do not automatically replay mutations. The eligible 401 replay is separate from an ordinary network retry.

Login/registration validate a nonblank access token and check both cancellation and generation before installing it, even after transport fulfillment. Logout deduplicates within its initiating generation and cannot clear a newer login. Client cleanup does not prove server-session revocation.

## Read resources

Screens and layouts own their read state and direct effects. Bind each read to every filter, route identifier and permission that changes its meaning. Forward an owned AbortSignal to the feature API and cancel the request when that scope changes or its owner unmounts. Check cancellation before accepting data or presenting failures, including when a mocked or custom loader ignores its signal. Shared filter hooks parse query state and debounce text input without changing the transport contract.

Use [`useAbortController`](../src/shared/hooks/useAbortController.ts) where the owning request workflow needs a replaceable controller: `start()` aborts its previous request, and `cancel()` invalidates pending work. Keep independent list and optional lookup loading, error and retry state separate. A failed optional lookup must not erase a usable list. Preserve accepted data on a refresh failure and expose an explicit retry; cancellation does not create a user-visible failure.

The [default layout](../src/layouts/default/Default.tsx) owns current-user loading. It waits for the initial accepted user before rendering protected children and exposes that user, an awaited reload and local session cleanup through [`DefaultLayoutContext`](../src/layouts/default/types.ts). During a refresh, it keeps the Outlet mounted so child form state survives. Refresh failures retain accepted identity and show retry feedback; initial failures also offer logout. The layout checks its mounted state, request cancellation and initiating authentication generation before accepting data or handling a failure. Core owns settings and appearance preferences.

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

| Symptom                                               | First check                                                                                                                            |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Settings metadata is rejected                         | Confirm the configured API URL, response metadata and exact allowed browser origin. `localhost` and `127.0.0.1` are different origins. |
| A protected request repeatedly returns 401            | Trace its initiating generation, the shared refresh result and the single replay in `client.test.ts`.                                  |
| A request returns 403                                 | Check the API's permission decision and the current account; changing a menu guard cannot grant access.                                |
| A completed request changes the wrong screen or login | Check loader dependencies, mutation identity, signal forwarding and post-fulfillment guards.                                           |

Record a sanitized route template such as `/users/:id`, with query values and user identifiers removed, plus the HTTP status and safe `X-Request-Id`. Exclude credentials and payloads. Document changed HTTP/session expectations at the local integration boundary and use the synthetic fixtures described in [testing](testing.md).
