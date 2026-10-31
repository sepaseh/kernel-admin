# Performance verification

[English](performance.md) · [فارسی](performance.fa.md)

Read the checked revision's [publication policy](../.github/bootstrap-policy.json), [source inventory](bootstrap.md) and [canonical gate](../.agents/validation.json) to identify admitted build, bundle and Lighthouse checks. Available helper modules and command names do not establish an executable application or a passing performance result. JavaScript budgets remain 450,000 bytes per chunk and 1,900,000 bytes total. The [bundle evaluator](../scripts/check-bundle-size.mjs) measures application assets separately from Storybook output.

The [pure Lighthouse policy](../scripts/lighthouse-policy.mjs) owns thresholds, report evaluation and target construction. Policy tests and the import-safe [runner's](../scripts/run-lighthouse.mjs) injected lifecycle tests cover startup, interruption, report-write completion and owned-resource cleanup. Importing the runner starts no process. Synthetic lifecycle tests do not perform a Lighthouse audit; the CLI must reject application execution while its publication gate is closed.

When the current policy admits application execution, use a completed build with explicit synthetic public configuration and an owned local preview. Disable ambient environment-file discovery, isolate unexpected external requests and keep generated caches and reports outside the maintained source inventory. Verify the actual driver, settings readiness, browser/device/network conditions and report paths from that revision. A failed metric, report write or resource cleanup fails verification; retaining a report does not make the result successful. Never use a real API target without authorization.

Published observability adapters and tests describe scoped event/privacy behavior, not collected field performance. Do not infer traffic, availability, user percentiles or an active collector from adapter source. Real reporting requires an explicitly configured authorized service and its own privacy, retention and aggregation policy.

Record the checked revision, runtime, first failure and limitations with each executed result. Laboratory measurements do not establish field results; thresholds, throttling and budgets must not be widened to conceal regressions. Real API-provider and deployed performance verification require their own authorized targets.

See [testing](testing.md) and [deployment](deployment.md).
