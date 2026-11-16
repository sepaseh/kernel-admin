# Test the admitted source

[The publication policy](../.github/bootstrap-policy.json) defines the exact source under test. [The manifest](../.agents/validation.json) owns commands and required profiles. A repository-only snapshot cannot establish an assembled application, production build, browser behavior or compatibility with a deployed backend.

## Run focused checks

Use the runtime and locked dependencies from [development](development.md). From the repository root, guidance iteration uses:

```sh
npm run validate -- guidance
```

The profile checks guidance consistency and its synthetic regressions. It does not replace the complete `full` profile required by [validation](validation.md).

## Read the evidence

The current unit command measures admitted tooling cases. Governance tests exercise publication policy, CI identity and coverage rules, guidance, boundaries and optional safety hooks with owned fixtures. Read [package.json](../package.json) and the manifest for selected owners. Configured commands alone do not prove execution.

Measured unit and governance coverage belongs in `coverage/unit/lcov.info` and `coverage/governance/lcov.info`. Import reports only for the same checked source. Numerical coverage and analyzer metrics are advisory; assertion failures, invalid reports, type/lint failures and security failures remain required evidence.

Use uniquely owned synthetic fixtures. Never read real environment files, credentials, databases, uploads or browser state. Synchronize asynchronous fixtures on actual state or process completion and preserve cleanup failures. Keep meaningful regressions and declared product-test deadlines intact.

## Review appearance

Component, browser, accessibility and visual checks require their owners and genuine execution after admission. Storybook fixtures remain synthetic. Component results cannot replace application journeys, deployed-provider evidence or manual assistive-technology review.

## Compare and approve images

Visual baselines require runtime, source, hash and explicit human-review provenance. New captures remain pending until reviewed. Do not overwrite approved images, widen tolerances or promote candidates merely to pass CI. Static admission does not establish fresh visual approval.

## Interpret hosted results

Local full validation does not establish hosted CI, native CodeQL analysis, Sonar scanner execution, its asynchronous quality gate or provider approval. Verify current-head evidence separately under [the PR policy](../.agents/rules/pull-requests.md). A successful review status may represent a skip or quota limit; inspect the substantive review.
