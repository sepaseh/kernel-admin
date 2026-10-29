# Application testing and evidence

[English](testing.md) · [فارسی](testing.fa.md)

Use [the canonical manifest](../.agents/validation.json) and [validation policy](validation.md). The application-verification phase adds runnable composition to the inherited isolated workshop; each actual result must identify its exact source revision and scope. Start with the smallest relevant test, then run the complete full profile before an authorized commit, push or PR handoff.

Unit tests cover pure utilities, catalog/runtime adapters, HTTP/session generations, providers/forms, composed route access and failure boundaries. Both unit and governance coverage are genuinely measured; keep their existing thresholds and every inherited stress corpus, assertion and deadline. A failure is repaired, never hidden by skipping a required check, narrowing inputs or increasing a budget.

Storybook keeps complete API/client mocks, synthetic server-owned language/direction/calendar metadata, disabled ambient VITE/environment discovery and blocking accessibility audits. Application Playwright fixtures exercise composed routing, authentication and management flows with synthetic HTTP replies and fail-closed unexpected requests. Tests must own every process, port and temporary directory they create, and clean up setup, cancellation and failure paths.

Pact verifies the admin consumer contract; no live API provider is contacted or verified. The production build and bundle budget validate actual emitted assets. Lighthouse measures the synthetic authentication page using the owned built preview and browser. Static schemas, a rendered fixture or a successful skipped status cannot substitute for these executed checks.

Visual comparison is a distinct required check. Fresh capture metadata binds exact source inputs, OS, Node, Playwright and bundled Chromium versions, then requires real human approval of every resulting image. Keep historical baseline bytes and dates unchanged. Candidate captures remain pending until review; neither an automated screenshot pass nor assistant inspection may approve them on behalf of a human.

Real production/provider/staging/DAST/Docker operation and remote protection changes retain separate authorization. Never read or move real .env.local, credentials, server/data, uploads or operator files for a fixture. Use only the three deliberately reviewed synthetic public examples when applicable. Read [HTTP reliability](admin-request-reliability.md), [Storybook verification](storybook-verification.md), [performance](performance.md) and [visual provenance](visual-regression.md).
