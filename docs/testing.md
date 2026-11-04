# Write and maintain tests

Use this guide when adding a regression or changing a fixture. [Validation](validation.md) owns how to select and run verification profiles, prepare an exact source snapshot and interpret hosted evidence.

## Choose the test owner

| Changed behavior                                  | Test owner                                 | Exercise                                                                 |
| ------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| Pure helper, HTTP adapter, hook, provider or form | Closest `src/**/*.test.ts` or `*.test.tsx` | Observable results, error paths, cancellation and stale completions.     |
| Behavior spanning application modules             | `src/test/integration`                     | Composition, resource/session changes and permissions.                   |
| Reusable UI interaction                           | Closest `*.stories.tsx`                    | Real browser interaction and accessibility with complete synthetic APIs. |
| Source, guidance, CI or helper policy             | Flat `scripts/*.test.mjs`                  | Synthetic accepted and rejected cases for the actual boundary.           |
| Composed application journey                      | `e2e/`                                     | Built-panel behavior through the browser with explicit API handlers.     |
| Consumer wire expectations                        | `contract/`                                | Real consumer adapters against an owned local Pact mock provider.        |

Give each script a direct regression suite with the same basename: `<script>.test.mjs`, or `<script>.test.ps1` for PowerShell. Keep cases for different implementation owners in their matching suites. A separate `*.integration.test.mjs` suite may exercise composition across boundaries. Reusable Node fixture setup belongs in flat `*.test-support.mjs` helpers; helpers register no tests. Feature-specific fixtures stay with their owner; do not create another backend or depend on another checkout's service.

## Add a regression

1. Describe the triggering action and expected visible result. Read the closest existing case and the behavior's source owner before choosing a fixture.
2. Supply complete synthetic data and explicit HTTP responses. Reject undeclared requests rather than allowing a fixture to reach a real service. For stories, fully replace feature APIs and the shared client; the shared request guard must catch unconfigured calls even when a component catches the error.
3. Exercise relevant success and failure paths. For asynchronous work, cover cancellation, resource replacement, session changes and late results. Preserve allowed/read-only behavior instead of merely checking implementation calls.
4. Run the smallest relevant case first. For example, this command uses the installed Vitest configuration from the repository root:

   ```sh
   npx vitest run src/shared/api/client.test.ts
   ```

   Expect a nonzero exit code for any failed assertion. Use [validation](validation.md) for the required gate before a commit or PR handoff.

5. Check cleanup and diagnostics. Use disposable, uniquely owned directories, ports, processes and resource labels. Attempt every owned cleanup and preserve both the primary and cleanup errors. Keep review evidence and recovery files in ignored repository-local directories.

Synchronize fixtures through observable state, IPC messages, stream completion or
process closure. Do not use fixed sleeps, polling delays, retry counts or extra
wall-clock deadlines to guess when asynchronous work has finished. Cover early
errors, premature closure and explicit cancellation so a failed fixture cannot
leave its waiter pending. Wait for owned processes and streams to close before
removing their files; an exit event alone does not establish stream closure.
Tests of product timing use controlled clocks and the actual product duration.
Keep the declared browser and CI execution budgets as outer failure limits.

Operational helper imports must stay free of environment-file reads, network requests, process startup and writes. Synthetic drivers do not launch infrastructure. Never read real environments, credentials, databases, uploads or browser profiles as fixtures, or reset/prune shared resources to obtain a pass.

## Test components in Storybook

The isolated [Storybook Vite configuration](../.storybook/vite.config.ts) disables ambient environment-file and VITE discovery. The [browser test configuration](../vitest.storybook.config.ts) runs registered play interactions in real Chromium; accessibility violations fail.

Use the real UI and theme with complete replacements for feature APIs and the shared client; do not use spy passthrough. Mocks reset before every story. Language/direction/theme controls supply synthetic metadata; they do not create production visitor preferences. A workshop pass covers the component interaction, not composed application or API-provider behavior.

## Test application journeys and contracts

[Playwright](../playwright.config.ts) starts an owned strict-port preview of the built panel. Its fixtures supply explicit synthetic API handlers and reject unexpected external requests. Preserve settings initialization, permission checks before protected page imports, account/session transitions, retained read data and mutation cancellation.

Ordinary local and PR verification uses Chromium. Complete verification substitutes the configured browser matrix, then performs applicable image comparison. Keep configured retries at zero and synchronize on actual readiness instead of adding arbitrary delays or larger deadlines.

[Pact consumer tests](../vitest.contract.config.ts) call the real adapters against an owned local mock provider. They verify consumer expectations; a developer's chosen backend needs its own authorized integration verification. Browser journeys and consumer contracts supply different evidence.

## Review appearance

For an affected screen, exercise translated names/errors, keyboard submission, invalid-field focus, Tab containment, Escape and trigger-focus restoration. Read-only overflowing tables need a named keyboard-focusable scroll region. Preserve contrast, reduced motion and logical RTL/LTR layout across light/dark/compact variants. Static font tests inspect licensed WOFF2 data and CSS; the font journey separately checks loading from the application origin. These checks do not establish interpolation at every weight or deployed accessibility.

### Compare and approve images

`npm run test:visual` compares the reviewed images under `e2e/visual/baselines/application/<platform>`. The runner checks image inventory/hashes and runtime/source provenance before and after its child run. Missing approval, source changes during execution, linked paths and incompatible runtime fail verification. Screenshots do not replace keyboard or assistive-technology review.

`npm run test:visual:update` requires explicit authorization and creates pending candidates under `coverage/visual/captures`. It leaves approved images intact and is forbidden in CI. Present the exact candidate bytes and metadata for human approval before promotion; preserve original baseline provenance and failure artifacts.

## Test Windows process cleanup

The runner owns its preview, strict ports and process lock. An occupied port fails before contacting another service. Windows cleanup captures process identities, refreshes eligible descendants and operates through retained, identity-verified process handles.

Windows identity capture starts when the child reports a successful spawn, before interruption. Snapshot output has an explicit 16 MiB buffer limit. If the early capture fails, interruption retries it once while the owned root is still running and cancellation has not been requested; a failed retry preserves both errors and never authorizes an unverified tree stop. Stop receives the retained snapshot through piped standard input, keeping snapshot size out of the command line. Cleanup refreshes eligible descendants while the original root identity remains valid; after the root exits, it can stop only previously captured identities. Descendants first created after the last successful capture cannot be safely inferred and are not selected by PID alone. Normal child completion cancels a pending capture and waits for the helper to actually close.

Keep these cases in the split [runner](../scripts/run-visual.test.mjs), [integration](../scripts/run-visual.integration.test.mjs) and [environment](../scripts/visual-environment.test.mjs) suites:

| Condition                                     | Required result                                                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| A captured PID is reused                      | Reject the mismatched identity and keep unrelated processes safe.                                               |
| Refreshed ancestry conflicts or refresh fails | Preserve eligible captured orphans and independent verified branches; report refresh and cleanup failures.      |
| One process takes time to exit                | Attempt every verified stop, children first and root last, before waiting; dispose retained handles.            |
| The visual child closes before its helper     | Retain cleanup ownership until both actually close; an early error callback is not helper closure.              |
| A second SIGINT/SIGTERM arrives               | Abort the active Snapshot/Stop helper, preserve output/errors and still request termination of a running child. |
| Spawn fails without a PID                     | Reject immediately without issuing a tree-termination command.                                                  |

Visual children, Windows helpers and these synthetic fixtures use actual completion and explicit cancellation without configured wall-clock deadlines. Their synthetic process identities/readers must never select a real process for termination.

The governance runner executes files serially so CPU-intensive child fixtures do not compete. Its [PowerShell fixture](../scripts/stop-visual-process-tree.test.ps1) runs once, emits phase diagnostics and measures debugger line hits and misses in `coverage/governance/powershell.xml`. The scanner consumes that same verified artifact without rerunning the fixture.

Governance coverage excludes `*.test.*` fixtures explicitly so executable owners such as [the Docker smoke helper](../scripts/test-docker-release.mjs) remain measured. Its synthetic tests exercise the orchestration and cleanup without starting Docker.

## Preserve meaningful failures

Keep the first failed command, runtime conditions and diagnostics. Distinguish a product defect, fixture race, unavailable host prerequisite and resource leak before changing code. A later pass does not erase an earlier failure. Optional Bash wrappers report unavailable host prerequisites; portable Node safety regressions remain required.

Preserve assertions, stress inputs, configured coverage/bundle/performance budgets and declared product-test deadlines. Lighthouse remains a real owned-preview audit under [the current performance policy](validation.md#resolve-a-failed-check); injected orchestration tests do not establish an audit. Docker, deployed smoke/staging and DAST remain separate authorized operations described in [deployment](deployment.md).
