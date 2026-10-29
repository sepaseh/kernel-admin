# Architecture decision records

[English](README.md) · [فارسی](README.fa.md)

These short records explain the implemented decisions that a file/import graph
cannot reconstruct. They are not evidence that a production system is deployed.
Current source/contracts and tests determine behavior; update consequences or
add a superseding record when an accepted decision changes.

Current phase, admitted composition and readiness are declared by [the publication policy](../../.github/bootstrap-policy.json); [the manifest](../../.agents/validation.json) owns required evidence. A false readiness flag retains module/workshop scope; runnable admission needs genuine application checks and human-reviewed visual provenance. Earlier ADR dates and publication descriptions remain historical. API/website boundaries describe ownership and compatibility requirements, not fresh verification of those independent repositories.

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
