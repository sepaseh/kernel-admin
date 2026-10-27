# ADR 0001: Standalone admin runtime

[English](0001-independent-runtimes.md) · [فارسی](0001-independent-runtimes.fa.md)

Date: 23 October 2026. Status: accepted.

Scope updated: 27 October 2026. The accepted standalone-runtime decision is
retained; the published `core-auth` phase has `applicationReady: false`.
Providers, authentication forms, layout modules, navigation/access metadata and
HTTP owners are published. A React/Vite entry point, App/Routes composition,
business-page UI, production build and browser journeys remain future work.

The admin owns one root package manifest, lockfile, source tree and frontend
configuration. Installation and source validation require no other checkout or
internal package publication. The future build/release lifecycle must preserve
that independence. Features own their HTTP types, endpoints and helpers;
transport/session infrastructure, pure shared contracts and complete local
catalogs have local shared owners. Do not introduce workspaces, local-package
links or backend SDK source dependencies.

The independent API owns authentication execution, authorization, database,
migrations and storage. The admin consumes it over HTTP using explicit public
configuration. Compatible wire releases and deliberate rollout remain integration
requirements. The separate website owns its consumer. This admin record does not
verify either repository's current implementation or deployment.

Read [architecture](../architecture.md), [HTTP ownership](../http-client.md),
[Core/auth ownership](../core-auth.md) and [publication/full-gate policy](../bootstrap.md).
