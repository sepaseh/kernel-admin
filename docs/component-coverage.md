# Component and prerequisite coverage

[English](component-coverage.md) · [فارسی](component-coverage.fa.md)

Use unit tests for pure policies/mappers, integration regressions for request/provider lifecycles and component tests for observable form behavior. Preserve stale-response, cancellation, generation and permission boundaries. Avoid tests that only repeat implementation details.

The isolated Storybook workshop covers registered auth, account, calendar, settings, roles/users, input and layout stories with complete synthetic API replacements, real Chromium interactions and blocking accessibility audits. It does not run the assembled application or a real API.

Operational prerequisites join existing measured suites: bundle and Lighthouse policy, production-input and target-validation cases run in unit coverage; deployment rendering, release packaging and Docker resource/orchestration cases run in governance coverage. Their synthetic inputs do not build an image, start Chrome/Docker or verify a deployed target. The pure Lighthouse policy has no CLI/browser dependency.

The [manifest](../.agents/validation.json) owns every required check, its command and order. Preserve existing production coverage, real LCOV and thresholds; do not duplicate the new suites as a second required full gate. Run the smallest relevant check during development and the complete exact-tree gate at authorized handoff.

Read admitted owners and `applicationReady` from [the publication policy](../.github/bootstrap-policy.json). While readiness is false, prerequisite fixtures cannot establish application activation. Claim Pact consumer/provider verification, application E2E, mutation, real Lighthouse or visual comparison only for admitted checks actually run; a local consumer mock is not provider verification, and new visual baselines require human review. See [testing](testing.md), [contracts](contract-testing.md) and [visual provenance](visual-regression.md).
