# Admin testing and verification

[English](testing.md) · [فارسی](testing.fa.md)

The `assistant-guidance` phase tests published modules and an isolated component workshop; `applicationReady` remains false. Start with the smallest relevant test, then run the complete [canonical gate](../.agents/validation.json) before an authorized commit or PR handoff. Use [validation policy](validation.md) for exact-snapshot preparation.

Unit tests use Vitest, React Testing Library and synthetic MSW responses for HTTP, lifecycle, provider, form, widget, catalog and translation/date modules. Preserve every production module in measured coverage and all existing thresholds. These fixtures never use an operator API, real session, database or environment file.

Node governance tests protect the publication inventory, source boundaries, canonical runner and semantic CI/scanner policy. Guidance consistency and portable Node safety-hook regressions run in that suite. `npm run test:guidance` is a focused subset, not a replacement for full validation. Optional Bash wrapper cases probe a usable Bash before execution; an unavailable host prerequisite is reported as a skip while portable safety tests remain mandatory. The optional post-edit formatter uses Node to parse its input and the project-local ESLint CLI to fix only the selected file; its disposable regression verifies that unrelated files remain unchanged.

Storybook build and Chromium tests cover every registered story, real play interactions and accessibility with violations treated as errors. Feature owners and the shared HTTP client use full synthetic replacements; unexpected requests fail even when a component catches them. English/Persian toolbar metadata, direction and theme are fixtures, not visitor language preferences.

The full gate produces actual unit/governance LCOV from the checked snapshot. Browser results and static workshop assets are separate evidence. Do not commit generated output. Current-head hosted CI, scanner and native Sonar need independent verification; local success does not prove hosted execution or approval.

Actual application route journeys, real provider contracts, production bundle measurement, current visual comparison, real Docker smoke and deployed staging/DAST remain future work. Published pure policies and historical images do not execute them. Do not claim them from workshop tests, unpublished source or dated QA archives. For failures, record the first failing command, exact revision and observed error. Distinguish product, synthetic-fixture and host-prerequisite causes without weakening assertions or widening tolerances to hide failures.

## Preparatory helper suites

The four existing unit owners add bundle policy, pure Lighthouse policy, production-input and workflow-target validation. Three governance owners add deployment rendering, release packaging and Docker resource/orchestration fixtures. They run once within existing measured commands; no third required suite or focused operations profile is introduced. Imports and synthetic driver cases do not launch Docker, a browser, preview or external target.

Keep failure/cleanup assertions, existing stress corpora and bounded deadlines mandatory. The current source gate has twelve required checks; production coverage thresholds and actual unit/governance LCOV remain unchanged. The three reviewed public examples are synthetic; real environments/certificates/state are never fixtures. [Historical Windows assets](visual-regression.md) retain their old provenance and do not establish current screenshot approval. See [test reliability](test-reliability.md).

Verification runner preparation adds import-safe visual/Lighthouse orchestration and build metadata stamping. Synthetic tests exercise ownership, failure cleanup and provenance without starting the application, Chrome or an API. No operational npm alias is registered; the twelve-check current gate and visual human-review requirement remain unchanged. Future application CI admission is tested separately from the current Linux workflow.
