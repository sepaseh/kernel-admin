# Testing

Use the [manifest](../validation.json) and [validation policy](../../docs/validation.md). Start with the smallest relevant check, then run the declared full profile on the exact isolated proposed snapshot before an authorized commit, push or handoff. Focused profiles do not replace required checks.

The admitted application includes unit, jsdom component, governance, Storybook,
application browser, visual, Pact and operational suites; select their commands
from the manifest.

Preserve measured coverage, assertions, stress corpora and declared product-test deadlines. Numerical metrics are advisory under [code quality](code-quality.md); execution, assertion, type/lint and security failures remain required evidence. Visual/process-tree commands, their synthetic fixtures and CI evidence requests use actual completion and explicit cancellation without configured wall-clock deadlines. Browser output and static assets do not replace unit/governance LCOV. Do not skip checks, disable unrelated accessibility rules or widen tolerances to conceal a failure. When the owner explicitly withdraws a product requirement, update only its corresponding assertions and the documented [test scope](../../docs/testing.md#review-appearance); retain the remaining audits and report that decision.

Synchronize asynchronous fixtures on actual state, IPC, stream completion or process closure. Do not add fixed sleeps, polling delays, retry counts or helper deadlines to guess readiness. Reject early errors and premature closure, support explicit cancellation and await owned resource closure before removing files. Keep product-timing assertions on controlled clocks and preserve declared browser and CI execution budgets.

Choose tests for observable behavior: pure helper cases, request/session integration, component interaction, synthetic governance bypass regressions and real application/browser behavior as appropriate. Cover stale/cancelled results, permission boundaries and actual failure paths rather than mirroring implementation details. Use [authentication](../../docs/authentication.md) and [testing](../../docs/testing.md) for fixture ownership.

When a consumer test mocks a feature API or the shared client, mock that boundary completely. Dedicated transport integration tests use owned synthetic fixtures. Never use spy passthrough, a real API, credentials, environments, databases, uploads or another checkout's service as a fixture. Storybook toolbar values must remain synthetic metadata, not production language preferences. Keep `*.stories.tsx` beside the source owner under `src/`.

Use disposable uniquely owned resources. Cleanup only owned directories, processes, ports and containers, and preserve primary plus cleanup errors. Operational helper imports and synthetic drivers must not launch real infrastructure. Actual provider, Docker, staging or deployment checks require their own authorized target and operation.

Windows visual cleanup captures and refreshes process identities, pins each process handle before identity verification and termination, and issues every verified stop before waiting for exits. Repeated interruption cancels the active helper even after the visual child closes; cleanup ownership remains until the helper actually closes. Preserve captured-orphan, PID-reuse, refresh-conflict, handle-disposal and combined-failure regressions. Measured PowerShell coverage joins the same source-bound artifact as the JavaScript reports without repeating the suite.

Visual comparison keeps runtime provenance, image hashes, tolerances and human approval. Fresh captures remain pending until the user reviews them; updates are forbidden in CI. Record actual failures, optional host skips and unexecuted work honestly. Routine checks do not require a dated QA report or an additional full-suite invocation.

When production source must remain unchanged, a failing check is evidence for
discussion, not permission to edit it. Present the exact file, trigger, test
evidence and minimal proposal in the current chat and discuss the source change
before editing, honoring existing approval for that scope. Do not add a maintained
investigation or decision log. Correct a faulty fixture only when evidence
supports that conclusion and retain genuine failing assertions.
