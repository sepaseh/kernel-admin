# Read request lifecycle

[English](request-lifecycle.md) · [فارسی](request-lifecycle.fa.md)

[useReadRequest](../src/shared/hooks/useReadRequest.ts) owns one read intent with
a sequence number and AbortController. Starting another read, replacing accepted
data, changing the resource identity or unmounting invalidates older work. An
obsolete response cannot overwrite current data even when a loader ignores its
AbortSignal. Cancellation settles loading without exposing an error; a real
refresh failure preserves previously accepted data.

[useReadResource](../src/shared/hooks/useReadResource.ts) binds that primitive to
the load function's identity and enabled state. A layout-effect cleanup invalidates
the previous read when the identity commits, before passive cleanup can run;
the new fetch still starts in a passive effect. Retained reload/replace callbacks
from an obsolete committed identity cannot cancel or replace current work.
Callers must keep
the loader stable with useCallback and include every relevant filter/identifier in
its dependency list. Forward the supplied signal to the feature HTTP read.
reload retries the current resource; replace accepts mutation data and invalidates
an older read. Disabled resources expose no stale data/error/loading state.

Real React renderHook tests run in an isolated jsdom environment, including
StrictMode effect replay, filter changes, retained callbacks, the real concurrent
commit/passive boundary, cancellation, unmount, replacement and late failures.
HTTP/session tests separately cover account generation guards.
These are hook and synthetic transport checks; they do not start a browser or
publish React screens. The [HTTP client](http-client.md) owns transport errors and
authentication, while feature modules own paths and DTO vocabulary. Keep these
responsibilities independent of future components and providers.
