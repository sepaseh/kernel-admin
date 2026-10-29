# Component and prerequisite coverage

[English](component-coverage.md) · [فارسی](component-coverage.fa.md)

Use unit tests for pure policies/mappers, integration regressions for request/provider lifecycles and component tests for observable form behavior. Preserve stale-response, cancellation, generation and permission boundaries. Avoid tests that only repeat implementation details.

The isolated Storybook workshop covers registered auth, account, calendar, settings, roles/users, input and layout stories with complete synthetic API replacements, real Chromium interactions and blocking accessibility audits. It does not run the assembled application or a real API.

Operational prerequisites join existing measured suites: bundle and Lighthouse policy, production-input and target-validation cases run in unit coverage; deployment rendering, release packaging and Docker resource/orchestration cases run in governance coverage. Their injected synthetic cases do not establish a real browser audit, image build or deployed target.

The [manifest](../.agents/validation.json) owns every required entry, command and order for the declared phase. Application admission retains the inherited checks and adds genuine build, bundle, consumer-contract, application browser, reviewed visual and Lighthouse evidence. Unit and governance LCOV must come from the same exact source snapshot. Preserve existing coverage thresholds and stress/deadline cases; run the smallest affected check during iteration and the complete exact-tree gate at authorized handoff.

Application route integration tests exercise the assembled providers/router with synthetic services. Browser fixtures verify complete client journeys across every configured browser and reject unhandled external requests. Pact consumer checks exercise real client HTTP adapters against an owned local mock provider; they do not verify the independent API. Visual comparison requires matching runtime provenance and actual human-approved images. Lighthouse requires a synthetic production build and owned browser/preview cleanup.

Mutation, independent provider verification and target-specific deployment checks require separate admitted owners and observed runs. See [testing](testing.md), [contracts](contract-testing.md) and [visual provenance](visual-regression.md).
