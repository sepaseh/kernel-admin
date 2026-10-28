# Performance policy prerequisites

[English](performance.md) · [فارسی](performance.fa.md)

The published [bundle evaluator](../scripts/check-bundle-size.mjs) retains JavaScript budgets of 450,000 bytes per chunk and 1,900,000 bytes total. Synthetic asset inputs exercise its decisions. There is no production panel build in this phase, so these tests do not establish a current application bundle size; Storybook assets are a different output.

The [pure Lighthouse policy](../scripts/lighthouse-policy.mjs) holds thresholds, report evaluation and target construction without launching a preview or Chrome. Its policy tests run in existing unit coverage. The real Lighthouse runner, optional browser tools and application preview are deferred; no Lighthouse npm command or report is claimed here. Future integration must test launch/audit/write failures and clean every owned process while preserving errors.

Published observability adapters and tests describe scoped event/privacy behavior, not collected field performance. Do not infer traffic, availability, user percentiles or an active collector from adapter source. Real reporting requires an explicitly configured authorized service and its own privacy, retention and aggregation policy.

Before runnable activation, build the actual application, evaluate fresh output with unchanged budgets and execute the genuine browser/performance checks. Record revision, runtime, device/network conditions and limitations. Laboratory measurements do not establish field results; thresholds must not be widened to conceal regressions.

See [testing](testing.md) and [deployment](deployment.md).
