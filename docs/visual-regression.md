# Historical visual assets and future comparison

[English](visual-regression.md) · [فارسی](visual-regression.fa.md)

The four PNGs and `metadata.json` in `e2e/visual/baselines/win32` are retained provenance. Metadata records generation on 2026-10-24 and a historical review on 2026-10-26 for its own source fingerprint, Win32/x64, Node, Playwright and bundled Chromium versions. Preserve those bytes and dates. Its recorded `reviewed` status is not approval of the current source, a new screenshot comparison or a portable cross-platform baseline.

The import-safe visual runner and environment helper are published as preparation, with synthetic lifecycle/provenance tests. Application composition, visual configuration and application browser fixtures remain deferred. No visual npm command, current screenshot job, update command or fresh visual pass is published by this phase. Some metadata source inputs intentionally name future/unpublished files; that history must not be treated as an active task map.

The published runner exposes injected orchestration; its direct CLI fails before application fixtures can start. The CI update prohibition remains active. Complete browser/configuration integration and real comparisons belong to the admitted application gate, with human-reviewed baseline provenance.

Before future activation, complete the runner integration and publish its configuration and fixtures, pin and verify OS/browser/runtime and source inputs, use only synthetic configuration and exclusively owned ports/processes, and compare without updating by default. A baseline update requires explicit authorization and human review of every resulting image; failed or partial captures remain unapproved. Keep thresholds and first failure artifacts.

Current [Storybook browser/a11y checks](storybook-verification.md) provide component interaction evidence, not application screenshot evidence. See [accessibility](accessibility.md), [test reliability](test-reliability.md) and [validation](validation.md).
