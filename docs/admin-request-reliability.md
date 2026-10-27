# Admin request reliability

[English](admin-request-reliability.md) · [فارسی](admin-request-reliability.fa.md)

Scope updated: 27 October 2026. The non-runnable `core-auth` phase publishes
feature-owned HTTP adapters, request hooks, Core/Ant Design providers,
authentication forms and layout modules. `applicationReady` remains false: no
application entry point, App/Routes composition, business-page tables, build or
browser journey is published. Small read hooks coordinate request lifetime; no
query library, frontend database access or business-service duplication is introduced.

## Deadlines and retries

- Ordinary Axios requests and the separate cookie-based refresh request default
  to **15 seconds per attempt**. File uploads explicitly allow **60 seconds**.
  These are individual request deadlines, not a 15-second budget for an entire
  request/refresh/replay sequence. New longer operations need a deliberate policy.
- A protected **401** with its original dispatch generation retains the existing
  single refresh/single replay behavior within the same login session. Public
  authentication and public settings failures do not refresh. A 401 without its
  request config or originating generation is normalized without refreshing or
  expiring the current login; current credentials cannot establish its owner.
  There is no automatic replay for network failures, timeouts, 429 or 5xx.
- Concurrent readers within one session share one refresh. A cancelled reader
  stops waiting without cancelling another reader's refresh. A newer login has
  its own refresh entry and cannot inherit an older generation's failed refresh.
- A temporary refresh failure remains retryable; a current-session refresh
  401/403 rejection or a second 401 expires the local session. The session layout hides
  protected children while checking the account or displaying a transient error.
- Timeout, HTTP and network failures retain useful messages. HTTP errors preserve
  their status, validation cause and valid request ID. Intentional cancellation
  does not produce a feature error toast.

## Read ownership and visible states

`shared/hooks/useReadResource.ts` owns an automatic read and explicit `reload`.
Pass a stable loader (an imported function, or `useCallback` for filter-dependent
arguments) accepting `AbortSignal`. `useReadRequest.ts` supports event-driven
detail reads. Both abort obsolete work and guard commits by request sequence and
mount state, including adapters that ignore aborts. Explicit cancellation settles
the busy state even when no replacement request starts.

The published Core settings and default-layout account checks use these hooks.
A changed loader discards its predecessor's data; reloading the same resource
retains its last successful result. Synthetic loader tests cover reverse-order
completion, obsolete work, unmount and development StrictMode cleanup. Users,
roles, calendar and settings business screens are later work; their published
HTTP adapters alone are not page integration evidence.

`shared/ui/request-feedback` distinguishes an initial failure from a refresh
failure and offers retry. Core settings errors and account-check errors have
visible feedback. The default layout hides protected children during its account
check or a transient error. Later business screens must distinguish failed reads
from successful empty results and preserve accepted data after a refresh failure.
Mutation errors remain feature-owned; these requirements do not claim that the
unpublished business forms or tables have been tested.

Core exposes `acceptSettings`: replacing its read snapshot invalidates older
initial work before applying accepted language, logos and palettes. Its initial
failure is visible with retry. A future settings editor must supply accepted,
validated data and preserve this behavior; no settings page is published here.
Only theme/compact preferences are browser-persisted. Active language, direction,
calendar and names remain API-owned, with fixed Persian bootstrap until accepted
settings arrive; there is no visitor language selector.

## Login generation and logout

The in-memory credential store tracks a stable login/logout generation. Refresh
installs a validated returned token without advancing that generation. This
client behavior does not prove API session storage, revocation or token rotation.
Session-bound requests capture
the generation when dispatched, check it again before a 401 replay, and reject
obsolete success/error responses as cancellation. An old un-signalled mutation
cannot be replayed with a newly logged-in account's bearer token or return an old
profile into the new frontend session. Only public **GET/HEAD /settings** reads
are exempt; `/languages` requires authentication and is generation-bound, as is
`PUT /settings`. Authentication responses
are also generation-bound so an obsolete login cannot replace newer credentials.
`login`, `register`, `forgotPassword` and `requestOtp` accept an optional
`AbortSignal` without changing their request payloads. Login and registration
check cancellation again before installing the validated token, including when
an adapter completes after abort. Forms cancel superseded/unmounted work and
ignore obsolete results.

Logout coalesces concurrent calls within its initiating generation and clears
only that generation. The layout prevents duplicate logout clicks and ignores
completion after unmount or a newer non-null login token. Its cleanup remains
compatible with a legitimate logout clearing the token itself.

These guards protect frontend state and request replay. Cancellation cannot undo
an already committed server mutation or browser cookie side effect. API-side
authentication, authorization, transaction and session-revocation rules remain
authoritative and require separate API verification.

A terminal client refresh failure expires local in-memory credentials and the
admin UI session only; it does not itself revoke server sessions. Server-side
password change/recovery revocation and explicit logout remain API-owned.

## Historical post-baseline correction — 24 October 2026

The historical comprehension smoke evaluation identified two client branches:
authenticated `/languages` reads had been incorrectly exempted from generation
stamping, and configless/versionless 401 responses inferred the current generation.
Both are corrected after that baseline. Such 401 errors no longer refresh or clear
an unrelated login, including public settings failures. Focused regressions cover
the delayed old languages response, missing config/stamp, repeated unstamped 401
and public settings 401. Existing same-generation refresh, single replay, terminal
expiry and cancellation coverage remains.

## Verification and isolated checks

Published tests use synthetic loaders, Core/layout/form fixtures and Axios/MSW
to cover obsolete completion, cleanup/refetch, cancel-without-replacement, stale
settings versus an accepted snapshot, StrictMode, initial-error retry, retained
data after failed refresh, timeout recovery, shared refresh, login generations,
auth abort and logout. They require no owner data or running service. The
historical correction above is context, not a fresh full-application report.

Use the [canonical manifest](../.agents/validation.json) and run
`npm run validate -- full` on the isolated exact proposed snapshot before an
authorized commit or PR handoff. All nine required checks remain mandatory.
Vitest disables environment-file discovery and uses explicit synthetic values;
do not read private state or reuse a developer API, credentials or production data.
Production build, browser, accessibility, performance and visual evidence belong
to the later runnable gate. See [publication policy](bootstrap.md),
[HTTP ownership](http-client.md), [request lifecycle](request-lifecycle.md) and
[Core/auth ownership](core-auth.md).
