# Native hosting prerequisites

[English](README.md) · [فارسی](README.fa.md)

The published Nginx templates and renderer prepare static hosting. They are not an installed server, a certificate, or an executed deployment. Read admitted build sources and `applicationReady` from [the publication policy](../../.github/bootstrap-policy.json), and required checks from [the manifest](../../.agents/validation.json). While readiness is false, prerequisites cannot establish an application artifact; a true declaration still does not authorize an operator target or prove a deployment.

The full template is intended to serve an immutable admin public directory, with an independently hosted API and explicit public origins. The bootstrap template is HTTP-only for a future authorized ACME challenge and serves no application content. Public examples are synthetic. Never reuse local operator configuration or private certificate contents as a test fixture.

After runnable activation and explicit operator authorization: prepare a compatible immutable release, choose public host/base/release values, render into a new configuration file, provision certificates privately, validate Nginx configuration and TLS, then atomically switch the verified release and reload. Rendering checks syntax and placeholders; it does not establish DNS, trust, file existence or service availability.

Preserve strict asset misses, immutable hashed assets, no-store documents/identity metadata and explicit CSP origins. The frontend host must not become an API implementation. If several sites share an edge listener, reconcile their virtual hosts and retain only one default rejection server per address/port rather than installing duplicate defaults.

See [deployment](../../docs/deployment.md), [operations](../../docs/release-operations.md) and [recovery](../../docs/backup-restore.md).
