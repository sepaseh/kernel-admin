# Authentication and request lifecycles

Use this reference when changing an HTTP adapter, session transition or asynchronous screen. Start with the relevant owner and its tests:

The application composes transport, feature HTTP adapters, settings metadata, guarded requests, providers and authentication forms. Local tests use synthetic responses. Live backend integration requires separate verification.

| Change                                        | Owner                                                             | Regression examples                                                   |
| --------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| Dispatch, refresh, replay or transport errors | [`client.ts`](../src/shared/api/client.ts)                        | [`client.test.ts`](../src/shared/api/client.test.ts)                  |
| Credential lifetime or generation             | [`token.ts`](../src/shared/api/token.ts)                          | [`token.test.ts`](../src/shared/api/token.test.ts)                    |
| Login, registration or logout                 | [Authentication API](../src/features/auth/api.ts)                 | [Authentication tests](../src/features/auth/api.test.ts)              |
| OTP cancellation and cooldown                 | [OTP request hook](../src/features/auth/useOtpRequest.ts)         | [OTP lifecycle](../src/features/auth/useOtpRequest.test.tsx)          |
| Account loading and logout in protected UI    | [Default layout](../src/layouts/default/Default.tsx)              | [Layout lifecycle](../src/layouts/default/Default.test.tsx)           |
| Read cancellation and replacement             | [`useAbortController`](../src/shared/hooks/useAbortController.ts) | [Cancellation tests](../src/shared/hooks/useAbortController.test.tsx) |
| Duplicate submission                          | [`useLock`](../src/shared/hooks/useLock.ts)                       | [Lock tests](../src/shared/hooks/useLock.test.tsx)                    |

Feature HTTP owners consume the configured backend. Database operations, authorization, session revocation and cookie/CORS policy belong to that service. Client presentation checks do not enforce server authorization.

## Backend integration

Developers choose a compatible backend through `VITE_API_BASE_URL`. The local feature `api.ts` and `types.ts` files define this frontend's requests and expected responses; no particular backend implementation, repository, request collection or tooling is required. Adapt this project's HTTP boundary when integrating a service with a different contract.

Use the [settings fixture](../e2e/fixtures.ts), [application HTTP fixtures](../e2e/shared/admin-fixtures.ts) and [consumer contracts](../contract/api.contract.test.ts) for request and response examples. Startup requires a compatible `/settings` response before routes render. Authenticated features require compatible login, refresh and permission behavior. Builds and synthetic tests need no running backend. Verify the chosen service separately when real integration testing is authorized.

## Transport contract

The shared client configures Axios with credentials and explicit cancellation, without a general request timeout. Refresh has a 15-second bound per attempt. The settings API owner also bounds `fetchSettings` reads to 15 seconds while preserving caller cancellation, so initial loading can reach the error and Retry state. Language reads, settings writes and uploads do not inherit that settings-read timeout. [`config.ts`](../src/shared/api/config.ts) reads the public `VITE_API_BASE_URL`, falling back to the browser origin when that value is absent. See [usage](usage.md) for configuration.

Feature adapters pass IDs through the shared [path validator](../src/shared/api/path.ts) before constructing a request URL. It rejects empty IDs and the exact IDs `.` and `..`, which URL normalization would treat as dot segments, with a translated validation error before transport. Other IDs remain opaque and are encoded as one path segment; ordinary dots and literal percent sequences are preserved as identifier data.

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

Bearer credentials stay in memory. A session AbortSignal identifies the authentication generation. Login/token clearing aborts the old session; refreshing a token remains in the existing session.

A protected operation captures its generation synchronously when called. The queued interceptor checks it before dispatch, and the client checks again after fulfillment before returning data. A stale generation is cancelled before it can return data or expire a newer login.

Concurrent attributed protected 401s share one refresh per generation. Each eligible request can replay once after successful same-generation refresh if it has not been cancelled. A cancelled waiter does not cancel another waiter's shared refresh. Refresh retries a network or server failure once after its existing one-second retry interval. Exhausted network, timeout and server failures preserve the current session and propagate an error for a later manual retry without replaying the failed operation. Other refresh failures, including definitive 401/403 rejection or an invalid access-token response, and a current retried 401 expire the current session once.

Public or unattributed failures cannot refresh or clear a login. Network failures, timeouts, 429s and 5xx responses do not automatically replay mutations. The eligible 401 replay is separate from an ordinary network retry.

Login/registration validate a nonblank access token and check both caller cancellation and session identity before installing it, even after transport fulfillment. Authentication screens also reject abandoned navigation/notification results. Logout locking and continuation belong to the default layout. Client cleanup does not prove server-session revocation.

## Read resources

[`useAbortController`](../src/shared/hooks/useAbortController.ts) aborts the previous read on `start()` and cancels on unmount. The owning page/provider keeps loading, data and errors locally and checks `signal.aborted` before applying results or notifications.

Callers use `useCallback`, include every relevant filter/identifier and forward the signal. Cancel obsolete reads on effect cleanup and before accepting replacement data from a save. A client/session guard and a page-owned read guard protect different boundaries.

To connect a feature read:

1. Define a stable loader with `useCallback`. Include every filter or identifier that changes the resource, and forward its `AbortSignal` to the feature API.
2. Start it from the owning effect and return cancellation cleanup. Render its local loading, data, error and retry states.
3. Reuse the loader for explicit retry. Cancel an older read before accepting replacement data from a mutation.

Guard permission-dependent reads before starting them. Keep independent list and lookup resources separate so an optional lookup failure does not erase a usable list. When implementing refresh recovery, preserve accepted data after a failed refresh.

## Mutation guards

The shared [`useLock`](../src/shared/hooks/useLock.ts) supplies synchronous duplicate-submit protection alongside local submitting state. Form submissions also use [`useAbortController`](../src/shared/hooks/useAbortController.ts) and forward their signal through the feature write service. Check cancellation after each awaited step before applying notifications, form changes or navigation, and ignore cancelled errors. The client retains session cancellation and stale-session guards.

Every feature `api.ts` operation accepts an optional `AbortSignal` and forwards it to the HTTP client, including deletes, sorting, calendar writes, logout and file uploads. The signal is the last argument; uploads keep the progress callback before it. Callers own when to cancel an operation.

Cancel a submission immediately when its form closes or its record, action or permission changes. A cancellation-only layout-effect cleanup covers committed scope changes and unmount; loading and denied-action navigation stay in the existing effect. Reset submitting state and the lock when the form scope changes. A cancelled submission's `finally` must not reset or unlock a newer operation. Independent reads and writes that can overlap need separate controllers.

Keep permission-controlled drawers mounted and self-guarded. Their own hash and canonical operation permission control opening, detail reads and submission. In the existing effect, use `useGoBack` for denied actions or missing IDs and ignore sibling hashes.

An admitted authentication form must cancel its OTP request and clear old OTP/cooldown state when the mobile number changes. Its pending-operation guard must bind the intent before asynchronous OTP validation. Enter and button submission must use the same form validation and duplicate-request guard. The current login and registration APIs already guard credential installation after transport fulfillment.

Changing the mobile number also releases the OTP loading state and lock immediately. A cancelled request must not release a replacement request's lock when it eventually settles.

The [user form](../src/features/users/components/user-form/UserForm.tsx) and [password reset](../src/features/users/Users.tsx) must reveal a generated password only after a successful API response and while the initiating login is current. They must display a notification and attempt to copy the value to the clipboard. The notification must still appear if clipboard access fails. The form's navigation and completion callbacks also require the mutation to remain current. Preserve those guards and the owning feature's field validation.

The default layout checks the account before rendering protected children and exposes explicit loading, error and retry states. The API independently enforces administrator safeguards and authorizes each mutation. Cancellation protects client continuation. Server mutations and browser cookie effects can persist after cancellation.

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
