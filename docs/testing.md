# Write and interpret tests

Use synthetic fixtures for the actual source admitted by the [publication policy](../.github/bootstrap-policy.json). The [validation manifest](../.agents/validation.json) selects the required checks for that phase; [validation](validation.md) describes exact-snapshot execution.

## Test coordination

Wait for an observable state, request completion, an explicit readiness event, child-process closure or cancellation. Do not synchronize tests using arbitrary sleeps, fixed polling counts or guessed cleanup delays. A child process exiting is separate from its output streams closing; release its owned files only after completion and closure.

Use controlled cancellation to exercise stalled or failed operations. Preserve the original failure, finish owned cleanup and collect cleanup failures without abandoning remaining owned resources. Avoid unhandled rejections and background work that outlives the test.

Intentional product debounce, request/session timing and explicit CI safety limits retain their purpose. Do not remove product behavior or lower safety/coverage limits to make a test finish sooner.

## Fixtures and coverage

Never use real environments, credentials, databases, uploads or browser state as fixtures. Temporary files belong in ignored repository-local scratch directories; owned Git fixtures must not discover an ancestor implementation repository. Only the three reviewed public environment examples named in [AGENTS](../AGENTS.md) may be source exceptions when admitted.

Unit LCOV measures the configured admitted unit sources; governance LCOV measures the executed tooling and policy sources. Import measured reports from the exact tested revision into Sonar. Neither report establishes coverage of unpublished UI, routing or application behavior.

For `runtime-localization`, unit tests exercise memory-only token generations, language normalization, all ten catalogs and interpolation names, i18n initialization, date adapters, Persian date data, shared utilities and the audit tool. Governance tests separately exercise repository checks and optional hooks. Select the applicable suite from the [manifest](../.agents/validation.json); both measured suites participate in the complete `full` profile and publish separate source-bound reports for Sonar.

When a later phase admits component workshops or application journeys, execute their real declared browser checks with synthetic APIs and report their scope. Component tests do not establish assembled routes, a production application or backend compatibility. New visual captures require explicit human approval before becoming approved baselines.

Keep meaningful regressions and existing thresholds. Source configuration and a named test are not execution evidence. Keep generated reports under ignored `coverage/` and report current results in the PR rather than creating dated QA documents.
