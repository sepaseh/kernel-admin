# Testing

## Choose checks

Start with the smallest declared check that covers the changed behavior. Select
commands from the [validation manifest](../validation.json).

Choose the [test owner](../../docs/testing.md#choose-the-test-owner) that can
observe the change. Exercise stale completions, cancellation, permissions and
failure paths where applicable. Follow [exact-source validation](../../docs/validation.md#validate-the-exact-proposed-source)
before an authorized commit, push or handoff.

## Isolate fixtures

Use [synthetic fixtures](safety.md#secrets-and-local-state) and disposable
resources owned by the test. Exercise observable success and failure.

Mock a feature API or shared client completely, with no spy passthrough. Dedicated transport tests use owned synthetic endpoints.
Import operational helpers and synthetic drivers without starting infrastructure.
Follow the [external action rules](safety.md#external-systems) and
[deployment guide](../../docs/deployment.md) for checks against real targets.

Keep stories beside their source owner under `src/`. Use synthetic toolbar
metadata and explicit request handling for the [Storybook tests](../../docs/testing.md#test-components-in-storybook).
Follow [contract fixture quality](collection-quality.md) when changing HTTP examples.

## Synchronize and clean up

Synchronize with observable readiness, completion, errors and close events. Use
controlled clocks for timing behavior and explicit cancellation for interrupted
work. Preserve the first operation failure and any cleanup failures.

Wait for application state, IPC, stream completion or process closure. Reject
early errors and premature closure. Avoid fixed sleeps, polling delays, retry
counts or extra deadlines to guess readiness. Preserve browser and CI budgets.
Visual/process-tree commands, their synthetic fixtures and CI evidence requests
use actual completion and explicit cancellation without wall-clock deadlines.

Wait for owned resources to close before removing files. Clean up only owned
directories, processes, ports and containers. Preserve the [Windows process cleanup regressions](../../docs/testing.md#test-windows-process-cleanup)
when changing capture, interruption or termination.

## Preserve test evidence

Keep behavioral assertions, accessibility checks, stress inputs, declared
product deadlines and measured coverage. Preserve source-bound reports when
reusing evidence for analysis. See [validation evidence](../../docs/validation.md#interpret-the-evidence)
for the separate LCOV, PowerShell and browser results and
[code quality](code-quality.md#static-analysis-findings) for advisory metrics.

Follow [image comparison and approval](../../docs/testing.md#compare-and-approve-images)
for reviewed baselines, runtime provenance, hashes, tolerances and CI restrictions.
When the owner explicitly withdraws a product requirement, update only its
assertions and documented [test scope](../../docs/testing.md#review-appearance).
Retain the remaining audits and report the decision.

Report actual failures, optional host skips and unexecuted work. Correct a
fixture only when evidence identifies a fixture defect. Retain genuine failing
assertions. If production source must remain unchanged, follow the
[discussion and evidence requirements](../../AGENTS.md#scope-and-safety).
