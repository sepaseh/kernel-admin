# HTTP client and session behavior

[English](api-client.md) · [فارسی](api-client.fa.md)

src/shared/api/client.ts owns Axios configuration, request identity, bounded retries, cancellation and error normalization. token.ts keeps bearer tokens in memory and marks authentication generations. Feature api.ts modules translate snake_case wire DTOs into consumer models. VITE_API_BASE_URL is public build configuration.

Concurrent authenticated 401 responses share one refresh and retry each originating request at most once. A public request failure or unattributed 401 cannot refresh or clear the current login. Logout, refresh and mutations from an old generation cannot mutate a newer session. /languages is authenticated; /settings remains public. Terminal client refresh failure is not server-session revocation.

Read-only transient failures retain rows, expose errors and offer bounded retry. Aborted or stale reads do not overwrite newer state or produce a false empty state. Writes never retry automatically as reads. X-Request-Id connects generic failures to API logs without exposing SDK details.

Use [request reliability](admin-request-reliability.md), [business screen ownership](business-screens.md) and the published client/token/auth/logout and feature tests. End-to-end request-reliability journeys remain part of the later runnable phase.

## Request troubleshooting

Inspect the failing URL, HTTP status and X-Request-Id before changing configuration. Confirm VITE_API_BASE_URL and the API allowed origin match the browser scheme, hostname and port; localhost and 127.0.0.1 are different origins. Restart Vite after changing public build configuration. A repeated protected 401 needs session/account review after the bounded refresh/retry; 403 requires API permission review. For a 409 administrator safeguard, reload current account state and coordinate the intended change with the API owner.
