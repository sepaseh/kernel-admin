# Authentication and request lifecycles

Use this reference when changing an HTTP adapter, session transition or asynchronous screen. Start with the relevant owner and its tests:

| Change                                        | Owner                                                             | Regression examples                                                    |
| --------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Dispatch, refresh, replay or transport errors | [`client.ts`](../src/shared/api/client.ts)                        | [`client.test.ts`](../src/shared/api/client.test.ts)                   |
| Credential lifetime or generation             | [`token.ts`](../src/shared/api/token.ts)                          | [`token.test.ts`](../src/shared/api/token.test.ts)                     |
| Login, registration or logout                 | [Authentication API](../src/features/auth/api.ts)                 | [Logout lifecycle](../src/features/auth/logout.test.ts)                |
| Read cancellation and replacement             | [`useReadResource`](../src/shared/hooks/useReadResource.ts)       | [Read lifecycles](../src/shared/hooks/useReadResource.test.ts)         |
| Mutation identity and continuation            | [`useMutationRequest`](../src/shared/hooks/useMutationRequest.ts) | [Mutation lifecycles](../src/shared/hooks/useMutationRequest.test.tsx) |

Feature HTTP owners consume the configured backend. Database operations, authorization, session revocation and cookie/CORS policy belong to that service. Client presentation checks do not enforce server authorization.

## Backend integration

Developers choose a compatible backend through `VITE_API_BASE_URL`. The local feature `api.ts` and `types.ts` files define this frontend's requests and expected responses; no particular backend implementation, repository, request collection or tooling is required. Adapt this project's HTTP boundary when integrating a service with a different contract.

Use the [synthetic settings response](../e2e/fixtures.ts), [application HTTP handlers](../e2e/shared/admin-fixtures.ts) and [consumer request/response examples](../contract/api.contract.test.ts) as local integration references. They cover the current consumer expectations and remain fixtures, not real accounts or services. Initial startup needs a valid `/settings` response before routes render; authenticated features also require compatible login, refresh and permission behavior. Builds and synthetic checks need no running backend. Verify a chosen service separately when real integration testing is authorized.

## Transport contract

The shared client configures Axios with credentials, a 15-second timeout and explicit cancellation. [`config.ts`](../src/shared/api/config.ts) reads the public `VITE_API_BASE_URL`, falling back to the browser origin when that value is absent. See [usage](usage.md) for configuration.

JSON request keys become snake case and response keys become camel case. FormData and binary payloads keep their identity. Key conversion returns `unknown`; it does not validate a generic DTO. Authentication replies and application settings receive explicit runtime validation before changing session or application state.

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

Concurrent attributed protected 401s share one refresh per generation. Each eligible request can replay once after successful same-generation refresh if it has not been cancelled. A cancelled waiter does not cancel another waiter's shared refresh. Transient or malformed refresh failures remain retryable; definitive refresh 401/403 or a current retried 401 expires the current session once.

Public or unattributed failures cannot refresh or clear a login. Network failures, timeouts, 429s and 5xx responses do not automatically replay mutations. The eligible 401 replay is separate from an ordinary network retry.

Login/registration validate a nonblank access token and check both cancellation and generation before installing it, even after transport fulfillment. Logout deduplicates within its initiating generation and cannot clear a newer login. Client cleanup does not prove server-session revocation.

## Read resources

[`useReadRequest`](../src/shared/hooks/useReadRequest.ts) binds each read intent to a sequence and AbortController. A new read, accepted replacement, resource identity change or unmount invalidates older work, including loaders that ignore their signal. Cancellation settles loading without exposing a failure. A real refresh failure keeps previously accepted data.

[`useReadResource`](../src/shared/hooks/useReadResource.ts) connects that intent to a stable loader and enabled state. Commit-time identity cleanup invalidates the previous resource before passive effects run. Callers use `useCallback`, include every relevant filter/identifier and forward the supplied signal. Retained callbacks from an obsolete identity cannot cancel or replace current work.

To connect a feature read:

1. Define a stable loader with `useCallback`. Include every filter or identifier that changes the resource, and forward its `AbortSignal` to the feature API.
2. Pass the loader and its enabled state to `useReadResource(load, enabled)`. Render its loading, data, error and retry states.
3. Use `reload` for an explicit retry. After an accepted mutation returns replacement data, use `replace` so an older read cannot overwrite that result.

Disabled resources expose no stale data, loading or error. Keep independent list and lookup resources separate so an optional lookup failure does not erase a usable list. The hook's resource identity and the client's authentication generation protect different boundaries; both remain necessary.

## Forms and privileged screens

Forms own cancellation and submitting state. The shared mutation hook binds work to its identity, enabled state and initiating authentication generation. Check the returned `isCurrent()` before success effects and use `isCurrentMutationError` before showing a failure. Unmounting or changing that scope invalidates pending continuation.

Changing a mobile number cancels its OTP request and clears old OTP/cooldown state. A pending-operation guard binds the intent before asynchronous OTP validation. Enter and button submission use the same form validation and duplicate-request guard. Login and registration also guard credential installation after transport fulfillment.

The [user form](../src/features/users/components/user-form/UserForm.tsx) and [password reset](../src/features/users/Users.tsx) reveal a generated password only after a successful API response and while the initiating login is current. They display a notification and attempt to copy the value to the clipboard; clipboard failure does not prevent the notification. The form's navigation and completion callbacks also require the mutation to remain current. Preserve those separate guards and reuse `profileNameMaxLength` from `src/shared/contracts` rather than inventing another limit.

The default layout checks the account before rendering protected children and retains explicit loading/error/retry states. The API independently enforces administrator safeguards and every mutation. Cancellation protects client continuation; it cannot undo a server mutation or a browser cookie side effect.

## Settings and troubleshooting

The [settings adapter](../src/features/settings/api.ts) validates the complete envelope, the required palette fields, optional logos and complete language metadata. Core preserves accepted settings across refresh failures and replaces older reads when a save succeeds. Language authority is described in [localization](localization.md).

| Symptom                                               | First check                                                                                                                            |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Settings fail before routes appear                    | Confirm the configured API URL, response metadata and exact allowed browser origin. `localhost` and `127.0.0.1` are different origins. |
| A protected request repeatedly returns 401            | Trace its initiating generation, the shared refresh result and the single replay in `client.test.ts`.                                  |
| A request returns 403                                 | Check the API's permission decision and the current account; changing a menu guard cannot grant access.                                |
| A completed request changes the wrong screen or login | Check loader dependencies, mutation identity, signal forwarding and post-fulfillment guards.                                           |

Record the URL, HTTP status and safe `X-Request-Id`, without credentials or payloads. Document changed HTTP/session expectations at the local integration boundary and use the synthetic fixtures described in [testing](testing.md).
