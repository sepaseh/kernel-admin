# Admin request reliability

[English](admin-request-reliability.md) · [فارسی](admin-request-reliability.fa.md)

Scope updated: 27 October 2026. The non-runnable `storybook-verification` phase publishes
feature-owned HTTP adapters, request hooks, Core/Ant Design providers,
authentication forms, business screens, layout modules and an isolated Storybook
workshop with real Chromium component interactions and accessibility checks.
`applicationReady` remains false: no application entry point, assembled App/Routes,
production application build, complete application E2E journey or visual gate is
published. Small read hooks coordinate request lifetime; no
query library, frontend database access or business-service duplication is introduced.

## Deadlines and retries

- Ordinary Axios requests and the separate cookie-based refresh request default
  to **15 seconds per attempt**. File uploads explicitly allow **60 seconds**.
  These are individual request deadlines, not a 15-second budget for an entire
  request/refresh/replay sequence. New longer operations need a deliberate policy.
- A protected **401** with its original dispatch generation retains the existing
  single refresh/single replay behavior within the same login session, including
  eligible writes that have not been cancelled. Public authentication and public
  GET/HEAD /settings failures do not refresh; PUT /settings is protected. A 401
  without its request config or originating generation is normalized without refreshing or
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
roles, calendar and settings modules now consume these guarded reads; their real
React/jsdom tests remain distinct from production API/browser integration.

`shared/ui/request-feedback` distinguishes an initial failure from a refresh
failure and offers retry. Core settings errors and account-check errors have
visible feedback. The default layout hides protected children during its account
check or a transient error. Business screens distinguish failed reads
from successful empty results and preserve accepted data after a refresh failure.
Mutation errors remain feature-owned. The shared mutation lifecycle and its
record/session/permission guards are described in [business screens](business-screens.md).

Core exposes `acceptSettings`: replacing its read snapshot invalidates older
initial work before applying accepted language, logos and palettes. Its initial
failure is visible with retry. The settings editor supplies accepted,
validated data and preserves this behavior.
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

For user creation and password reset, a successful API acknowledgement retains
the generated password for an app-level notification within the initiating login
generation. Consumer unmount, scope changes or cancellation do not discard this
acknowledged password. A changed login generation suppresses the notification;
normal obsolete form state, navigation and errors remain guarded. If the HTTP
response is aborted or rejected, the server outcome is unknown and no confirmed
password-change success is announced.

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

Published unit tests use synthetic loaders, Core/layout/form fixtures and Axios/MSW
to cover obsolete completion, cleanup/refetch, cancel-without-replacement, stale
settings versus an accepted snapshot, StrictMode, initial-error retry, retained
data after failed refresh, timeout recovery, shared refresh, login generations,
auth abort and logout. They require no owner data or running service. The
historical correction above is context, not a fresh full-application report.
The separate [Storybook project](storybook-verification.md) fully replaces feature
API owners and the shared HTTP client with synthetic mocks. Its real Chromium
stories execute component play assertions and fail on accessibility violations;
they do not establish an external API or complete application journey.

Use the [canonical manifest](../.agents/validation.json) and run
`npm run validate -- full` on the isolated exact proposed snapshot before an
authorized commit or PR handoff. All eleven required checks remain mandatory,
including the genuine static Storybook build and Chromium story tests. Run
`npm run browser:install` after `npm ci` and before the canonical full command.
Vitest disables environment-file discovery and uses explicit synthetic values;
do not read private state or reuse a developer API, credentials or production data.
Production application build, complete application E2E, field performance and visual
evidence belong to the later runnable gate with all nineteen genuine application
checks. See [publication policy](bootstrap.md),
[HTTP ownership](http-client.md), [request lifecycle](request-lifecycle.md) and
[Core/auth ownership](core-auth.md).
