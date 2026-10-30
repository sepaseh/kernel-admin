# Admin testing and verification

[English](testing.md) · [فارسی](testing.fa.md)

The application-verification phase admits the composed standalone application while retaining every module and isolated component-workshop check. Start with the smallest relevant test, then run the complete [canonical gate](../.agents/validation.json) before an authorized commit, push or PR handoff. Use [validation policy](validation.md) for exact-snapshot preparation.

Unit tests use Vitest, React Testing Library and synthetic MSW responses for HTTP, lifecycle, provider, form, widget, catalog and translation/date modules. Preserve every production module in measured coverage and all existing thresholds. These fixtures never use an operator API, real session, database or environment file.

Node governance tests protect the publication inventory, source boundaries, canonical runner and semantic CI/scanner policy. Guidance consistency and portable Node safety-hook regressions run in that suite. `npm run test:guidance` is a focused subset, not a replacement for full validation. Optional Bash wrapper cases probe a usable Bash before execution; an unavailable host prerequisite is reported as a skip while portable safety tests remain mandatory. The optional post-edit formatter uses Node to parse its input and the project-local ESLint CLI to fix only the selected file; its disposable regression verifies that unrelated files remain unchanged.

Storybook build and Chromium tests cover every registered story, real play interactions and accessibility with violations treated as errors. Feature owners and the shared HTTP client use full synthetic replacements; unexpected requests fail even when a component catches them. English/Persian toolbar metadata, direction and theme are fixtures, not visitor language preferences.

The full gate produces actual unit/governance LCOV from the checked snapshot. Browser results and static workshop assets are separate evidence. Do not commit generated output. Current-head hosted CI, scanner and native Sonar need independent verification; local success does not prove hosted execution or approval.

Application Playwright fixtures now exercise routing, authentication and management with synthetic HTTP and fail-closed unexpected requests. Pact runs real consumer adapters against an owned local mock provider; it does not verify the independent API. Actual production bundle, current visual comparison and Lighthouse belong to the full gate. Real provider, Docker smoke and deployed staging/DAST remain separate. For failures, record the first failing command, revision and observed error; distinguish product, fixture and host causes without weakening assertions or widening tolerances.

## Preparatory helper suites

The four existing unit owners add bundle policy, pure Lighthouse policy, production-input and workflow-target validation. Three governance owners add deployment rendering, release packaging and Docker resource/orchestration fixtures. They run once within existing measured commands; no third required suite or focused operations profile is introduced. Imports and synthetic driver cases do not launch Docker, a browser, preview or external target.

Keep failure/cleanup assertions, existing stress corpora and bounded deadlines mandatory. The current source gate has nineteen required checks; production coverage thresholds and actual unit/governance LCOV remain unchanged. The three reviewed public examples are synthetic; real environments/certificates/state are never fixtures. [Historical Windows assets](visual-regression.md) retain their old provenance and do not establish current screenshot approval. See [test reliability](test-reliability.md).

Visual/Lighthouse runners and build metadata stamping remain import-safe. Injected lifecycle/provenance tests do not start the application, Chrome or an API. The admitted application commands separately execute owned synthetic previews and browsers; preserve matching runtime provenance, actual human image approval and the unchanged CI update prohibition. Provider, Docker, staging and deployment operation require separate authorization and evidence.

Build-metadata and release-packaging fixtures resolve the temporary parent before creating an owned directory. Their alias regressions preserve exact artifact ownership and cleanup assertions when Windows exposes the same directory through short and long path names; alternate spellings do not permit escaping the owned directory.

The production Vite UI and vendor groups partition shared modules by their actual entry consumers (`entriesAware: true`). Route-specific dependencies can stay lazy instead of joining authentication's initial module graph merely because they use the same library. The initial loading indicator waits outside the Ant Design provider, avoiding a throwaway theme before the validated API palette arrives. Bootstrap errors still mount themed retry feedback; after readiness, later refresh failures retain the provider and route identities. The existing chunk/total bundle limits and Lighthouse throttling and thresholds still apply.

Language-setting confirmation cases wait for the active dialog’s opening motion to finish before the real mouse click. The Q4 Firefox trace showed a click during the entrance transition missing the moving button, with no settings PUT. Readiness synchronization preserves the original settings assertions, deadlines and zero retries.
