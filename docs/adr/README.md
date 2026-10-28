# Architecture decision records

[English](README.md) · [فارسی](README.fa.md)

These short records explain the implemented decisions that a file/import graph
cannot reconstruct. They are not evidence that a production system is deployed.
Current source/contracts and tests determine behavior; update consequences or
add a superseding record when an accepted decision changes.

Scope updated: 28 October 2026. The current `assistant-guidance` publication retains Core/providers, business modules, isolated Storybook verification and local development guidance, with `applicationReady: false`. Application entry, App/Routes composition, production panel build, complete application E2E and visual verification remain future work. Individual ADR acceptance dates and earlier publication descriptions are historical; the current source and canonical manifest determine active scope. API/website responsibilities describe ownership and integration requirements, not fresh verification of those independent repositories.

| Record                                                                                    | Decision                                                  |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| [0001](0001-independent-runtimes.md) · [فارسی](0001-independent-runtimes.fa.md)           | Standalone admin runtime and HTTP service boundary        |
| [0003](0003-single-active-language.md) · [فارسی](0003-single-active-language.fa.md)       | Ten complete catalogs, one persisted active language      |
| [0004](0004-cookie-proxy-and-sessions.md) · [فارسی](0004-cookie-proxy-and-sessions.fa.md) | API-owned sessions and separate consumer responsibilities |

For a new consequential choice, record date/status, context, decision, tradeoffs,
source/check references and any superseded record. Keep the English primary and
complete Persian companion together. Do not copy every implementation detail,
require a new ADR for a routine edit or introduce a decision-management package.
Use [architecture](../architecture.md), [HTTP ownership](../http-client.md),
[Core/auth ownership](../core-auth.md) and [localization](../localization.md) to
find published owners. The [publication guide](../bootstrap.md) and
[canonical manifest](../../.agents/validation.json) define the current full gate.
