# Testing

Use the [manifest](../validation.json) and [validation policy](../../docs/validation.md). Start with the smallest relevant check, then run the declared full profile on the exact isolated proposed snapshot before an authorized commit, push or handoff. Focused profiles do not replace required checks.

The `core-auth` phase admits unit, jsdom component and governance tests.
Storybook, application browser, visual, Pact and operational suites remain
later-phase requirements; the procedures below apply when their owners are admitted.

Preserve measured coverage, every existing threshold, assertions, stress corpora and declared product-test deadlines. Visual/process-tree commands, their synthetic fixtures and CI evidence requests use actual completion and explicit cancellation without configured wall-clock deadlines. Browser output and static assets do not replace unit/governance LCOV. Do not skip checks, disable accessibility audits or widen tolerances to conceal a failure.

Synchronize asynchronous fixtures on actual state, IPC, stream completion or process closure. Do not add fixed sleeps, polling delays, retry counts or helper deadlines to guess readiness. Reject early errors and premature closure, support explicit cancellation and await owned resource closure before removing files. Keep product-timing assertions on controlled clocks and preserve declared browser and CI execution budgets.

Choose tests for observable behavior: pure helper cases, request/session integration, component interaction, synthetic governance bypass regressions and real application/browser behavior as appropriate. Cover stale/cancelled results, permission boundaries and actual failure paths rather than mirroring implementation details. Use [authentication](../../docs/authentication.md) and [testing](../../docs/testing.md) for fixture ownership.

When a consumer test mocks a feature API or the shared client, mock that boundary completely. Dedicated transport integration tests use owned synthetic MSW fixtures. Never use spy passthrough, a real API, credentials, environments, databases, uploads or another checkout's service as a fixture. Later Storybook toolbar values must remain synthetic metadata, not production language preferences.

Use disposable uniquely owned resources. Cleanup only owned directories, processes, ports and containers, and preserve primary plus cleanup errors. Operational helper imports and synthetic drivers must not launch real infrastructure. Actual provider, Docker, staging or deployment checks require their own authorized target and operation.

Windows visual cleanup captures and refreshes process identities, pins each process handle before identity verification and termination, and issues every verified stop before waiting for exits. Repeated interruption cancels the active helper even after the visual child closes; cleanup ownership remains until the helper actually closes. Preserve captured-orphan, PID-reuse, refresh-conflict, handle-disposal and combined-failure regressions. Measured PowerShell coverage joins the same source-bound artifact as the JavaScript reports without repeating the suite.

Visual comparison keeps runtime provenance, image hashes, tolerances and human approval. Fresh captures remain pending until the user reviews them; updates are forbidden in CI. Record actual failures, optional host skips and unexecuted work honestly. Routine checks do not require a dated QA report or an additional full-suite invocation.
