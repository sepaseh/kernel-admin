# Authentication and request lifecycles

Use this reference when changing an HTTP adapter, session transition or asynchronous screen. Start with the relevant owner and its tests:

The application composes transport, feature HTTP adapters, settings metadata, guarded requests, providers and authentication forms. Local tests use synthetic responses. Live backend integration requires separate verification.

| Change                                        | Owner                                                             | Regression examples                                                    |
| --------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Dispatch, refresh, replay or transport errors | [`client.ts`](../src/shared/api/client.ts)                        | [`client.test.ts`](../src/shared/api/client.test.ts)                   |
| Credential lifetime or generation             | [`token.ts`](../src/shared/api/token.ts)                          | [`token.test.ts`](../src/shared/api/token.test.ts)                     |
| Login, registration or logout                 | [Authentication API](../src/features/auth/api.ts)                 | [Logout lifecycle](../src/features/auth/logout.test.ts)                |
| OTP cancellation and cooldown                 | [OTP request hook](../src/features/auth/useOtpRequest.ts)         | [OTP lifecycle](../src/features/auth/useOtpRequest.test.tsx)           |
| Account loading and logout in protected UI    | [Default layout](../src/layouts/default/Default.tsx)              | [Layout lifecycle](../src/layouts/default/Default.test.tsx)            |
| Read cancellation and replacement             | [`useReadResource`](../src/shared/hooks/useReadResource.ts)       | [Read lifecycles](../src/shared/hooks/useReadResource.test.ts)         |
| Mutation identity and continuation            | [`useMutationRequest`](../src/shared/hooks/useMutationRequest.ts) | [Mutation lifecycles](../src/shared/hooks/useMutationRequest.test.tsx) |

Feature HTTP owners consume the configured backend. Database operations, authorization, session revocation and cookie/CORS policy belong to that service. Client presentation checks do not enforce server authorization.

## Backend integration

Developers choose a compatible backend through `VITE_API_BASE_URL`. The local feature `api.ts` and `types.ts` files define this frontend's requests and expected responses; no particular backend implementation, repository, request collection or tooling is required. Adapt this project's HTTP boundary when integrating a service with a different contract.

Use the [synthetic HTTP handlers](../src/test/mocks/handlers.ts), [settings fixture](../e2e/fixtures.ts), [application HTTP fixtures](../e2e/shared/admin-fixtures.ts) and [consumer contracts](../contract/api.contract.test.ts) for request and response examples. Startup requires a valid `/settings` response before routes render. Authenticated features require compatible login, refresh and permission behavior. Builds and synthetic tests need no running backend. Verify the chosen service separately when real integration testing is authorized.

## Transport contract

The shared client configures Axios with credentials and explicit cancellation, without a general request timeout. Refresh alone has a 15-second bound per attempt. [`config.ts`](../src/shared/api/config.ts) reads the public `VITE_API_BASE_URL`, falling back to the browser origin when that value is absent. See [usage](usage.md) for configuration.

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

Concurrent attributed protected 401s share one refresh per generation. Each eligible request can replay once after successful same-generation refresh if it has not been cancelled. A cancelled waiter does not cancel another waiter's shared refresh. Refresh retries a network or server failure once after its existing one-second retry interval. An exhausted refresh or a current retried 401 expires the current session once.

Public or unattributed failures cannot refresh or clear a login. Network failures, timeouts, 429s and 5xx responses do not automatically replay mutations. The eligible 401 replay is separate from an ordinary network retry.

Login/registration validate a nonblank access token and check both cancellation and generation before installing it, even after transport fulfillment. Logout deduplicates within its initiating generation and cannot clear a newer login. Client cleanup does not prove server-session revocation.

## Read resources

Business screens bind direct effects to their filters, route identifiers and owned AbortControllers. A replacement request or cleanup aborts the previous intent; handlers check cancellation before accepting data or presenting errors. Keep list and optional lookup state independent. Shared filter hooks parse query state and debounce text input without changing the transport contract.

Account and authentication consumers also use the following request hooks:

[`useReadRequest`](../src/shared/hooks/useReadRequest.ts) binds each read intent to a sequence and AbortController. A new read, accepted replacement, resource identity change or unmount invalidates older work, including loaders that ignore their signal. Cancellation settles loading without exposing a failure. A real refresh failure keeps previously accepted data.

[`useReadResource`](../src/shared/hooks/useReadResource.ts) connects that intent to a stable loader and enabled state. Commit-time identity cleanup invalidates the previous resource before passive effects run. Callers use `useCallback`, include every relevant filter/identifier and forward the supplied signal. Retained callbacks from an obsolete identity cannot cancel or replace current work.

To connect a feature read:

1. Define a stable loader with `useCallback`. Include every filter or identifier that changes the resource, and forward its `AbortSignal` to the feature API.
2. Pass the loader and its enabled state to `useReadResource(load, enabled)`. Render its loading, data, error and retry states.
3. Use `reload` for an explicit retry. After an accepted mutation returns replacement data, use `replace` so an older read cannot overwrite that result.

Disabled resources expose no stale data, loading or error. Keep independent list and lookup resources separate so an optional lookup failure does not erase a usable list. The hook's resource identity and the client's authentication generation protect different boundaries; both remain necessary.

## Mutation guards

The shared `useMutationRequest` hook binds work to its identity, enabled state and initiating authentication generation. Its `run` method forwards an owned cancellation signal and returns accepted data with an `isCurrent()` guard. Use that guard before success effects and `isCurrentMutationError` before failure presentation. Unmounting or changing the scope invalidates pending continuation; stale or cancelled work returns no accepted result.

When adding a feature form that uses this hook, connect cancellation and submitting state to the owning form.

An admitted authentication form must cancel its OTP request and clear old OTP/cooldown state when the mobile number changes. Its pending-operation guard must bind the intent before asynchronous OTP validation. Enter and button submission must use the same form validation and duplicate-request guard. The current login and registration APIs already guard credential installation after transport fulfillment.

The [user form](../src/features/users/components/user-form/UserForm.tsx) and [password reset](../src/features/users/Users.tsx) must reveal a generated password only after a successful API response and while the initiating login is current. They must display a notification and attempt to copy the value to the clipboard. The notification must still appear if clipboard access fails. The form's navigation and completion callbacks also require the mutation to remain current. Preserve those separate guards and reuse `profileNameMaxLength` from `src/shared/contracts`.

The default layout checks the account before rendering protected children and exposes explicit loading, error and retry states. The API independently enforces administrator safeguards and authorizes each mutation. Cancellation protects client continuation. Server mutations and browser cookie effects can persist after cancellation.

## Settings and troubleshooting

The settings adapter uses typed settings models without runtime envelope validation. Core preserves accepted settings across refresh failures and replaces older reads when a save succeeds. [Settings adapter](../src/features/settings/api.ts) and [localization](localization.md).

| Symptom                                               | First check                                                                                                                            |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Settings metadata is rejected                         | Confirm the configured API URL, response metadata and exact allowed browser origin. `localhost` and `127.0.0.1` are different origins. |
| A protected request repeatedly returns 401            | Trace its initiating generation, the shared refresh result and the single replay in `client.test.ts`.                                  |
| A request returns 403                                 | Check the API's permission decision and the current account; changing a menu guard cannot grant access.                                |
| A completed request changes the wrong screen or login | Check loader dependencies, mutation identity, signal forwarding and post-fulfillment guards.                                           |

Record a sanitized route template such as `/users/:id`, with query values and user identifiers removed, plus the HTTP status and safe `X-Request-Id`. Exclude credentials and payloads. Document changed HTTP/session expectations at the local integration boundary and use the synthetic fixtures described in [testing](testing.md).
